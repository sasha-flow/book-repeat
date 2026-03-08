export type BookmarkType = "default" | "header" | "hidden";

export type BookmarkFilter = "all" | "without-hidden" | "reading";

export interface BookRecord {
  id: string;
  title: string;
  authors: string | null;
}

export interface BookmarkRecord {
  id: string;
  book_id: string;
  bookmark_text: string;
  paragraph: number;
  word: number;
  bookmark_type: BookmarkType;
}

export const bookmarkFilterLabels: Record<BookmarkFilter, string> = {
  all: "All",
  "without-hidden": "No hidden",
  reading: "Reading",
};

export function normalizeBookmarkType(
  sourceVisible: number | null,
  sourceStyleId: number | null,
): BookmarkType {
  if (sourceVisible === 0) {
    return "hidden";
  }

  if (sourceStyleId === 2) {
    return "header";
  }

  return "default";
}
