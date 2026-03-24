import assert from "node:assert/strict";
import test from "node:test";

const {
  BOOKMARK_RESUME_STORAGE_VERSION,
  BOOKMARK_RESUME_STORAGE_PREFIX,
  clearStoredBookmarkResumeState,
  getBookmarkResumeStorageKey,
  loadStoredBookmarkResumeState,
  saveStoredBookmarkResumeState,
} = (await import(
  new URL("./bookmark-resume-storage.ts", import.meta.url).href
)) as typeof import("./bookmark-resume-storage");

test("bookmark resume storage key is versioned per book", () => {
  assert.equal(BOOKMARK_RESUME_STORAGE_VERSION, 1);
  assert.equal(BOOKMARK_RESUME_STORAGE_PREFIX, "book-repeat-bookmark-resume");
  assert.equal(
    getBookmarkResumeStorageKey("book-123"),
    "book-repeat-bookmark-resume:v1:book-123",
  );
});

test("bookmark resume storage saves and reloads valid state", () => {
  const storage = createStorage();

  saveStoredBookmarkResumeState(storage, "book-123", {
    bookmarkFilter: "reading",
    bookmarkId: "bookmark-55",
    paragraph: 8,
    word: 13,
    savedAt: 123456,
  });

  assert.deepEqual(loadStoredBookmarkResumeState(storage, "book-123"), {
    bookmarkFilter: "reading",
    bookmarkId: "bookmark-55",
    paragraph: 8,
    word: 13,
    savedAt: 123456,
  });
});

test("bookmark resume storage rejects corrupted payloads", () => {
  const storage = createStorage({
    "book-repeat-bookmark-resume:v1:book-123": JSON.stringify({
      bookmarkFilter: "invalid",
      bookmarkId: 7,
      paragraph: "8",
      word: 9,
      savedAt: 10,
    }),
  });

  assert.equal(loadStoredBookmarkResumeState(storage, "book-123"), null);
});

test("bookmark resume storage tolerates storage access failures", () => {
  const storage = createThrowingStorage();

  assert.doesNotThrow(() => {
    saveStoredBookmarkResumeState(storage, "book-123", {
      bookmarkFilter: "all",
      bookmarkId: null,
      paragraph: 0,
      word: 0,
      savedAt: 1,
    });
  });
  assert.equal(loadStoredBookmarkResumeState(storage, "book-123"), null);
  assert.doesNotThrow(() =>
    clearStoredBookmarkResumeState(storage, "book-123"),
  );
});

test("bookmark resume storage clears saved state", () => {
  const storage = createStorage();

  saveStoredBookmarkResumeState(storage, "book-123", {
    bookmarkFilter: "without-hidden",
    bookmarkId: "bookmark-10",
    paragraph: 3,
    word: 21,
    savedAt: 99,
  });
  clearStoredBookmarkResumeState(storage, "book-123");

  assert.equal(loadStoredBookmarkResumeState(storage, "book-123"), null);
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
