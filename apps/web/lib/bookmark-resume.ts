import type { BookmarkRecord } from "./domain";
import type { BookmarkResumeState } from "./bookmark-resume-storage";

export interface BookmarkResumeAnchor {
  bookmarkId: string;
  paragraph: number;
  word: number;
}

export interface BookmarkResumeRow extends BookmarkResumeAnchor {
  top: number;
  bottom: number;
}

export interface FindCurrentBookmarkResumeAnchorOptions {
  headerBottom: number;
  rows: BookmarkResumeRow[];
  viewportBottom?: number;
}

export function findCurrentBookmarkResumeAnchor({
  headerBottom,
  rows,
  viewportBottom = Number.POSITIVE_INFINITY,
}: FindCurrentBookmarkResumeAnchorOptions): BookmarkResumeAnchor | null {
  let currentRow: BookmarkResumeRow | null = null;

  for (const row of rows) {
    if (row.top < headerBottom || row.top >= viewportBottom) {
      continue;
    }

    if (row.bottom <= headerBottom) {
      continue;
    }

    if (!currentRow || row.top < currentRow.top) {
      currentRow = row;
    }
  }

  if (!currentRow) {
    return null;
  }

  return {
    bookmarkId: currentRow.bookmarkId,
    paragraph: currentRow.paragraph,
    word: currentRow.word,
  };
}

export function findRestoreBookmark(
  bookmarks: BookmarkRecord[],
  state: BookmarkResumeState,
): BookmarkRecord | null {
  if (!bookmarks.length) {
    return null;
  }

  if (state.bookmarkId) {
    const exactMatch = bookmarks.find(
      (bookmark) => bookmark.id === state.bookmarkId,
    );

    if (exactMatch) {
      return exactMatch;
    }
  }

  const forwardMatch = bookmarks.find(
    (bookmark) => compareBookmarkOrder(bookmark, state) >= 0,
  );

  return forwardMatch ?? bookmarks[0] ?? null;
}

function compareBookmarkOrder(
  bookmark: Pick<BookmarkRecord, "paragraph" | "word">,
  anchor: Pick<BookmarkResumeState, "paragraph" | "word">,
): number {
  if (bookmark.paragraph !== anchor.paragraph) {
    return bookmark.paragraph - anchor.paragraph;
  }

  return bookmark.word - anchor.word;
}
