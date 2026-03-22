import { NextResponse } from "next/server";
import { z } from "zod";

import {
  planCanonicalBookImports,
  type CanonicalBookImportGroup,
  type ExistingBookHashAlias,
} from "../../../lib/book-import-plan";
import { parseSqlitePayload } from "../../../lib/sqlite-import";
import { getSupabaseServiceClient } from "../../../lib/supabase/service";

const fileSchema = z.instanceof(File);

interface MergeBooksRpcResult {
  movedAliases: number;
  deletedAliases: number;
  movedBookmarks: number;
  deletedBooks: number;
}

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

async function cleanupUploadedFile(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  bucket: string,
  filePath: string,
) {
  const { error } = await serviceClient.storage.from(bucket).remove([filePath]);
  return error?.message ?? null;
}

async function getExistingAliases(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  sourceHashes: string[],
): Promise<{ data: ExistingBookHashAlias[]; error: string | null }> {
  if (sourceHashes.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await serviceClient
    .from("book_source_hashes")
    .select("source_hash, book_id")
    .eq("user_id", userId)
    .in("source_hash", sourceHashes);

  if (error) {
    return { data: [], error: error.message };
  }

  return {
    data: (data ?? []) as ExistingBookHashAlias[],
    error: null,
  };
}

async function createCanonicalBook(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  group: CanonicalBookImportGroup,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await serviceClient
    .from("books")
    .insert({
      user_id: userId,
      title: group.title,
      authors: group.authors,
    })
    .select("id")
    .single();

  return {
    id: error ? null : ((data as { id: string } | null)?.id ?? null),
    error: error?.message ?? null,
  };
}

async function updateCanonicalBookMetadata(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  bookId: string,
  group: CanonicalBookImportGroup,
): Promise<string | null> {
  const { error } = await serviceClient
    .from("books")
    .update({
      title: group.title,
      authors: group.authors,
    })
    .eq("user_id", userId)
    .eq("id", bookId);

  return error?.message ?? null;
}

async function mergeCanonicalBooks(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  winnerBookId: string,
  loserBookIds: string[],
): Promise<{ data: MergeBooksRpcResult | null; error: string | null }> {
  if (loserBookIds.length === 0) {
    return {
      data: {
        movedAliases: 0,
        deletedAliases: 0,
        movedBookmarks: 0,
        deletedBooks: 0,
      },
      error: null,
    };
  }

  const { data, error } = await serviceClient.rpc("merge_user_books", {
    target_user_id: userId,
    winner_book_id: winnerBookId,
    loser_book_ids: loserBookIds,
  });

  return {
    data: error ? null : ((data as MergeBooksRpcResult | null) ?? null),
    error: error?.message ?? null,
  };
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
    const parsedSourceBookDuplicates = summarizeDuplicateKeys(
      parsedPayload.books,
      (book) => String(book.source_book_id),
    );
    const parsedSourceHashDuplicates = summarizeDuplicateKeys(
      parsedPayload.books.flatMap((book) =>
        book.source_hashes.map((sourceHash) => ({ sourceHash })),
      ),
      (entry) => entry.sourceHash,
    );
    const parsedBookmarkDuplicates = summarizeDuplicateKeys(
      parsedPayload.bookmarks,
      (bookmark) => bookmark.source_uid,
    );
    const allSourceHashes = dedupeRowsByKey(
      parsedPayload.books.flatMap((book) =>
        book.source_hashes.map((sourceHash) => ({ sourceHash })),
      ),
      (entry) => entry.sourceHash,
    ).map((entry) => entry.sourceHash);

    console.info("[import-sqlite] parsed payload", {
      userId,
      fileName: file.name,
      sourceTables: parsedPayload.diagnostics.sourceTables,
      parsedBooks: parsedPayload.books.length,
      parsedBookmarks: parsedPayload.bookmarks.length,
      parsedSourceBookDuplicates,
      parsedSourceHashDuplicates,
      parsedBookmarkDuplicates,
      totalSourceHashes: allSourceHashes.length,
      bookHashDiagnostics: parsedPayload.diagnostics.bookHash,
    });

    const { data: existingAliases, error: aliasesLookupError } =
      await getExistingAliases(serviceClient, userId, allSourceHashes);

    if (aliasesLookupError) {
      const cleanupError = await cleanupUploadedFile(serviceClient, bucket, filePath);

      console.error("[import-sqlite] alias lookup failed", {
        userId,
        fileName: file.name,
        filePath,
        sourceHashCount: allSourceHashes.length,
        cleanupError,
        error: aliasesLookupError,
      });

      return NextResponse.json(
        {
          error: `Books import failed: ${aliasesLookupError}`,
          details: {
            stage: "alias-lookup",
            sourceHashCount: allSourceHashes.length,
            cleanupError,
          },
        },
        { status: 400 },
      );
    }

    const importPlan = planCanonicalBookImports(parsedPayload.books, existingAliases);
    const metadataConflictGroups = importPlan.groups
      .filter((group) => group.hasMetadataConflicts)
      .map((group) => group.sourceBookIds);

    console.info("[import-sqlite] canonical plan", {
      userId,
      fileName: file.name,
      matchedAliases: existingAliases.length,
      groupCount: importPlan.groups.length,
      groupsCreatingBooks: importPlan.groups.filter((group) => group.winnerBookId === null).length,
      groupsMergingBooks: importPlan.groups.filter((group) => group.loserBookIds.length > 0).length,
      metadataConflictGroups,
      groups: importPlan.groups,
    });

    const finalBookIdsByGroupIndex = new Map<number, string>();
    const createdBookIds: string[] = [];

    for (const [groupIndex, group] of importPlan.groups.entries()) {
      if (group.winnerBookId !== null) {
        finalBookIdsByGroupIndex.set(groupIndex, group.winnerBookId);
        continue;
      }

      const { id, error } = await createCanonicalBook(serviceClient, userId, group);

      if (error || !id) {
        const cleanupError = await cleanupUploadedFile(serviceClient, bucket, filePath);

        console.error("[import-sqlite] canonical book creation failed", {
          userId,
          fileName: file.name,
          filePath,
          group,
          cleanupError,
          error: error ?? "Book insert returned no id",
        });

        return NextResponse.json(
          {
            error: `Books import failed: ${error ?? "Book insert returned no id"}`,
            details: {
              stage: "book-create",
              group,
              cleanupError,
            },
          },
          { status: 400 },
        );
      }

      createdBookIds.push(id);
      finalBookIdsByGroupIndex.set(groupIndex, id);
    }

    const mergeResults: Array<{
      winnerBookId: string;
      loserBookIds: string[];
      result: MergeBooksRpcResult;
    }> = [];

    for (const [groupIndex, group] of importPlan.groups.entries()) {
      const winnerBookId = finalBookIdsByGroupIndex.get(groupIndex);

      if (!winnerBookId || group.loserBookIds.length === 0) {
        continue;
      }

      const { data, error } = await mergeCanonicalBooks(
        serviceClient,
        userId,
        winnerBookId,
        group.loserBookIds,
      );

      if (error || !data) {
        const cleanupError = await cleanupUploadedFile(serviceClient, bucket, filePath);

        console.error("[import-sqlite] canonical book merge failed", {
          userId,
          fileName: file.name,
          filePath,
          winnerBookId,
          loserBookIds: group.loserBookIds,
          cleanupError,
          error: error ?? "Merge RPC returned no data",
        });

        return NextResponse.json(
          {
            error: `Books import failed: ${error ?? "Merge RPC returned no data"}`,
            details: {
              stage: "book-merge",
              winnerBookId,
              loserBookIds: group.loserBookIds,
              cleanupError,
            },
          },
          { status: 400 },
        );
      }

      mergeResults.push({
        winnerBookId,
        loserBookIds: group.loserBookIds,
        result: data,
      });
    }

    const metadataUpdateFailures: Array<{ bookId: string; error: string }> = [];

    for (const [groupIndex, group] of importPlan.groups.entries()) {
      const bookId = finalBookIdsByGroupIndex.get(groupIndex);

      if (!bookId) {
        continue;
      }

      const error = await updateCanonicalBookMetadata(
        serviceClient,
        userId,
        bookId,
        group,
      );

      if (error) {
        metadataUpdateFailures.push({ bookId, error });
      }
    }

    if (metadataUpdateFailures.length > 0) {
      const cleanupError = await cleanupUploadedFile(serviceClient, bucket, filePath);

      console.error("[import-sqlite] canonical book metadata update failed", {
        userId,
        fileName: file.name,
        filePath,
        failures: metadataUpdateFailures,
        cleanupError,
      });

      return NextResponse.json(
        {
          error: `Books import failed: ${metadataUpdateFailures[0]?.error ?? "Metadata update failed"}`,
          details: {
            stage: "book-metadata-update",
            failures: metadataUpdateFailures,
            cleanupError,
          },
        },
        { status: 400 },
      );
    }

    const aliasRows = dedupeRowsByKey(
      importPlan.groups.flatMap((group, groupIndex) => {
        const bookId = finalBookIdsByGroupIndex.get(groupIndex);

        if (!bookId) {
          return [];
        }

        return group.sourceHashes.map((sourceHash) => ({
          user_id: userId,
          book_id: bookId,
          source_hash: sourceHash,
        }));
      }),
      (row) => row.source_hash,
    );

    const { error: aliasUpsertError } = aliasRows.length
      ? await serviceClient
          .from("book_source_hashes")
          .upsert(aliasRows, { onConflict: "user_id,source_hash" })
      : { error: null };

    if (aliasUpsertError) {
      const cleanupError = await cleanupUploadedFile(serviceClient, bucket, filePath);

      console.error("[import-sqlite] alias upsert failed", {
        userId,
        fileName: file.name,
        filePath,
        aliasRows: aliasRows.length,
        cleanupError,
        error: aliasUpsertError.message,
      });

      return NextResponse.json(
        {
          error: `Books import failed: ${aliasUpsertError.message}`,
          details: {
            stage: "alias-upsert",
            aliasRows: aliasRows.length,
            cleanupError,
          },
        },
        { status: 400 },
      );
    }

    const booksMap = new Map<number, string>();

    for (const [sourceBookId, groupIndex] of importPlan.sourceBookToGroup.entries()) {
      const finalBookId = finalBookIdsByGroupIndex.get(groupIndex);

      if (finalBookId) {
        booksMap.set(sourceBookId, finalBookId);
      }
    }

    const rawBookmarkRows = parsedPayload.bookmarks
      .map((bookmark) => {
        const bookId = booksMap.get(bookmark.source_book_id);

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
    const unmappedBookmarkCount = parsedPayload.bookmarks.length - rawBookmarkRows.length;
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

    if (unmappedBookmarkCount > 0) {
      console.warn("[import-sqlite] skipped bookmarks without canonical book mapping", {
        userId,
        fileName: file.name,
        unmappedBookmarkCount,
      });
    }

    const { error: bookmarksError } = await serviceClient
      .from("bookmarks")
      .upsert(bookmarkRows, { onConflict: "user_id,source_uid" });

    const deleteError = await cleanupUploadedFile(serviceClient, bucket, filePath);

    if (bookmarksError) {
      console.error("[import-sqlite] bookmarks import failed", {
        userId,
        fileName: file.name,
        filePath,
        parsedBookmarks: parsedPayload.bookmarks.length,
        bookmarkRows: bookmarkRows.length,
        unmappedBookmarkCount,
        parsedBookmarkDuplicates,
        deleteError,
        error: bookmarksError.message,
      });
      return NextResponse.json(
        {
          error: `Bookmarks import failed: ${bookmarksError.message}`,
          details: {
            parsedBookmarks: parsedPayload.bookmarks.length,
            dedupedBookmarks: bookmarkRows.length,
            unmappedBookmarkCount,
            parsedBookmarkDuplicates,
            deleteError,
          },
        },
        { status: 400 },
      );
    }

    await serviceClient.from("import_runs").insert({
      user_id: userId,
      file_name: file.name,
      books_count: importPlan.groups.length,
      bookmarks_count: bookmarkRows.length,
      delete_error: deleteError,
    });

    console.info("[import-sqlite] import completed", {
      userId,
      fileName: file.name,
      canonicalBooks: importPlan.groups.length,
      createdBooks: createdBookIds.length,
      mergedGroups: mergeResults.length,
      aliasRows: aliasRows.length,
      bookmarks: bookmarkRows.length,
      unmappedBookmarkCount,
      mergeResults,
      fileDeleted: !deleteError,
      deleteError,
    });

    return NextResponse.json({
      books: importPlan.groups.length,
      bookmarks: bookmarkRows.length,
      createdBooks: createdBookIds.length,
      mergedGroups: mergeResults.length,
      aliasRows: aliasRows.length,
      unmappedBookmarks: unmappedBookmarkCount,
      fileDeleted: !deleteError,
      deleteError,
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