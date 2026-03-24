import assert from "node:assert/strict";
import test from "node:test";

import type { BookRecord } from "./domain";

const { findRestoreBook, getBookListResumeScrollTop } = (await import(
  new URL("./book-list-resume.ts", import.meta.url).href
)) as typeof import("./book-list-resume");

test("book list resume restores the exact saved book when it still exists", () => {
  const books = [createBook("book-1", "Alpha"), createBook("book-2", "Beta")];

  assert.equal(
    findRestoreBook(books, {
      bookId: "book-2",
      savedAt: 100,
    })?.id,
    "book-2",
  );
});

test("book list resume returns null when the saved book is gone", () => {
  const books = [createBook("book-1", "Alpha")];

  assert.equal(
    findRestoreBook(books, {
      bookId: "book-9",
      savedAt: 100,
    }),
    null,
  );
});

test("book list resume centers the target book inside the visible list area", () => {
  assert.equal(
    getBookListResumeScrollTop({
      itemTop: 420,
      itemHeight: 60,
      scrollY: 100,
      viewportHeight: 800,
      bottomInset: 100,
    }),
    200,
  );
});

test("book list resume clamps to the top when there are not enough books before the target", () => {
  assert.equal(
    getBookListResumeScrollTop({
      itemTop: 40,
      itemHeight: 60,
      scrollY: 0,
      viewportHeight: 800,
      bottomInset: 100,
    }),
    0,
  );
});

function createBook(id: string, title: string): BookRecord {
  return {
    id,
    title,
    authors: null,
  };
}
