import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildImportFailurePayload,
  createImportRequestId,
  getExistingAliasesBatched,
  logImportEvent,
  normalizeImportError,
  type ImportLogContext,
} from "../../../lib/import-route-helpers";
import {
  planCanonicalBookImports,
  type CanonicalBookImportGroup,
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
  context: ImportLogContext,
) {
  logImportEvent("info", "cleanup started", {
    ...context,
    stage: "cleanup-uploaded-file",
  });

  const { error } = await serviceClient.storage.from(bucket).remove([filePath]);

  if (error) {
    logImportEvent(
      "warn",
      "cleanup failed",
      {
        ...context,
        stage: "cleanup-uploaded-file",
      },
      {
        error: normalizeImportError(error),
      },
    );

    return error;
  }

  logImportEvent("info", "cleanup completed", {
    ...context,
    stage: "cleanup-uploaded-file",
  });

  return null;
}

async function createCanonicalBook(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  group: CanonicalBookImportGroup,
): Promise<{ id: string | null; error: unknown }> {
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
    error,
  };
}

async function updateCanonicalBookMetadata(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  bookId: string,
  group: CanonicalBookImportGroup,
): Promise<unknown> {
  const { error } = await serviceClient
    .from("books")
    .update({
      title: group.title,
      authors: group.authors,
    })
    .eq("user_id", userId)
    .eq("id", bookId);

  return error;
}

async function mergeCanonicalBooks(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  winnerBookId: string,
  loserBookIds: string[],
): Promise<{ data: MergeBooksRpcResult | null; error: unknown }> {
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
    error,
  };
}

function getImportFileExtension(fileName: string): string {
  const trimmedName = fileName.trim();
  const dotIndex = trimmedName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === trimmedName.length - 1) {
    return ".sqlite";
  }

  const extension = trimmedName.slice(dotIndex).toLowerCase();

  if (extension.length > 16) {
    return ".sqlite";
  }

  return extension;
}

function buildImportStorageFilePath(
  userId: string,
  requestId: string,
  fileName: string,
): string {
  return `${userId}/${Date.now()}-${requestId}${getImportFileExtension(fileName)}`;
}

export async function POST(request: Request) {
  const requestId = createImportRequestId();
  const bucket = process.env.SUPABASE_IMPORT_BUCKET ?? "imports";
  let currentStage = "request-received";
  let importContext: ImportLogContext = {
    requestId,
    stage: currentStage,
    userId: null,
    fileName: null,
    fileSize: null,
    bucket,
    filePath: null,
  };

  try {
    logImportEvent("info", "request received", importContext, {
      contentLength: request.headers.get("content-length"),
      contentType: request.headers.get("content-type"),
      hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
    });

    const accessToken = request.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!accessToken) {
      logImportEvent("warn", "authorization token missing", importContext);
      return NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 },
      );
    }

    currentStage = "form-data-parse";
    importContext = { ...importContext, stage: currentStage };
    logImportEvent("info", "form data parse started", importContext);

    const formData = await request.formData();
    const sourceFile = formData.get("file");

    logImportEvent("info", "form data parsed", importContext, {
      hasFileField: sourceFile instanceof File,
    });

    const parsedFile = fileSchema.safeParse(sourceFile);

    if (!parsedFile.success) {
      logImportEvent("warn", "file validation failed", importContext, {
        issues: parsedFile.error.issues,
      });
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const file = parsedFile.data;
    importContext = {
      ...importContext,
      fileName: file.name,
      fileSize: file.size,
    };
    const serviceClient = getSupabaseServiceClient();

    currentStage = "auth-user";
    importContext = { ...importContext, stage: currentStage };

    const { data: authData, error: authError } =
      await serviceClient.auth.getUser(accessToken);

    if (authError || !authData.user) {
      logImportEvent("warn", "authorization failed", importContext, {
        error: authError ? normalizeImportError(authError) : null,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;
    const filePath = buildImportStorageFilePath(userId, requestId, file.name);
    importContext = {
      ...importContext,
      userId,
      bucket,
      filePath,
    };

    currentStage = "import-started";
    importContext = { ...importContext, stage: currentStage };
    logImportEvent("info", "import started", importContext, {
      originalFileName: file.name,
    });

    currentStage = "read-buffer";
    importContext = { ...importContext, stage: currentStage };
    logImportEvent("info", "file buffer read started", importContext);
    const fileBuffer = await file.arrayBuffer();

    logImportEvent("info", "file buffer read completed", importContext, {
      bufferBytes: fileBuffer.byteLength,
    });

    currentStage = "storage-upload";
    importContext = { ...importContext, stage: currentStage };
    logImportEvent("info", "storage upload started", importContext);
    const { error: uploadError } = await serviceClient.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        upsert: false,
        contentType: "application/x-sqlite3",
      });

    if (uploadError) {
      logImportEvent("error", "storage upload failed", importContext, {
        error: normalizeImportError(uploadError),
      });
      return NextResponse.json(
        buildImportFailurePayload({
          requestId,
          stage: currentStage,
          publicMessage: "Upload failed.",
        }),
        { status: 400 },
      );
    }

    logImportEvent("info", "storage upload completed", importContext);

    currentStage = "parse-sqlite";
    importContext = { ...importContext, stage: currentStage };
    logImportEvent("info", "sqlite parsing started", importContext);
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

    logImportEvent("info", "sqlite parsing completed", importContext, {
      sourceTables: parsedPayload.diagnostics.sourceTables,
      parsedBooks: parsedPayload.books.length,
      parsedBookmarks: parsedPayload.bookmarks.length,
      parsedSourceBookDuplicates,
      parsedSourceHashDuplicates,
      parsedBookmarkDuplicates,
      totalSourceHashes: allSourceHashes.length,
      bookHashDiagnostics: parsedPayload.diagnostics.bookHash,
    });

    currentStage = "alias-lookup";
    importContext = { ...importContext, stage: currentStage };
    logImportEvent("info", "alias lookup started", importContext, {
      sourceHashCount: allSourceHashes.length,
    });

    const {
      data: existingAliases,
      error: aliasesLookupError,
      chunkCount,
      chunkSizes,
    } = await getExistingAliasesBatched(serviceClient, userId, allSourceHashes);

    if (aliasesLookupError) {
      const cleanupError = await cleanupUploadedFile(
        serviceClient,
        bucket,
        filePath,
        importContext,
      );

      logImportEvent("error", "alias lookup failed", importContext, {
        sourceHashCount: allSourceHashes.length,
        chunkCount,
        chunkSizes,
        cleanupFailed: cleanupError !== null,
        error: normalizeImportError(aliasesLookupError),
      });

      return NextResponse.json(
        buildImportFailurePayload({
          requestId,
          stage: currentStage,
          publicMessage: "Books import failed.",
          details: {
            sourceHashCount: allSourceHashes.length,
            chunkCount,
            chunkSizes,
            cleanupFailed: cleanupError !== null,
          },
        }),
        { status: 400 },
      );
    }

    logImportEvent("info", "alias lookup completed", importContext, {
      sourceHashCount: allSourceHashes.length,
      matchedAliases: existingAliases.length,
      chunkCount,
      chunkSizes,
    });

    const importPlan = planCanonicalBookImports(
      parsedPayload.books,
      existingAliases,
    );
    const metadataConflictGroups = importPlan.groups
      .filter((group) => group.hasMetadataConflicts)
      .map((group) => group.sourceBookIds);

    currentStage = "canonical-plan";
    importContext = { ...importContext, stage: currentStage };
    logImportEvent("info", "canonical plan ready", importContext, {
      matchedAliases: existingAliases.length,
      groupCount: importPlan.groups.length,
      groupsCreatingBooks: importPlan.groups.filter(
        (group) => group.winnerBookId === null,
      ).length,
      groupsMergingBooks: importPlan.groups.filter(
        (group) => group.loserBookIds.length > 0,
      ).length,
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

      currentStage = "book-create";
      importContext = { ...importContext, stage: currentStage };
      const { id, error } = await createCanonicalBook(
        serviceClient,
        userId,
        group,
      );

      if (error || !id) {
        const cleanupError = await cleanupUploadedFile(
          serviceClient,
          bucket,
          filePath,
          importContext,
        );

        logImportEvent(
          "error",
          "canonical book creation failed",
          importContext,
          {
            group,
            cleanupFailed: cleanupError !== null,
            error: error
              ? normalizeImportError(error)
              : "Book insert returned no id",
          },
        );

        return NextResponse.json(
          buildImportFailurePayload({
            requestId,
            stage: currentStage,
            publicMessage: "Books import failed.",
            details: {
              group,
              cleanupFailed: cleanupError !== null,
            },
          }),
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

      currentStage = "book-merge";
      importContext = { ...importContext, stage: currentStage };
      const { data, error } = await mergeCanonicalBooks(
        serviceClient,
        userId,
        winnerBookId,
        group.loserBookIds,
      );

      if (error || !data) {
        const cleanupError = await cleanupUploadedFile(
          serviceClient,
          bucket,
          filePath,
          importContext,
        );

        logImportEvent("error", "canonical book merge failed", importContext, {
          winnerBookId,
          loserBookIds: group.loserBookIds,
          cleanupFailed: cleanupError !== null,
          error: error
            ? normalizeImportError(error)
            : "Merge RPC returned no data",
        });

        return NextResponse.json(
          buildImportFailurePayload({
            requestId,
            stage: currentStage,
            publicMessage: "Books import failed.",
            details: {
              winnerBookId,
              loserBookIds: group.loserBookIds,
              cleanupFailed: cleanupError !== null,
            },
          }),
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

      currentStage = "book-metadata-update";
      importContext = { ...importContext, stage: currentStage };
      const error = await updateCanonicalBookMetadata(
        serviceClient,
        userId,
        bookId,
        group,
      );

      if (error) {
        metadataUpdateFailures.push({
          bookId,
          error: JSON.stringify(normalizeImportError(error)),
        });
      }
    }

    if (metadataUpdateFailures.length > 0) {
      currentStage = "book-metadata-update";
      importContext = { ...importContext, stage: currentStage };
      const cleanupError = await cleanupUploadedFile(
        serviceClient,
        bucket,
        filePath,
        importContext,
      );

      logImportEvent(
        "error",
        "canonical book metadata update failed",
        importContext,
        {
          failures: metadataUpdateFailures,
          cleanupFailed: cleanupError !== null,
        },
      );

      return NextResponse.json(
        buildImportFailurePayload({
          requestId,
          stage: currentStage,
          publicMessage: "Books import failed.",
          details: {
            failures: metadataUpdateFailures,
            cleanupFailed: cleanupError !== null,
          },
        }),
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

    currentStage = "alias-upsert";
    importContext = { ...importContext, stage: currentStage };
    const { error: aliasUpsertError } = aliasRows.length
      ? await serviceClient
          .from("book_source_hashes")
          .upsert(aliasRows, { onConflict: "user_id,source_hash" })
      : { error: null };

    if (aliasUpsertError) {
      const cleanupError = await cleanupUploadedFile(
        serviceClient,
        bucket,
        filePath,
        importContext,
      );

      logImportEvent("error", "alias upsert failed", importContext, {
        aliasRows: aliasRows.length,
        cleanupFailed: cleanupError !== null,
        error: normalizeImportError(aliasUpsertError),
      });

      return NextResponse.json(
        buildImportFailurePayload({
          requestId,
          stage: currentStage,
          publicMessage: "Books import failed.",
          details: {
            aliasRows: aliasRows.length,
            cleanupFailed: cleanupError !== null,
          },
        }),
        { status: 400 },
      );
    }

    const booksMap = new Map<number, string>();

    for (const [
      sourceBookId,
      groupIndex,
    ] of importPlan.sourceBookToGroup.entries()) {
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
    const unmappedBookmarkCount =
      parsedPayload.bookmarks.length - rawBookmarkRows.length;
    const bookmarkRows = dedupeRowsByKey(
      rawBookmarkRows,
      (bookmark) => bookmark.source_uid,
    );

    if (bookmarkRows.length !== rawBookmarkRows.length) {
      logImportEvent(
        "warn",
        "deduplicated bookmark rows before upsert",
        importContext,
        {
          removedRows: rawBookmarkRows.length - bookmarkRows.length,
          duplicates: summarizeDuplicateKeys(
            rawBookmarkRows,
            (bookmark) => bookmark.source_uid,
          ),
        },
      );
    }

    if (unmappedBookmarkCount > 0) {
      logImportEvent(
        "warn",
        "skipped bookmarks without canonical book mapping",
        importContext,
        {
          unmappedBookmarkCount,
        },
      );
    }

    currentStage = "bookmarks-upsert";
    importContext = { ...importContext, stage: currentStage };
    const { error: bookmarksError } = await serviceClient
      .from("bookmarks")
      .upsert(bookmarkRows, { onConflict: "user_id,source_uid" });

    const deleteError = await cleanupUploadedFile(
      serviceClient,
      bucket,
      filePath,
      importContext,
    );

    if (bookmarksError) {
      logImportEvent("error", "bookmarks import failed", importContext, {
        parsedBookmarks: parsedPayload.bookmarks.length,
        bookmarkRows: bookmarkRows.length,
        unmappedBookmarkCount,
        parsedBookmarkDuplicates,
        cleanupFailed: deleteError !== null,
        error: normalizeImportError(bookmarksError),
      });
      return NextResponse.json(
        buildImportFailurePayload({
          requestId,
          stage: currentStage,
          publicMessage: "Bookmarks import failed.",
          details: {
            parsedBookmarks: parsedPayload.bookmarks.length,
            dedupedBookmarks: bookmarkRows.length,
            unmappedBookmarkCount,
            parsedBookmarkDuplicates,
            cleanupFailed: deleteError !== null,
          },
        }),
        { status: 400 },
      );
    }

    currentStage = "record-import-run";
    importContext = { ...importContext, stage: currentStage };
    const { error: importRunError } = await serviceClient
      .from("import_runs")
      .insert({
        user_id: userId,
        file_name: file.name,
        books_count: importPlan.groups.length,
        bookmarks_count: bookmarkRows.length,
        delete_error: deleteError
          ? JSON.stringify(normalizeImportError(deleteError))
          : null,
      });

    if (importRunError) {
      logImportEvent("warn", "import run record failed", importContext, {
        error: normalizeImportError(importRunError),
      });
    }

    currentStage = "import-completed";
    importContext = { ...importContext, stage: currentStage };
    logImportEvent("info", "import completed", importContext, {
      canonicalBooks: importPlan.groups.length,
      createdBooks: createdBookIds.length,
      mergedGroups: mergeResults.length,
      aliasRows: aliasRows.length,
      bookmarks: bookmarkRows.length,
      unmappedBookmarkCount,
      mergeResults,
      fileDeleted: deleteError === null,
      cleanupFailed: deleteError !== null,
      importRunRecorded: importRunError === null,
    });

    return NextResponse.json({
      requestId,
      books: importPlan.groups.length,
      bookmarks: bookmarkRows.length,
      createdBooks: createdBookIds.length,
      mergedGroups: mergeResults.length,
      aliasRows: aliasRows.length,
      unmappedBookmarks: unmappedBookmarkCount,
      fileDeleted: deleteError === null,
      deleteError:
        deleteError === null
          ? null
          : "File cleanup failed. Check server logs for details.",
    });
  } catch (error) {
    logImportEvent("error", "unexpected failure", importContext, {
      error: normalizeImportError(error),
    });

    return NextResponse.json(
      buildImportFailurePayload({
        requestId,
        stage: currentStage,
        publicMessage: "Import failed unexpectedly.",
      }),
      { status: 500 },
    );
  }
}
