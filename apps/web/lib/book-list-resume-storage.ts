export const BOOK_LIST_RESUME_STORAGE_VERSION = 1;
export const BOOK_LIST_RESUME_STORAGE_KEY = `book-repeat-book-list-resume:v${BOOK_LIST_RESUME_STORAGE_VERSION}`;

export interface BookListResumeState {
  bookId: string;
  savedAt: number;
}

export interface BookListResumeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadStoredBookListResumeState(
  storage: BookListResumeStorageLike,
): BookListResumeState | null {
  try {
    const rawValue = storage.getItem(BOOK_LIST_RESUME_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    return isBookListResumeState(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function saveStoredBookListResumeState(
  storage: BookListResumeStorageLike,
  state: BookListResumeState,
): void {
  try {
    storage.setItem(BOOK_LIST_RESUME_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures so list navigation never breaks.
  }
}

export function clearStoredBookListResumeState(
  storage: BookListResumeStorageLike,
): void {
  try {
    storage.removeItem(BOOK_LIST_RESUME_STORAGE_KEY);
  } catch {
    // Ignore storage failures so cleanup never breaks the app.
  }
}

function isBookListResumeState(value: unknown): value is BookListResumeState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.bookId === "string" &&
    candidate.bookId.length > 0 &&
    typeof candidate.savedAt === "number" &&
    Number.isFinite(candidate.savedAt)
  );
}
