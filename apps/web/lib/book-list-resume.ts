import type { BookRecord } from "./domain";
import type { BookListResumeState } from "./book-list-resume-storage";

export interface BookListResumeScrollTargetOptions {
  itemTop: number;
  itemHeight: number;
  scrollY: number;
  viewportHeight: number;
  topInset?: number;
  bottomInset?: number;
}

export function findRestoreBook(
  books: BookRecord[],
  state: BookListResumeState | null,
): BookRecord | null {
  if (!state) {
    return null;
  }

  return books.find((book) => book.id === state.bookId) ?? null;
}

export function getBookListResumeScrollTop({
  itemTop,
  itemHeight,
  scrollY,
  viewportHeight,
  topInset = 0,
  bottomInset = 0,
}: BookListResumeScrollTargetOptions): number {
  const visibleHeight = Math.max(0, viewportHeight - topInset - bottomInset);
  const visibleCenter = topInset + visibleHeight / 2;
  const absoluteItemTop = itemTop + scrollY;

  return Math.max(0, absoluteItemTop - visibleCenter + itemHeight / 2);
}
