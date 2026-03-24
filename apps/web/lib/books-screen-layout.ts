export const BOOKS_SEARCH_BAR_HEIGHT = 69.079;

export function getBooksListResumeInsets({
  searchOpen,
  keyboardOpen,
}: {
  searchOpen: boolean;
  keyboardOpen: boolean;
}) {
  if (!searchOpen) {
    return {
      topInset: 0,
      bottomInset: 0,
    };
  }

  if (keyboardOpen) {
    return {
      topInset: BOOKS_SEARCH_BAR_HEIGHT,
      bottomInset: 0,
    };
  }

  return {
    topInset: 0,
    bottomInset: BOOKS_SEARCH_BAR_HEIGHT,
  };
}
