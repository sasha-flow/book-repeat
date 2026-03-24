import assert from "node:assert/strict";
import test from "node:test";

const { BOOKS_SEARCH_BAR_HEIGHT, getBooksListResumeInsets } = (await import(
  new URL("./books-screen-layout.ts", import.meta.url).href
)) as typeof import("./books-screen-layout");

test("books search bar height stays stable for shell layout calculations", () => {
  assert.equal(BOOKS_SEARCH_BAR_HEIGHT, 69.079);
});

test("books list resume ignores bottom insets when search is closed", () => {
  assert.deepEqual(
    getBooksListResumeInsets({
      searchOpen: false,
      keyboardOpen: false,
    }),
    {
      topInset: 0,
      bottomInset: 0,
    },
  );
});

test("books list resume reserves the search bar height while search is open", () => {
  assert.deepEqual(
    getBooksListResumeInsets({
      searchOpen: true,
      keyboardOpen: false,
    }),
    {
      topInset: 0,
      bottomInset: 69.079,
    },
  );
});

test("books list resume moves the search bar inset to the top while keyboard is open", () => {
  assert.deepEqual(
    getBooksListResumeInsets({
      searchOpen: true,
      keyboardOpen: true,
    }),
    {
      topInset: 69.079,
      bottomInset: 0,
    },
  );
});
