import assert from "node:assert/strict";
import test from "node:test";

const {
  BOOK_LIST_RESUME_STORAGE_KEY,
  BOOK_LIST_RESUME_STORAGE_VERSION,
  clearStoredBookListResumeState,
  loadStoredBookListResumeState,
  saveStoredBookListResumeState,
} = (await import(
  new URL("./book-list-resume-storage.ts", import.meta.url).href
)) as typeof import("./book-list-resume-storage");

test("book list resume storage key stays versioned", () => {
  assert.equal(BOOK_LIST_RESUME_STORAGE_VERSION, 1);
  assert.equal(BOOK_LIST_RESUME_STORAGE_KEY, "book-repeat-book-list-resume:v1");
});

test("book list resume storage saves and loads the last clicked book", () => {
  const storage = createStorage();

  saveStoredBookListResumeState(storage, {
    bookId: "book-55",
    savedAt: 123456,
  });

  assert.deepEqual(loadStoredBookListResumeState(storage), {
    bookId: "book-55",
    savedAt: 123456,
  });
});

test("book list resume storage rejects corrupted payloads", () => {
  const storage = createStorage({
    "book-repeat-book-list-resume:v1": JSON.stringify({
      bookId: 7,
      savedAt: "123",
    }),
  });

  assert.equal(loadStoredBookListResumeState(storage), null);
});

test("book list resume storage tolerates storage access failures", () => {
  const storage = createThrowingStorage();

  assert.doesNotThrow(() => {
    saveStoredBookListResumeState(storage, {
      bookId: "book-1",
      savedAt: 1,
    });
  });
  assert.equal(loadStoredBookListResumeState(storage), null);
  assert.doesNotThrow(() => clearStoredBookListResumeState(storage));
});

function createStorage(seed: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return values.has(key) ? (values.get(key) ?? null) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createThrowingStorage(): StorageLike {
  return {
    getItem() {
      throw new Error("get failed");
    },
    setItem() {
      throw new Error("set failed");
    },
    removeItem() {
      throw new Error("remove failed");
    },
  };
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
