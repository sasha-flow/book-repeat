import assert from "node:assert/strict";
import test from "node:test";

import type { BookmarkRecord } from "./domain";

const { findCurrentBookmarkResumeAnchor, findRestoreBookmark } = (await import(
  new URL("./bookmark-resume.ts", import.meta.url).href
)) as typeof import("./bookmark-resume");

test("bookmark resume picks the highest visible bookmark start below the header", () => {
  assert.deepEqual(
    findCurrentBookmarkResumeAnchor({
      headerBottom: 80,
      rows: [
        createRow("bookmark-1", 70, 140, 1, 5),
        createRow("bookmark-2", 92, 160, 2, 1),
        createRow("bookmark-3", 150, 220, 3, 1),
      ],
    }),
    {
      bookmarkId: "bookmark-2",
      paragraph: 2,
      word: 1,
    },
  );
});

test("bookmark resume ignores rows whose start is already hidden behind the header", () => {
  assert.equal(
    findCurrentBookmarkResumeAnchor({
      headerBottom: 80,
      rows: [
        createRow("bookmark-1", 40, 140, 1, 5),
        createRow("bookmark-2", 50, 150, 2, 1),
      ],
    }),
    null,
  );
});

test("bookmark resume restores the exact saved bookmark when it is still visible", () => {
  const bookmarks = [
    createBookmark("bookmark-1", 1, 1),
    createBookmark("bookmark-2", 2, 5),
    createBookmark("bookmark-3", 4, 2),
  ];

  assert.equal(
    findRestoreBookmark(bookmarks, {
      bookmarkFilter: "reading",
      bookmarkId: "bookmark-2",
      paragraph: 2,
      word: 5,
      savedAt: 10,
    })?.id,
    "bookmark-2",
  );
});

test("bookmark resume falls forward to the next visible bookmark in source order", () => {
  const bookmarks = [
    createBookmark("bookmark-1", 1, 1),
    createBookmark("bookmark-3", 4, 2),
    createBookmark("bookmark-4", 7, 9),
  ];

  assert.equal(
    findRestoreBookmark(bookmarks, {
      bookmarkFilter: "without-hidden",
      bookmarkId: "bookmark-2",
      paragraph: 2,
      word: 5,
      savedAt: 10,
    })?.id,
    "bookmark-3",
  );
});

test("bookmark resume falls back to the first visible bookmark when the saved anchor is after the list", () => {
  const bookmarks = [
    createBookmark("bookmark-1", 1, 1),
    createBookmark("bookmark-2", 2, 5),
  ];

  assert.equal(
    findRestoreBookmark(bookmarks, {
      bookmarkFilter: "all",
      bookmarkId: "bookmark-9",
      paragraph: 99,
      word: 99,
      savedAt: 10,
    })?.id,
    "bookmark-1",
  );
});

function createBookmark(
  id: string,
  paragraph: number,
  word: number,
): BookmarkRecord {
  return {
    id,
    book_id: "book-123",
    bookmark_text: id,
    paragraph,
    word,
    bookmark_type: "default",
  };
}

function createRow(
  bookmarkId: string,
  top: number,
  bottom: number,
  paragraph: number,
  word: number,
) {
  return {
    bookmarkId,
    top,
    bottom,
    paragraph,
    word,
  };
}
