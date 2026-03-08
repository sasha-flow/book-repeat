import { NextResponse } from "next/server";
import { z } from "zod";

import { parseSqlitePayload } from "../../../lib/sqlite-import";
import { getSupabaseServiceClient } from "../../../lib/supabase/service";

const fileSchema = z.instanceof(File);

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

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await serviceClient.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        upsert: false,
        contentType: "application/x-sqlite3",
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 400 },
      );
    }

    const parsedPayload = await parseSqlitePayload(fileBuffer);

    const bookRows = parsedPayload.books.map((book) => ({
      user_id: userId,
      source_uid: book.source_uid,
      title: book.title,
      authors: book.authors,
    }));

    const { data: booksData, error: booksError } = await serviceClient
      .from("books")
      .upsert(bookRows, { onConflict: "user_id,source_uid" })
      .select("id, source_uid");

    if (booksError) {
      await serviceClient.storage.from(bucket).remove([filePath]);
      return NextResponse.json(
        { error: `Books import failed: ${booksError.message}` },
        { status: 400 },
      );
    }

    const booksMap = new Map(
      (booksData ?? []).map((row: { source_uid: string; id: string }) => [
        row.source_uid,
        row.id,
      ]),
    );

    const bookmarkRows = parsedPayload.bookmarks
      .map((bookmark) => {
        const bookId = booksMap.get(bookmark.book_source_uid);

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

    const { error: bookmarksError } = await serviceClient
      .from("bookmarks")
      .upsert(bookmarkRows, { onConflict: "user_id,source_uid" });

    const { error: deleteError } = await serviceClient.storage
      .from(bucket)
      .remove([filePath]);

    if (bookmarksError) {
      return NextResponse.json(
        { error: `Bookmarks import failed: ${bookmarksError.message}` },
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

    return NextResponse.json({
      books: bookRows.length,
      bookmarks: bookmarkRows.length,
      fileDeleted: !deleteError,
      deleteError: deleteError?.message ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected import failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
