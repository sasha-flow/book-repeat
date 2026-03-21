import { NextResponse } from "next/server";
import { z } from "zod";

import { parseSqlitePayload } from "../../../lib/sqlite-import";
import { getSupabaseServiceClient } from "../../../lib/supabase/service";

const fileSchema = z.instanceof(File);

function summarizeDuplicateKeys<T>(
  rows: T[],
  getKey: (row: T) => string,
): {
  duplicateKeyCount: number;
  duplicateRowCount: number;
  samples: Array<{ key: string; count: number }>;
} {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = getKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    );

  return {
    duplicateKeyCount: duplicates.length,
    duplicateRowCount: duplicates.reduce(
      (sum, [, count]) => sum + count - 1,
      0,
    ),
    samples: duplicates.slice(0, 10).map(([key, count]) => ({ key, count })),
  };
}

function dedupeRowsByKey<T>(rows: T[], getKey: (row: T) => string): T[] {
  const dedupedRows = new Map<string, T>();

  for (const row of rows) {
    const key = getKey(row);

    if (!dedupedRows.has(key)) {
      dedupedRows.set(key, row);
    }
  }

  return [...dedupedRows.values()];
}

export async function POST(request: Request) {
  try {
    const accessToken = request.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const sourceFile = formData.get("file");
    const parsedFile = fileSchema.safeParse(sourceFile);

    if (!parsedFile.success) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const file = parsedFile.data;
    const serviceClient = getSupabaseServiceClient();

    const { data: authData, error: authError } =
      await serviceClient.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;
    const filePath = `${userId}/${Date.now()}-${file.name}`;
    const bucket = process.env.SUPABASE_IMPORT_BUCKET ?? "imports";

    console.info("[import-sqlite] import started", {
      userId,
      fileName: file.name,
      fileSize: file.size,
      bucket,
      filePath,
    });

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await serviceClient.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        upsert: false,
        contentType: "application/x-sqlite3",
      });

    if (uploadError) {
      console.error("[import-sqlite] upload failed", {
        userId,
        fileName: file.name,
        filePath,
        bucket,
        error: uploadError.message,
      });
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 400 },
      );
    }

    const parsedPayload = await parseSqlitePayload(fileBuffer);

    const parsedBookDuplicates = summarizeDuplicateKeys(
      parsedPayload.books,
      (book) => book.source_hash,
    );
    const parsedBookmarkDuplicates = summarizeDuplicateKeys(
      parsedPayload.bookmarks,
      (bookmark) => bookmark.source_uid,
    );

    console.info("[import-sqlite] parsed payload", {
      userId,
      fileName: file.name,
      sourceTables: parsedPayload.diagnostics.sourceTables,
      parsedBooks: parsedPayload.books.length,
      parsedBookmarks: parsedPayload.bookmarks.length,
      parsedBookDuplicates,
      parsedBookmarkDuplicates,
      bookHashDiagnostics: parsedPayload.diagnostics.bookHash,
    });

    const rawBookRows = parsedPayload.books.map((book) => ({
      user_id: userId,
      source_hash: book.source_hash,
      title: book.title,
      authors: book.authors,
    }));
    const bookRows = dedupeRowsByKey(rawBookRows, (book) => book.source_hash);

    if (bookRows.length !== rawBookRows.length) {
      console.warn("[import-sqlite] deduplicated book rows before upsert", {
        userId,
        fileName: file.name,
        removedRows: rawBookRows.length - bookRows.length,
        duplicates: summarizeDuplicateKeys(
          rawBookRows,
          (book) => book.source_hash,
        ),
      });
    }

    const { data: booksData, error: booksError } = await serviceClient
      .from("books")
      .upsert(bookRows, { onConflict: "user_id,source_hash" })
      .select("id, source_hash");

    if (booksError) {
      const { error: cleanupError } = await serviceClient.storage
        .from(bucket)
        .remove([filePath]);

      console.error("[import-sqlite] books import failed", {
        userId,
        fileName: file.name,
        filePath,
        parsedBooks: parsedPayload.books.length,
        dedupedBooks: bookRows.length,
        parsedBookDuplicates,
        cleanupError: cleanupError?.message ?? null,
        error: booksError.message,
      });

      return NextResponse.json(
        {
          error: `Books import failed: ${booksError.message}`,
          details: {
            parsedBooks: parsedPayload.books.length,
            dedupedBooks: bookRows.length,
            parsedBookDuplicates,
            cleanupError: cleanupError?.message ?? null,
          },
        },
        { status: 400 },
      );
    }

    const booksMap = new Map(
      (booksData ?? []).map((row: { source_hash: string; id: string }) => [
        row.source_hash,
        row.id,
      ]),
    );

    const rawBookmarkRows = parsedPayload.bookmarks
      .map((bookmark) => {
        const bookId = booksMap.get(bookmark.book_source_hash);

        if (!bookId) {
          return null;
        }

        return {
          user_id: userId,
          source_uid: bookmark.source_uid,
          book_id: bookId,
          bookmark_text: bookmark.bookmark_text,
          paragraph: bookmark.paragraph,
          word: bookmark.word,
          bookmark_type: bookmark.bookmark_type,
          source_style_id: bookmark.source_style_id,
          source_visible: bookmark.source_visible,
          source_creation_time: bookmark.source_creation_time,
          source_modification_time: bookmark.source_modification_time,
        };
      })
      .filter((row) => row !== null);
    const bookmarkRows = dedupeRowsByKey(
      rawBookmarkRows,
      (bookmark) => bookmark.source_uid,
    );

    if (bookmarkRows.length !== rawBookmarkRows.length) {
      console.warn("[import-sqlite] deduplicated bookmark rows before upsert", {
        userId,
        fileName: file.name,
        removedRows: rawBookmarkRows.length - bookmarkRows.length,
        duplicates: summarizeDuplicateKeys(
          rawBookmarkRows,
          (bookmark) => bookmark.source_uid,
        ),
      });
    }

    const { error: bookmarksError } = await serviceClient
      .from("bookmarks")
      .upsert(bookmarkRows, { onConflict: "user_id,source_uid" });

    const { error: deleteError } = await serviceClient.storage
      .from(bucket)
      .remove([filePath]);

    if (bookmarksError) {
      console.error("[import-sqlite] bookmarks import failed", {
        userId,
        fileName: file.name,
        filePath,
        parsedBookmarks: parsedPayload.bookmarks.length,
        bookmarkRows: bookmarkRows.length,
        parsedBookmarkDuplicates,
        deleteError: deleteError?.message ?? null,
        error: bookmarksError.message,
      });
      return NextResponse.json(
        {
          error: `Bookmarks import failed: ${bookmarksError.message}`,
          details: {
            parsedBookmarks: parsedPayload.bookmarks.length,
            dedupedBookmarks: bookmarkRows.length,
            parsedBookmarkDuplicates,
            deleteError: deleteError?.message ?? null,
          },
        },
        { status: 400 },
      );
    }

    await serviceClient.from("import_runs").insert({
      user_id: userId,
      file_name: file.name,
      books_count: bookRows.length,
      bookmarks_count: bookmarkRows.length,
      delete_error: deleteError?.message ?? null,
    });

    console.info("[import-sqlite] import completed", {
      userId,
      fileName: file.name,
      books: bookRows.length,
      bookmarks: bookmarkRows.length,
      fileDeleted: !deleteError,
      deleteError: deleteError?.message ?? null,
    });

    return NextResponse.json({
      books: bookRows.length,
      bookmarks: bookmarkRows.length,
      fileDeleted: !deleteError,
      deleteError: deleteError?.message ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected import failure";

    console.error("[import-sqlite] unexpected failure", {
      error: message,
      stack: error instanceof Error ? (error.stack ?? null) : null,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
