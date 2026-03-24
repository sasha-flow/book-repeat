import assert from "node:assert/strict";
import test from "node:test";

const {
  createBooksSearchState,
  openBooksSearch,
  updateBooksSearchQuery,
  clearBooksSearchQuery,
  dismissBooksSearch,
} = (await import(
  new URL("./books-search-state.ts", import.meta.url).href
)) as typeof import("./books-search-state");

test("books search starts closed with an empty query", () => {
  assert.deepEqual(createBooksSearchState(), {
    isOpen: false,
    query: "",
  });
});

test("opening books search keeps the current query and marks search open", () => {
  assert.deepEqual(
    openBooksSearch({
      isOpen: false,
      query: "anne",
    }),
    {
      isOpen: true,
      query: "anne",
    },
  );
});

test("updating the query preserves the current open state", () => {
  assert.deepEqual(
    updateBooksSearchQuery(
      {
        isOpen: true,
        query: "ann",
      },
      "anna",
    ),
    {
      isOpen: true,
      query: "anna",
    },
  );
});

test("clearing the query keeps books search open", () => {
  assert.deepEqual(
    clearBooksSearchQuery({
      isOpen: true,
      query: "wolf hall",
    }),
    {
      isOpen: true,
      query: "",
    },
  );
});

test("dismissal closes books search and clears the query", () => {
  assert.deepEqual(
    dismissBooksSearch({
      isOpen: true,
      query: "filtered",
    }),
    {
      isOpen: false,
      query: "",
    },
  );
});
