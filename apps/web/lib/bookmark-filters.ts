import { type BookmarkFilter, type BookmarkRecord } from "./domain";

export function applyBookmarkFilter(
  bookmarks: BookmarkRecord[],
  filter: BookmarkFilter,
): BookmarkRecord[] {
  if (filter === "all") {
    return bookmarks;
  }

  if (filter === "without-hidden") {
    return bookmarks.filter((bookmark) => bookmark.bookmark_type !== "hidden");
  }

  return bookmarks.filter(
    (bookmark) =>
      bookmark.bookmark_type !== "hidden" &&
      bookmark.bookmark_type !== "header",
  );
}

export function nextBookmarkFilter(current: BookmarkFilter): BookmarkFilter {
  if (current === "all") {
    return "without-hidden";
  }

  if (current === "without-hidden") {
    return "reading";
  }

  return "all";
}
