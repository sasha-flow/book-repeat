import type { BookmarkFilter } from "./domain";

export const BOOKMARK_RESUME_STORAGE_VERSION = 1;
export const BOOKMARK_RESUME_STORAGE_PREFIX = "book-repeat-bookmark-resume";

export interface BookmarkResumeState {
  bookmarkFilter: BookmarkFilter;
  bookmarkId: string | null;
  paragraph: number;
  word: number;
  savedAt: number;
}

export interface BookmarkResumeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function getBookmarkResumeStorageKey(bookId: string): string {
  return `${BOOKMARK_RESUME_STORAGE_PREFIX}:v${BOOKMARK_RESUME_STORAGE_VERSION}:${bookId}`;
}

export function loadStoredBookmarkResumeState(
  storage: BookmarkResumeStorageLike,
  bookId: string,
): BookmarkResumeState | null {
  try {
    const rawValue = storage.getItem(getBookmarkResumeStorageKey(bookId));

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    return isBookmarkResumeState(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function saveStoredBookmarkResumeState(
  storage: BookmarkResumeStorageLike,
  bookId: string,
  state: BookmarkResumeState,
): void {
  try {
    storage.setItem(getBookmarkResumeStorageKey(bookId), JSON.stringify(state));
  } catch {
    // Ignore storage failures so resume state never breaks the reader.
  }
}

export function clearStoredBookmarkResumeState(
  storage: BookmarkResumeStorageLike,
  bookId: string,
): void {
  try {
    storage.removeItem(getBookmarkResumeStorageKey(bookId));
  } catch {
    // Ignore storage failures so cleanup never breaks the reader.
  }
}

function isBookmarkFilter(value: unknown): value is BookmarkFilter {
  return value === "all" || value === "without-hidden" || value === "reading";
}

function isBookmarkResumeState(value: unknown): value is BookmarkResumeState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isBookmarkFilter(candidate.bookmarkFilter) &&
    (typeof candidate.bookmarkId === "string" ||
      candidate.bookmarkId === null) &&
    typeof candidate.paragraph === "number" &&
    Number.isFinite(candidate.paragraph) &&
    typeof candidate.word === "number" &&
    Number.isFinite(candidate.word) &&
    typeof candidate.savedAt === "number" &&
    Number.isFinite(candidate.savedAt)
  );
}
