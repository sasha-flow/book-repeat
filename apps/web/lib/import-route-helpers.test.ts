import assert from "node:assert/strict";
import test from "node:test";

const {
  DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE,
  buildImportFailurePayload,
  getExistingAliasesBatched,
  normalizeImportError,
} = (await import(
  new URL("./import-route-helpers.ts", import.meta.url).href
)) as typeof import("./import-route-helpers");

test("getExistingAliasesBatched splits large source hash lookups into bounded chunks", async () => {
  const observedChunks: string[][] = [];

  const serviceClient = {
    from(table: string) {
      assert.equal(table, "book_source_hashes");

      return {
        select(columns: string) {
          assert.equal(columns, "source_hash, book_id");

          return {
            eq(column: string, value: string) {
              assert.equal(column, "user_id");
              assert.equal(value, "user-1");

              return {
                async in(inColumn: string, values: string[]) {
                  assert.equal(inColumn, "source_hash");
                  observedChunks.push(values);

                  return {
                    data: values.slice(0, 1).map((source_hash) => ({
                      source_hash,
                      book_id: `book-for-${source_hash}`,
                    })),
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const sourceHashes = Array.from(
    { length: DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE * 2 + 1 },
    (_, index) => `hash-${index + 1}`,
  );

  const result = await getExistingAliasesBatched(
    serviceClient,
    "user-1",
    sourceHashes,
  );

  assert.equal(result.error, null);
  assert.equal(result.chunkCount, 3);
  assert.deepEqual(result.chunkSizes, [
    DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE,
    DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE,
    1,
  ]);
  assert.equal(observedChunks.length, 3);
  assert.deepEqual(
    observedChunks[0],
    sourceHashes.slice(0, DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE),
  );
  assert.deepEqual(
    observedChunks[1],
    sourceHashes.slice(
      DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE,
      DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE * 2,
    ),
  );
  assert.deepEqual(
    observedChunks[2],
    sourceHashes.slice(DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE * 2),
  );
  assert.deepEqual(result.data, [
    { source_hash: "hash-1", book_id: "book-for-hash-1" },
    {
      source_hash: `hash-${DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE + 1}`,
      book_id: `book-for-hash-${DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE + 1}`,
    },
    {
      source_hash: `hash-${DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE * 2 + 1}`,
      book_id: `book-for-hash-${DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE * 2 + 1}`,
    },
  ]);
});

test("normalizeImportError keeps message stack cause and enumerable properties", () => {
  const rootCause = Object.assign(new Error("root cause"), {
    code: "SQLITE_BUSY",
  });
  const error = Object.assign(
    new Error("top level failure", { cause: rootCause }),
    {
      code: "PGRST123",
      details: "uri exceeds gateway limit",
      hint: "split the query",
    },
  );

  const normalized = normalizeImportError(error);

  assert.equal(normalized.name, "Error");
  assert.equal(normalized.message, "top level failure");
  assert.equal(normalized.code, "PGRST123");
  assert.equal(normalized.details, "uri exceeds gateway limit");
  assert.equal(normalized.hint, "split the query");
  assert.match(String(normalized.stack ?? ""), /top level failure/);
  assert.deepEqual(normalized.cause, {
    name: "Error",
    message: "root cause",
    code: "SQLITE_BUSY",
    stack: rootCause.stack,
  });
});

test("buildImportFailurePayload hides internal details from the user-facing message", () => {
  const payload = buildImportFailurePayload({
    requestId: "req-123",
    stage: "alias-lookup",
    publicMessage: "Books import failed.",
    details: {
      sourceHashCount: 245,
      cleanupError: null,
      internalError: "URI too long",
    },
  });

  assert.equal(
    payload.error,
    "Books import failed. Reference request req-123.",
  );
  assert.deepEqual(payload.details, {
    requestId: "req-123",
    stage: "alias-lookup",
    sourceHashCount: 245,
    cleanupError: null,
  });
  assert.ok(!("internalError" in payload.details));
});
