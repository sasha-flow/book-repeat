import assert from "node:assert/strict";
import test from "node:test";

const { planCanonicalBookImports } = (await import(
  new URL("./book-import-plan.ts", import.meta.url).href
)) as typeof import("./book-import-plan");

test("planCanonicalBookImports groups overlapping imported source books into one new canonical book", () => {
  const plan = planCanonicalBookImports(
    [
      {
        source_book_id: 10,
        title: "Alpha",
        authors: "One",
        source_hashes: ["hash-1", "hash-2"],
      },
      {
        source_book_id: 11,
        title: "Alpha",
        authors: "One",
        source_hashes: ["hash-2", "hash-3"],
      },
    ],
    [],
  );

  assert.deepEqual(plan.groups, [
    {
      sourceBookIds: [10, 11],
      sourceHashes: ["hash-1", "hash-2", "hash-3"],
      matchedExistingBookIds: [],
      winnerBookId: null,
      loserBookIds: [],
      title: "Alpha",
      authors: "One",
      hasMetadataConflicts: false,
    },
  ]);

  assert.deepEqual([...plan.sourceBookToGroup.entries()], [
    [10, 0],
    [11, 0],
  ]);
});

test("planCanonicalBookImports picks a deterministic winner when one hash set bridges two canonical books", () => {
  const plan = planCanonicalBookImports(
    [
      {
        source_book_id: 20,
        title: "Merged Title",
        authors: "Merged Author",
        source_hashes: ["hash-501", "hash-502", "hash-553"],
      },
    ],
    [
      { source_hash: "hash-501", book_id: "book-b" },
      { source_hash: "hash-502", book_id: "book-a" },
    ],
  );

  assert.deepEqual(plan.groups, [
    {
      sourceBookIds: [20],
      sourceHashes: ["hash-501", "hash-502", "hash-553"],
      matchedExistingBookIds: ["book-a", "book-b"],
      winnerBookId: "book-a",
      loserBookIds: ["book-b"],
      title: "Merged Title",
      authors: "Merged Author",
      hasMetadataConflicts: false,
    },
  ]);
});