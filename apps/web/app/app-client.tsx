"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, TouchEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  EyeOff,
  FileUp,
  Filter,
  Heading,
  Search,
  Type,
  X,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import {
  type BookRecord,
  type BookmarkFilter,
  type BookmarkRecord,
  type BookmarkType,
  bookmarkFilterLabels,
} from "../lib/domain";
import {
  getAppShellLayoutMetrics,
  type AppShellChromeMode,
} from "../lib/app-shell-layout";
import {
  clearBooksSearchQuery,
  createBooksSearchState,
  dismissBooksSearch,
  openBooksSearch,
  updateBooksSearchQuery,
} from "../lib/books-search-state";
import { getBooksSearchFabStyles } from "../lib/books-search-fab";
import { getBooksListResumeInsets } from "../lib/books-screen-layout";
import { useKeyboardViewport } from "../lib/keyboard-viewport";
import {
  applyBookmarkFilter,
  nextBookmarkFilter,
} from "../lib/bookmark-filters";
import {
  findRestoreBook,
  getBookListResumeScrollTop,
} from "../lib/book-list-resume";
import {
  loadStoredBookListResumeState,
  saveStoredBookListResumeState,
  type BookListResumeState,
} from "../lib/book-list-resume-storage";
import {
  findCurrentBookmarkResumeAnchor,
  findRestoreBookmark,
} from "../lib/bookmark-resume";
import {
  loadStoredBookmarkResumeState,
  saveStoredBookmarkResumeState,
  type BookmarkResumeState,
  type BookmarkResumeStorageLike,
} from "../lib/bookmark-resume-storage";
import {
  BOOKMARK_LONG_PRESS_DELAY_MS,
  createBookmarkLongPressGesture,
  type BookmarkLongPressGesture,
  shouldCancelBookmarkLongPress,
} from "../lib/bookmark-long-press";
import { getBookmarkContextMenuLayout } from "../lib/bookmark-context-menu-styles";
import { getOpaqueHeaderSurfaceStyle } from "../lib/book-detail-styles";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { MobilePageHeader, MobilePageHeaderButton } from "./mobile-page-header";
import { ThemeToggle } from "./theme-toggle";

interface MenuState {
  bookmarkId: string;
  bookmarkText: string;
  currentType: BookmarkType;
}

const BOOK_DETAIL_DEFAULT_FILTER: BookmarkFilter = "without-hidden";
const BOOK_DETAIL_HEADER_FALLBACK_BOTTOM = 66;
const BOOKS_LIST_HIGHLIGHT_DURATION_MS = 367;

function getTouchPoints(touches: TouchEvent<HTMLLIElement>["touches"]) {
  return Array.from(touches, ({ identifier, clientX, clientY }) => ({
    identifier,
    clientX,
    clientY,
  }));
}

function AuthScreen({
  onSignedIn,
}: {
  onSignedIn: (session: Session) => void;
}) {
  const keyboardViewport = useKeyboardViewport();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authViewportHeight =
    keyboardViewport.viewportHeight > 0
      ? keyboardViewport.viewportHeight
      : undefined;

  const submit = async () => {
    setLoading(true);
    setError(null);

    const response = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (response.error) {
      setError(response.error.message);
      return;
    }

    if (response.data.session) {
      onSignedIn(response.data.session);
      return;
    }

    if (isSignUp) {
      setError(
        "Account created. Check your email verification settings and sign in.",
      );
    }
  };

  return (
    <main
      className={`mx-auto flex w-full max-w-md px-4 ${
        keyboardViewport.keyboardOpen ? "items-start py-4" : "items-center"
      }`}
      style={{ minHeight: authViewportHeight }}
    >
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{isSignUp ? "Create account" : "Sign in"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={submit}
            disabled={loading || !email || !password}
          >
            {loading
              ? "Please wait..."
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </Button>
          <Button
            className="w-full"
            onClick={() => setIsSignUp((value) => !value)}
          >
            {isSignUp ? "Use existing account" : "Create new account"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function useAuthenticatedSession() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoadingSession(false);
    };

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: unknown, changedSession: Session | null) => {
        setSession(changedSession);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  return { supabase, session, loadingSession, setSession };
}

function AppShell({
  children,
  overlay,
  header,
  bottomBar,
  chromeMode = "flow",
  keyboardOpen = false,
  viewportHeight,
}: {
  children: ReactNode;
  overlay?: ReactNode;
  header?: ReactNode;
  bottomBar?: ReactNode;
  chromeMode?: AppShellChromeMode;
  keyboardOpen?: boolean;
  viewportHeight?: number;
}) {
  const opaqueHeaderSurfaceStyle = getOpaqueHeaderSurfaceStyle();
  const {
    headerClassName,
    bottomBarClassName,
    bottomBarPlacement,
    mainClassName,
    mainStyle,
    chromeSurfaceStyle,
    needsHeaderSpacer,
    needsTopBottomBarSpacer,
    needsBottomBarSpacer,
  } = getAppShellLayoutMetrics({
    chromeMode,
    hasBottomBar: Boolean(bottomBar),
    keyboardOpen,
  });

  const shellViewportHeight =
    viewportHeight && viewportHeight > 0 ? viewportHeight : undefined;
  const bottomBarSurfaceClassName =
    bottomBarPlacement === "top"
      ? "mx-auto h-[69.079px] w-full border-b-[1.108px] border-border bg-background"
      : "mx-auto h-[69.079px] w-full border-t-[1.108px] border-border bg-background";

  return (
    <div
      className="mx-auto flex w-full flex-col bg-background text-foreground"
      style={{ maxWidth: 393.256, minHeight: shellViewportHeight }}
    >
      {header ? (
        <>
          {needsHeaderSpacer ? (
            <div
              aria-hidden="true"
              className="mx-auto w-full invisible pointer-events-none"
              style={{ maxWidth: 393.256 }}
            >
              {header}
            </div>
          ) : null}
          <header className={headerClassName}>
            <div className="bg-background" style={opaqueHeaderSurfaceStyle}>
              <div
                className="mx-auto w-full bg-background"
                style={{
                  ...opaqueHeaderSurfaceStyle,
                  maxWidth: 393.256,
                }}
              >
                {header}
              </div>
            </div>
          </header>
        </>
      ) : null}

      {needsTopBottomBarSpacer ? (
        <div
          aria-hidden="true"
          className="mx-auto w-full invisible pointer-events-none"
          style={{ maxWidth: 393.256 }}
        >
          <div className={bottomBarSurfaceClassName} />
        </div>
      ) : null}

      <main className={mainClassName} style={mainStyle}>
        {children}
      </main>

      {bottomBar ? (
        <>
          <div className={bottomBarClassName}>
            <div
              className={bottomBarSurfaceClassName}
              style={{
                ...chromeSurfaceStyle,
                maxWidth: 393.256,
                paddingLeft: 15.993,
                paddingRight: 15.993,
                paddingTop: 17.101,
              }}
            >
              {bottomBar}
            </div>
          </div>
          {needsBottomBarSpacer ? (
            <div
              aria-hidden="true"
              className="mx-auto w-full invisible pointer-events-none"
              style={{ maxWidth: 393.256 }}
            >
              <div className="h-[69.079px] w-full border-t-[1.108px] border-border bg-background" />
            </div>
          ) : null}
        </>
      ) : null}

      {overlay}
    </div>
  );
}

function BackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <MobilePageHeaderButton onClick={onClick} aria-label={label}>
      <ArrowLeft className="size-6" strokeWidth={1.9} />
    </MobilePageHeaderButton>
  );
}

function BooksSearchFab({ onOpen }: { onOpen: () => void }) {
  const fabStyles = getBooksSearchFabStyles();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
      <div
        className="mx-auto flex w-full justify-end px-4"
        style={{
          maxWidth: 393.256,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
        }}
      >
        <div className={fabStyles.frameClassName}>
          <Button
            type="button"
            size="icon"
            className={fabStyles.buttonClassName}
            onClick={onOpen}
            aria-label="Open book search"
          >
            <Search className={fabStyles.iconClassName} strokeWidth={1.9} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function BooksSearchBar({
  value,
  inputRef,
  onChange,
  onClear,
  onCancel,
}: {
  value: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const hasValue = value.length > 0;

  return (
    <div className="flex h-[35.985px] w-full items-center gap-2">
      <div className="relative h-[35.985px] min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-[12px] top-[7.99px] size-[19.992px] text-muted-foreground"
          strokeWidth={1.9}
        />
        <Input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search books..."
          aria-label="Search books"
          className="h-[35.985px] rounded-[8px] border-[1.108px] border-input bg-background px-0 py-0 text-[16px] font-normal text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0"
          style={{
            paddingLeft: 40,
            paddingRight: hasValue ? 44 : 12,
            paddingTop: 4,
            paddingBottom: 4,
            WebkitAppearance: "none",
            appearance: "none",
          }}
        />
        {hasValue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-[2px] top-[1.99px] size-8 rounded-[8px]"
            onPointerDown={(event) => event.preventDefault()}
            onClick={onClear}
            aria-label="Clear search"
          >
            <X className="size-4" strokeWidth={1.9} />
          </Button>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-9 shrink-0 px-2 text-[15px] font-medium"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}

function BooksList({
  books,
  loadingBooks,
  highlightedBookId,
  onBookSelect,
  onBookElement,
}: {
  books: BookRecord[];
  loadingBooks: boolean;
  highlightedBookId: string | null;
  onBookSelect: (bookId: string) => void;
  onBookElement: (bookId: string, element: HTMLLIElement | null) => void;
}) {
  return (
    <section>
      {loadingBooks ? (
        <p className="px-1 text-sm text-muted-foreground">Loading books...</p>
      ) : null}
      <ul style={{ display: "grid", gap: 7.997 }}>
        {books.map((book) => {
          const isHighlighted = book.id === highlightedBookId;

          return (
            <li
              key={book.id}
              ref={(element) => onBookElement(book.id, element)}
              data-book-id={book.id}
            >
              <Link
                href={`/books/${book.id}`}
                onClick={() => onBookSelect(book.id)}
                className={`block w-full text-left text-[16px] font-normal leading-[24px] text-foreground transition-colors hover:bg-accent/40 ${
                  isHighlighted ? "book-list-last-opened-highlight" : ""
                }`}
                style={{
                  minHeight: 58.192,
                  borderRadius: 10,
                  borderWidth: 1.108,
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                  backgroundColor: "var(--card)",
                  paddingLeft: 17.101,
                  paddingRight: 17.101,
                  paddingTop: 17.101,
                  paddingBottom: 17.101,
                }}
              >
                {book.title}
              </Link>
            </li>
          );
        })}
        {!books.length && !loadingBooks ? (
          <li
            className="bg-card text-sm text-muted-foreground"
            style={{
              borderRadius: 10,
              borderWidth: 1.108,
              borderStyle: "dashed",
              borderColor: "var(--border)",
              paddingLeft: 17.101,
              paddingRight: 17.101,
              paddingTop: 17.101,
              paddingBottom: 17.101,
            }}
          >
            No books yet. Upload a file.
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function UploadSection({
  uploading,
  uploadMessage,
  onUpload,
}: {
  uploading: boolean;
  uploadMessage: string | null;
  onUpload: (file: File) => void;
}) {
  return (
    <section className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload SQLite file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept=".db,.sqlite,.sqlite3"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              onUpload(file);
              event.currentTarget.value = "";
            }}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground">
            Only new and changed books/bookmarks will be upserted for your
            account.
          </p>
          {uploadMessage ? <p className="text-sm">{uploadMessage}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function UserSection({
  userLabel,
  onLogout,
}: {
  userLabel: string;
  onLogout: () => Promise<void>;
}) {
  return (
    <section className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium">{userLabel}</p>
          </div>
          <ThemeToggle />
          <Button
            className="border border-input bg-background text-foreground shadow-none hover:bg-accent"
            onClick={() => {
              void onLogout();
            }}
          >
            Log out
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function BookmarkContextMenu({
  menuState,
  onClose,
  onCopy,
  onUpdate,
}: {
  menuState: MenuState | null;
  onClose: () => void;
  onCopy: (text: string) => Promise<void>;
  onUpdate: (bookmarkId: string, bookmarkType: BookmarkType) => void;
}) {
  if (!menuState) {
    return null;
  }

  const menuLayout = getBookmarkContextMenuLayout();

  const actions: Array<{
    type: BookmarkType;
    label: string;
    icon: typeof Copy;
  }> = [
    { type: "hidden", label: "Hidden", icon: EyeOff },
    { type: "header", label: "Header", icon: Heading },
    { type: "default", label: "Text", icon: Type },
  ];

  return (
    <>
      <button
        type="button"
        className={menuLayout.backdropClassName}
        onClick={onClose}
        aria-label="Close context menu"
      />
      <div className={menuLayout.railClassName} style={menuLayout.overlayStyle}>
        <div
          className={menuLayout.frameClassName}
          style={menuLayout.frameStyle}
        >
          <div
            className={menuLayout.surfaceClassName}
            style={menuLayout.surfaceStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Bookmark actions"
          >
            <div className="flex justify-center" style={{ paddingTop: 15.99 }}>
              <div
                className="bg-muted"
                style={{
                  width: 99.993,
                  height: 7.997,
                  borderRadius: 999,
                }}
              />
            </div>

            <div style={{ paddingTop: 8, paddingBottom: 8 }}>
              <button
                type="button"
                className="flex w-full items-center gap-[15.993px] text-left text-foreground transition-colors hover:bg-accent"
                style={{
                  minHeight: 55.977,
                  paddingLeft: 15.993,
                  paddingRight: 15.993,
                }}
                onClick={() => {
                  void onCopy(menuState.bookmarkText);
                }}
              >
                <Copy className="size-[19.992px] shrink-0" strokeWidth={1.9} />
                <span className="text-[16px] font-medium leading-[24px]">
                  Copy
                </span>
              </button>

              <div
                className="bg-border"
                style={{ height: 0.987, marginTop: 7.996, marginBottom: 8.983 }}
              />

              {actions.map((action) => {
                const active = menuState.currentType === action.type;
                const Icon = action.icon;

                return (
                  <button
                    key={action.type}
                    type="button"
                    className="flex w-full items-center gap-[15.993px] text-left text-foreground transition-colors hover:bg-accent"
                    style={{
                      minHeight: 55.977,
                      paddingLeft: 15.993,
                      paddingRight: 15.993,
                      backgroundColor: active ? "var(--accent)" : "transparent",
                    }}
                    onClick={() => onUpdate(menuState.bookmarkId, action.type)}
                  >
                    <Icon
                      className="size-[19.992px] shrink-0"
                      strokeWidth={1.9}
                    />
                    <span
                      className="flex-1 text-[16px] leading-[24px]"
                      style={{ fontWeight: active ? 600 : 500 }}
                    >
                      {action.label}
                    </span>
                    {active ? (
                      <Check
                        className="size-[19.992px] shrink-0"
                        strokeWidth={2}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function AppClient() {
  const keyboardViewport = useKeyboardViewport();
  const router = useRouter();
  const { supabase, session, loadingSession, setSession } =
    useAuthenticatedSession();
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [booksSearch, setBooksSearch] = useState(createBooksSearchState);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [highlightedBookId, setHighlightedBookId] = useState<string | null>(
    null,
  );
  const [bookListResumeReady, setBookListResumeReady] = useState(false);
  const deferredBookQuery = useDeferredValue(booksSearch.query);
  const bookListElements = useRef(new Map<string, HTMLLIElement>());
  const pendingBookListResumeState = useRef<BookListResumeState | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const highlightFrame = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchHistoryActive = useRef(false);
  const isSearchOpen = booksSearch.isOpen;
  const bookQuery = booksSearch.query;

  const visibleBooks = useMemo(() => {
    const normalizedQuery = deferredBookQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return books;
    }

    return books.filter((book) => {
      const title = book.title.toLowerCase();
      const authors = book.authors?.toLowerCase() ?? "";

      return (
        title.includes(normalizedQuery) || authors.includes(normalizedQuery)
      );
    });
  }, [books, deferredBookQuery]);

  const handleBookElement = useCallback(
    (bookId: string, element: HTMLLIElement | null) => {
      if (element) {
        bookListElements.current.set(bookId, element);
        return;
      }

      bookListElements.current.delete(bookId);
    },
    [],
  );

  const handleBookSelect = useCallback((bookId: string) => {
    const storage = getBrowserStorage();

    if (!storage) {
      return;
    }

    saveStoredBookListResumeState(storage, {
      bookId,
      savedAt: Date.now(),
    });
  }, []);

  const openSearch = useCallback(() => {
    setBooksSearch((state) => openBooksSearch(state));
  }, []);

  const updateSearchQuery = useCallback((query: string) => {
    setBooksSearch((state) => updateBooksSearchQuery(state, query));
  }, []);

  const clearSearchQuery = useCallback(() => {
    setBooksSearch((state) => clearBooksSearchQuery(state));
  }, []);

  const dismissSearch = useCallback(() => {
    if (searchHistoryActive.current) {
      window.history.back();
      return;
    }

    setBooksSearch(dismissBooksSearch());
  }, []);

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    const { data: bookmarkRows, error: bookmarkRowsError } = await supabase
      .from("bookmarks")
      .select("book_id")
      .neq("bookmark_type", "hidden")
      .neq("bookmark_type", "header");

    if (bookmarkRowsError) {
      setLoadingBooks(false);
      console.error("[books] failed to load bookmark rows", {
        message: bookmarkRowsError.message,
      });
      return;
    }

    const eligibleBookIds = Array.from(
      new Set(
        (bookmarkRows ?? []).map((row: { book_id: string }) => row.book_id),
      ),
    );

    if (!eligibleBookIds.length) {
      setLoadingBooks(false);
      setBooks([]);
      return;
    }

    const { data, error } = await supabase
      .from("books")
      .select("id, title, authors")
      .in("id", eligibleBookIds)
      .order("title", { ascending: true });

    setLoadingBooks(false);

    if (error) {
      console.error("[books] failed to load books", {
        message: error.message,
      });
      return;
    }

    setBooks((data ?? []) as BookRecord[]);
  }, [supabase]);

  useEffect(() => {
    if (!session) {
      setBooks([]);
      return;
    }

    void loadBooks();
  }, [session, loadBooks]);

  useEffect(() => {
    if (!session) {
      pendingBookListResumeState.current = null;
      setHighlightedBookId(null);
      setBookListResumeReady(false);
      return;
    }

    const storage = getBrowserStorage();
    const savedState = storage ? loadStoredBookListResumeState(storage) : null;

    pendingBookListResumeState.current = savedState;
    setHighlightedBookId(null);
    setBookListResumeReady(true);
  }, [session]);

  useEffect(() => {
    if (!bookListResumeReady || loadingBooks || !visibleBooks.length) {
      return;
    }

    const pendingState = pendingBookListResumeState.current;

    if (!pendingState) {
      return;
    }

    const targetBook = findRestoreBook(visibleBooks, pendingState);

    if (!targetBook) {
      pendingBookListResumeState.current = null;
      return;
    }

    const targetElement = bookListElements.current.get(targetBook.id);

    if (!targetElement) {
      return;
    }

    pendingBookListResumeState.current = null;

    const rect = targetElement.getBoundingClientRect();
    const resumeInsets = getBooksListResumeInsets({
      searchOpen: isSearchOpen,
      keyboardOpen: keyboardViewport.keyboardOpen,
    });
    const targetTop = getBookListResumeScrollTop({
      itemTop: rect.top,
      itemHeight: rect.height,
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      topInset: resumeInsets.topInset,
      bottomInset: resumeInsets.bottomInset,
    });

    window.scrollTo({ top: targetTop, behavior: "auto" });

    if (highlightFrame.current !== null) {
      window.cancelAnimationFrame(highlightFrame.current);
    }

    setHighlightedBookId(null);
    highlightFrame.current = window.requestAnimationFrame(() => {
      highlightFrame.current = window.requestAnimationFrame(() => {
        highlightFrame.current = null;
        setHighlightedBookId(targetBook.id);
      });
    });
  }, [
    bookListResumeReady,
    isSearchOpen,
    keyboardViewport.keyboardOpen,
    loadingBooks,
    visibleBooks,
  ]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    if (!searchHistoryActive.current) {
      window.history.pushState({ booksSearch: true }, "");
      searchHistoryActive.current = true;
    }

    const handlePopState = () => {
      if (!searchHistoryActive.current) {
        return;
      }

      searchHistoryActive.current = false;
      setBooksSearch(dismissBooksSearch());
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      dismissSearch();
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismissSearch, isSearchOpen]);

  useEffect(() => {
    if (!highlightedBookId) {
      return;
    }

    if (highlightTimer.current !== null) {
      window.clearTimeout(highlightTimer.current);
    }

    highlightTimer.current = window.setTimeout(() => {
      highlightTimer.current = null;
      setHighlightedBookId(null);
    }, BOOKS_LIST_HIGHLIGHT_DURATION_MS);

    return () => {
      if (highlightTimer.current !== null) {
        window.clearTimeout(highlightTimer.current);
        highlightTimer.current = null;
      }
    };
  }, [highlightedBookId]);

  useEffect(() => {
    return () => {
      if (highlightFrame.current !== null) {
        window.cancelAnimationFrame(highlightFrame.current);
        highlightFrame.current = null;
      }
    };
  }, []);

  if (loadingSession) {
    return <main className="p-6 text-sm">Loading...</main>;
  }

  if (!session) {
    return <AuthScreen onSignedIn={setSession} />;
  }

  return (
    <AppShell
      chromeMode="pinned"
      keyboardOpen={keyboardViewport.keyboardOpen}
      viewportHeight={keyboardViewport.viewportHeight}
      header={
        <MobilePageHeader
          title="Books"
          trailing={
            <div className="flex items-center gap-1">
              <MobilePageHeaderButton
                onClick={() => router.push("/upload")}
                aria-label="Open upload page"
              >
                <FileUp className="size-5" strokeWidth={1.9} />
              </MobilePageHeaderButton>
              <MobilePageHeaderButton
                onClick={() => router.push("/profile")}
                aria-label="Open profile page"
              >
                <UserIcon className="size-5" strokeWidth={1.9} />
              </MobilePageHeaderButton>
            </div>
          }
        />
      }
      bottomBar={
        isSearchOpen ? (
          <BooksSearchBar
            value={bookQuery}
            inputRef={searchInputRef}
            onChange={updateSearchQuery}
            onClear={() => {
              clearSearchQuery();
              searchInputRef.current?.focus();
            }}
            onCancel={dismissSearch}
          />
        ) : undefined
      }
      overlay={
        !isSearchOpen ? <BooksSearchFab onOpen={openSearch} /> : undefined
      }
    >
      <BooksList
        books={visibleBooks}
        loadingBooks={loadingBooks}
        highlightedBookId={highlightedBookId}
        onBookSelect={handleBookSelect}
        onBookElement={handleBookElement}
      />
    </AppShell>
  );
}

export function UploadPageClient() {
  const keyboardViewport = useKeyboardViewport();
  const router = useRouter();
  const { session, loadingSession, setSession } = useAuthenticatedSession();
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!session) {
        return;
      }

      setUploading(true);
      setUploadMessage(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/import-sqlite", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const responseJson = (await response.json()) as {
          error?: string;
          books?: number;
          bookmarks?: number;
          fileDeleted?: boolean;
        };

        setUploading(false);

        if (!response.ok) {
          console.error("[upload] import request failed", {
            fileName: file.name,
            fileSize: file.size,
            status: response.status,
            response: responseJson,
          });
          setUploadMessage(responseJson.error ?? "Import failed");
          return;
        }

        const deletedText = responseJson.fileDeleted
          ? "File deleted"
          : "Delete retry needed";
        setUploadMessage(
          `Imported books: ${responseJson.books ?? 0}, bookmarks: ${responseJson.bookmarks ?? 0}. ${deletedText}.`,
        );
      } catch (error) {
        setUploading(false);
        console.error("[upload] import request threw unexpectedly", {
          fileName: file.name,
          fileSize: file.size,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? (error.stack ?? null) : null,
        });
        setUploadMessage(
          "Import failed before the server returned a response. Check browser and server logs for details.",
        );
      }
    },
    [session],
  );

  if (loadingSession) {
    return <main className="p-6 text-sm">Loading...</main>;
  }

  if (!session) {
    return <AuthScreen onSignedIn={setSession} />;
  }

  return (
    <AppShell
      chromeMode="pinned"
      keyboardOpen={keyboardViewport.keyboardOpen}
      viewportHeight={keyboardViewport.viewportHeight}
      header={
        <MobilePageHeader
          title="Upload"
          leading={
            <BackButton
              label="Back to books"
              onClick={() => {
                router.push("/");
              }}
            />
          }
        />
      }
    >
      <UploadSection
        uploading={uploading}
        uploadMessage={uploadMessage}
        onUpload={(file) => {
          void uploadFile(file);
        }}
      />
    </AppShell>
  );
}

export function ProfilePageClient() {
  const keyboardViewport = useKeyboardViewport();
  const router = useRouter();
  const { supabase, session, loadingSession, setSession } =
    useAuthenticatedSession();

  if (loadingSession) {
    return <main className="p-6 text-sm">Loading...</main>;
  }

  if (!session) {
    return <AuthScreen onSignedIn={setSession} />;
  }

  const userLabel =
    session.user.user_metadata.name ?? session.user.email ?? session.user.id;

  return (
    <AppShell
      chromeMode="pinned"
      keyboardOpen={keyboardViewport.keyboardOpen}
      viewportHeight={keyboardViewport.viewportHeight}
      header={
        <MobilePageHeader
          title="Profile"
          leading={
            <BackButton
              label="Back to books"
              onClick={() => {
                router.push("/");
              }}
            />
          }
        />
      }
    >
      <UserSection
        userLabel={userLabel}
        onLogout={async () => {
          await supabase.auth.signOut();
          setSession(null);
        }}
      />
    </AppShell>
  );
}

export function BookDetailClient({ bookId }: { bookId: string }) {
  const opaqueHeaderSurfaceStyle = getOpaqueHeaderSurfaceStyle();
  const router = useRouter();
  const { supabase, session, loadingSession, setSession } =
    useAuthenticatedSession();
  const [book, setBook] = useState<BookRecord | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [bookmarkFilter, setBookmarkFilter] = useState<BookmarkFilter>(
    BOOK_DETAIL_DEFAULT_FILTER,
  );
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);
  const [resumeReady, setResumeReady] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressGesture = useRef<BookmarkLongPressGesture | null>(null);
  const menuHistoryActive = useRef(false);
  const headerElement = useRef<HTMLElement | null>(null);
  const bookmarkElements = useRef(new Map<string, HTMLLIElement>());
  const pendingResumeState = useRef<BookmarkResumeState | null>(null);
  const lastSavedResumeState = useRef<BookmarkResumeState | null>(null);
  const scrollFrameId = useRef<number | null>(null);

  const visibleBookmarks = applyBookmarkFilter(bookmarks, bookmarkFilter);

  const getHeaderBottom = useCallback(() => {
    return (
      headerElement.current?.getBoundingClientRect().bottom ??
      BOOK_DETAIL_HEADER_FALLBACK_BOTTOM
    );
  }, []);

  const saveBookmarkResume = useCallback(
    (nextState: BookmarkResumeState) => {
      const storage = getBookmarkResumeStorage();

      if (!storage) {
        return;
      }

      saveStoredBookmarkResumeState(storage, bookId, nextState);
      lastSavedResumeState.current = nextState;
    },
    [bookId],
  );

  const captureVisibleBookmarkResume = useCallback(() => {
    if (!resumeReady || loadingBook || !book || !visibleBookmarks.length) {
      return null;
    }

    const rows = visibleBookmarks.flatMap((bookmark) => {
      const element = bookmarkElements.current.get(bookmark.id);

      if (!element) {
        return [];
      }

      const rect = element.getBoundingClientRect();

      return [
        {
          bookmarkId: bookmark.id,
          top: rect.top,
          bottom: rect.bottom,
          paragraph: bookmark.paragraph,
          word: bookmark.word,
        },
      ];
    });

    const anchor = findCurrentBookmarkResumeAnchor({
      headerBottom: getHeaderBottom(),
      rows,
      viewportBottom: window.innerHeight,
    });

    if (!anchor) {
      return null;
    }

    return {
      bookmarkFilter,
      bookmarkId: anchor.bookmarkId,
      paragraph: anchor.paragraph,
      word: anchor.word,
      savedAt: Date.now(),
    } satisfies BookmarkResumeState;
  }, [
    bookmarkFilter,
    book,
    getHeaderBottom,
    loadingBook,
    resumeReady,
    visibleBookmarks,
  ]);

  const flushBookmarkResume = useCallback(() => {
    const nextState = captureVisibleBookmarkResume();

    if (nextState) {
      saveBookmarkResume(nextState);
    }
  }, [captureVisibleBookmarkResume, saveBookmarkResume]);

  useEffect(() => {
    bookmarkElements.current.clear();
    pendingResumeState.current = null;
    lastSavedResumeState.current = null;
    setResumeReady(false);

    const storage = getBookmarkResumeStorage();
    const savedState = storage
      ? loadStoredBookmarkResumeState(storage, bookId)
      : null;

    pendingResumeState.current = savedState;
    lastSavedResumeState.current = savedState;
    setBookmarkFilter(savedState?.bookmarkFilter ?? BOOK_DETAIL_DEFAULT_FILTER);
    setResumeReady(true);
  }, [bookId]);

  useEffect(() => {
    if (!session) {
      setBook(null);
      setBookmarks([]);
      return;
    }

    const loadBook = async () => {
      setLoadingBook(true);
      setStatusMessage(null);

      const [bookResponse, bookmarkResponse] = await Promise.all([
        supabase
          .from("books")
          .select("id, title, authors")
          .eq("id", bookId)
          .maybeSingle(),
        supabase
          .from("bookmarks")
          .select("id, book_id, bookmark_text, paragraph, word, bookmark_type")
          .eq("book_id", bookId)
          .order("paragraph", { ascending: true })
          .order("word", { ascending: true }),
      ]);

      setLoadingBook(false);

      if (bookResponse.error) {
        setStatusMessage(bookResponse.error.message);
        return;
      }

      if (bookmarkResponse.error) {
        setStatusMessage(bookmarkResponse.error.message);
        return;
      }

      setBook((bookResponse.data as BookRecord | null) ?? null);
      setBookmarks((bookmarkResponse.data ?? []) as BookmarkRecord[]);
    };

    void loadBook();
  }, [bookId, session, supabase]);

  const openMenu = (bookmark: BookmarkRecord) => {
    setMenuState({
      bookmarkId: bookmark.id,
      bookmarkText: bookmark.bookmark_text,
      currentType: bookmark.bookmark_type,
    });
  };

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    longPressGesture.current = null;
  }, []);

  const closeMenu = useCallback(() => {
    if (menuHistoryActive.current) {
      window.history.back();
      return;
    }

    setMenuState(null);
  }, []);

  useEffect(() => {
    if (!menuState) {
      return;
    }

    if (!menuHistoryActive.current) {
      window.history.pushState({ bookmarkSheet: true }, "");
      menuHistoryActive.current = true;
    }

    const handlePopState = () => {
      if (!menuHistoryActive.current) {
        return;
      }

      menuHistoryActive.current = false;
      setMenuState(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeMenu();
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, menuState]);

  useEffect(() => clearLongPress, [clearLongPress]);

  useEffect(() => {
    if (!resumeReady || loadingBook || !book) {
      return;
    }

    const pendingState = pendingResumeState.current;

    if (!pendingState) {
      return;
    }

    if (pendingState.bookmarkFilter !== bookmarkFilter) {
      return;
    }

    const targetBookmark = findRestoreBookmark(visibleBookmarks, pendingState);

    if (!targetBookmark) {
      pendingResumeState.current = null;
      return;
    }

    const targetElement = bookmarkElements.current.get(targetBookmark.id);

    if (!targetElement) {
      return;
    }

    const targetTop =
      targetElement.getBoundingClientRect().top +
      window.scrollY -
      getHeaderBottom();

    window.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });

    const restoredState = {
      bookmarkFilter,
      bookmarkId: targetBookmark.id,
      paragraph: targetBookmark.paragraph,
      word: targetBookmark.word,
      savedAt: pendingState.savedAt,
    } satisfies BookmarkResumeState;

    pendingResumeState.current = null;
    lastSavedResumeState.current = restoredState;
  }, [
    bookmarkFilter,
    book,
    getHeaderBottom,
    loadingBook,
    resumeReady,
    visibleBookmarks,
  ]);

  useEffect(() => {
    if (!resumeReady || loadingBook || !book) {
      return;
    }

    const nextState =
      captureVisibleBookmarkResume() ??
      (lastSavedResumeState.current
        ? {
            ...lastSavedResumeState.current,
            bookmarkFilter,
            savedAt: Date.now(),
          }
        : null);

    if (!nextState) {
      return;
    }

    saveBookmarkResume(nextState);
  }, [
    bookmarkFilter,
    book,
    captureVisibleBookmarkResume,
    loadingBook,
    resumeReady,
    saveBookmarkResume,
    visibleBookmarks,
  ]);

  useEffect(() => {
    if (!resumeReady || loadingBook || !book) {
      return;
    }

    const scheduleFlush = () => {
      if (scrollFrameId.current !== null) {
        return;
      }

      scrollFrameId.current = window.requestAnimationFrame(() => {
        scrollFrameId.current = null;
        flushBookmarkResume();
      });
    };

    const handlePageHide = () => {
      flushBookmarkResume();
    };

    window.addEventListener("scroll", scheduleFlush, { passive: true });
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      if (scrollFrameId.current !== null) {
        window.cancelAnimationFrame(scrollFrameId.current);
        scrollFrameId.current = null;
      }

      window.removeEventListener("scroll", scheduleFlush);
      window.removeEventListener("pagehide", handlePageHide);
      flushBookmarkResume();
    };
  }, [book, flushBookmarkResume, loadingBook, resumeReady]);

  const handleLongPressStart = (
    event: TouchEvent<HTMLLIElement>,
    bookmark: BookmarkRecord,
  ) => {
    const gesture = createBookmarkLongPressGesture(
      getTouchPoints(event.touches),
    );

    clearLongPress();

    if (!gesture) {
      return;
    }

    longPressGesture.current = gesture;
    longPressTimer.current = window.setTimeout(() => {
      clearLongPress();
      openMenu(bookmark);
    }, BOOKMARK_LONG_PRESS_DELAY_MS);
  };

  const handleLongPressMove = (event: TouchEvent<HTMLLIElement>) => {
    if (
      shouldCancelBookmarkLongPress(
        longPressGesture.current,
        getTouchPoints(event.touches),
      )
    ) {
      clearLongPress();
    }
  };

  const handleLongPressEnd = clearLongPress;

  const updateBookmarkType = async (
    bookmarkId: string,
    bookmarkType: BookmarkType,
  ) => {
    const { error } = await supabase
      .from("bookmarks")
      .update({ bookmark_type: bookmarkType })
      .eq("id", bookmarkId);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setBookmarks((current) =>
      current.map((bookmark) =>
        bookmark.id === bookmarkId
          ? { ...bookmark, bookmark_type: bookmarkType }
          : bookmark,
      ),
    );

    closeMenu();
  };

  const copyBookmarkText = async (bookmarkText: string) => {
    try {
      await navigator.clipboard.writeText(bookmarkText);
      closeMenu();
    } catch {
      setStatusMessage("Failed to copy bookmark text.");
    }
  };

  if (loadingSession) {
    return <main className="p-6 text-sm">Loading...</main>;
  }

  if (!session) {
    return <AuthScreen onSignedIn={setSession} />;
  }

  return (
    <>
      <div
        className="mx-auto flex min-h-screen w-full flex-col bg-background text-foreground"
        style={{ maxWidth: 393.256 }}
      >
        <header
          ref={headerElement}
          className="fixed top-0 left-0 right-0 z-30 bg-background"
          style={opaqueHeaderSurfaceStyle}
        >
          <div
            className="mx-auto w-full bg-background"
            style={{
              ...opaqueHeaderSurfaceStyle,
              maxWidth: 393.256,
            }}
          >
            <MobilePageHeader
              title={book?.title ?? "Book bookmarks"}
              leading={
                <BackButton
                  label="Back to books"
                  onClick={() => {
                    router.push("/");
                  }}
                />
              }
              trailing={
                <MobilePageHeaderButton
                  className="flex-col"
                  style={{ gap: 1.5 }}
                  onClick={() =>
                    setBookmarkFilter((current) => nextBookmarkFilter(current))
                  }
                  aria-label={`Change bookmark filter. Current filter: ${bookmarkFilterLabels[bookmarkFilter]}`}
                >
                  <Filter className="size-[18px]" strokeWidth={1.9} />
                  <span className="text-[10px] leading-[10px] text-foreground">
                    {bookmarkFilterLabels[bookmarkFilter]}
                  </span>
                </MobilePageHeaderButton>
              }
            />
          </div>
        </header>

        <main
          className="flex-1"
          style={{
            paddingLeft: 15.993,
            paddingRight: 15.993,
            paddingTop: 81.074,
            paddingBottom: 24,
            minWidth: 0,
          }}
        >
          <section style={{ display: "grid", gap: 11.995, minWidth: 0 }}>
            {loadingBook ? (
              <div
                className="bg-card text-sm text-muted-foreground"
                style={{
                  minHeight: 58.192,
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 10,
                  borderWidth: 1.108,
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                  paddingLeft: 17.101,
                  paddingRight: 17.101,
                  paddingTop: 17.101,
                  paddingBottom: 17.101,
                }}
              >
                Loading bookmarks...
              </div>
            ) : null}

            {statusMessage ? (
              <div
                className="bg-card text-sm text-foreground"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 10,
                  borderWidth: 1.108,
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                  paddingLeft: 17.101,
                  paddingRight: 17.101,
                  paddingTop: 17.101,
                  paddingBottom: 17.101,
                }}
              >
                {statusMessage}
              </div>
            ) : null}

            {!loadingBook && !book ? (
              <div
                className="bg-card text-sm text-muted-foreground"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 10,
                  borderWidth: 1.108,
                  borderStyle: "dashed",
                  borderColor: "var(--border)",
                  paddingLeft: 17.101,
                  paddingRight: 17.101,
                  paddingTop: 17.101,
                  paddingBottom: 17.101,
                }}
              >
                Book not found.
              </div>
            ) : null}

            {book ? (
              <ul
                style={{
                  display: "grid",
                  gap: 11.995,
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  minWidth: 0,
                }}
              >
                {visibleBookmarks.map((bookmark) => {
                  const isHeader = bookmark.bookmark_type === "header";
                  const isHidden = bookmark.bookmark_type === "hidden";

                  return (
                    <li
                      key={bookmark.id}
                      ref={(element) => {
                        if (element) {
                          bookmarkElements.current.set(bookmark.id, element);
                          return;
                        }

                        bookmarkElements.current.delete(bookmark.id);
                      }}
                      data-bookmark-id={bookmark.id}
                      data-bookmark-paragraph={bookmark.paragraph}
                      data-bookmark-word={bookmark.word}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openMenu(bookmark);
                      }}
                      onTouchStart={(event) =>
                        handleLongPressStart(event, bookmark)
                      }
                      onTouchMove={handleLongPressMove}
                      onTouchEnd={handleLongPressEnd}
                      onTouchCancel={handleLongPressEnd}
                      className="bg-card"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        minHeight: isHeader ? 58.192 : undefined,
                        borderRadius: 10,
                        borderWidth: 1.108,
                        borderStyle: "solid",
                        borderColor: isHeader
                          ? "var(--ring)"
                          : isHidden
                            ? "var(--input)"
                            : "var(--border)",
                        backgroundColor: isHeader
                          ? "var(--secondary)"
                          : isHidden
                            ? "var(--muted)"
                            : "var(--card)",
                        paddingLeft: 17.101,
                        paddingRight: 17.101,
                        paddingTop: 17.101,
                        paddingBottom: 17.101,
                      }}
                    >
                      {isHeader ? (
                        <p
                          className="text-[16px] font-semibold leading-[24px] text-foreground"
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {bookmark.bookmark_text}
                        </p>
                      ) : (
                        <p
                          className="text-[16px] font-normal leading-[24px]"
                          style={{
                            overflowWrap: "anywhere",
                            color: isHidden
                              ? "var(--muted-foreground)"
                              : "var(--foreground)",
                          }}
                        >
                          {bookmark.bookmark_text}
                        </p>
                      )}
                    </li>
                  );
                })}

                {!visibleBookmarks.length ? (
                  <li
                    className="bg-card text-sm text-muted-foreground"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      borderRadius: 10,
                      borderWidth: 1.108,
                      borderStyle: "dashed",
                      borderColor: "var(--border)",
                      paddingLeft: 17.101,
                      paddingRight: 17.101,
                      paddingTop: 17.101,
                      paddingBottom: 17.101,
                    }}
                  >
                    No bookmarks for this filter.
                  </li>
                ) : null}
              </ul>
            ) : null}
          </section>
        </main>
      </div>

      <BookmarkContextMenu
        menuState={menuState}
        onClose={closeMenu}
        onCopy={copyBookmarkText}
        onUpdate={(bookmarkId, bookmarkType) => {
          void updateBookmarkType(bookmarkId, bookmarkType);
        }}
      />
    </>
  );
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getBookmarkResumeStorage(): BookmarkResumeStorageLike | null {
  return getBrowserStorage();
}
