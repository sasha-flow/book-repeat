export interface BooksSearchState {
  isOpen: boolean;
  query: string;
}

export function createBooksSearchState(): BooksSearchState {
  return {
    isOpen: false,
    query: "",
  };
}

export function openBooksSearch(state: BooksSearchState): BooksSearchState {
  return {
    ...state,
    isOpen: true,
  };
}

export function updateBooksSearchQuery(
  state: BooksSearchState,
  query: string,
): BooksSearchState {
  return {
    ...state,
    query,
  };
}

export function clearBooksSearchQuery(
  state: BooksSearchState,
): BooksSearchState {
  return {
    ...state,
    query: "",
  };
}

export function dismissBooksSearch(state?: BooksSearchState): BooksSearchState {
  void state;
  return createBooksSearchState();
}
