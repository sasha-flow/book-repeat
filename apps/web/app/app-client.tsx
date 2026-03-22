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
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  EyeOff,
  FileUp,
  Filter,
  Heading,
  Search,
  Type,
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
  applyBookmarkFilter,
  nextBookmarkFilter,
} from "../lib/bookmark-filters";
import { getOpaqueHeaderSurfaceStyle } from "../lib/book-detail-styles";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { ThemeToggle } from "./theme-toggle";

type Tab = "books" | "upload" | "user";

interface MenuState {
  bookmarkId: string;
  bookmarkText: string;
  currentType: BookmarkType;
}

function getTabFromSearchParam(value: string | null): Tab {
  if (value === "upload" || value === "user") {
    return value;
  }

  return "books";
}

function getTabHref(tab: Tab): string {
  if (tab === "books") {
    return "/";
  }

  return `/?tab=${tab}`;
}

function AuthScreen({
  onSignedIn,
}: {
  onSignedIn: (session: Session) => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
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

function ShellNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof BookOpen;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex flex-1 flex-col items-center justify-center gap-[3.998px] px-0 pb-[calc(env(safe-area-inset-bottom)+10.004px)] pt-[10.005px] text-[12px] leading-[16px] transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
      style={{
        paddingTop: 10.005,
        paddingBottom: "calc(env(safe-area-inset-bottom) + 10.004px)",
      }}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-[23.99px]" strokeWidth={1.9} />
      <span className="font-normal">{label}</span>
    </button>
  );
}

function AppShell({
  activeTab,
  onTabChange,
  children,
  overlay,
  header,
  bottomBar,
  pinChrome,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
  overlay?: ReactNode;
  header?: ReactNode;
  bottomBar?: ReactNode;
  pinChrome?: boolean;
}) {
  const headerClassName = pinChrome
    ? "fixed top-0 left-0 right-0 z-20"
    : "sticky top-0 z-20";
  const navClassName = pinChrome
    ? "fixed bottom-0 left-0 right-0 z-20"
    : "sticky bottom-0 z-20 mt-auto";
  const bottomBarClassName = pinChrome
    ? "fixed bottom-[65.098px] left-0 right-0 z-20"
    : "sticky bottom-[65.098px] z-20 mt-auto";
  const mainClassName = pinChrome ? "flex-1 px-4 py-3" : "flex-1";
  const mainStyle = pinChrome
    ? undefined
    : {
        paddingLeft: 15.993,
        paddingRight: 15.993,
        paddingTop: 23.99,
        paddingBottom: bottomBar ? 134.177 : 65.098,
      };

  return (
    <div
      className="mx-auto flex min-h-screen w-full flex-col bg-background text-foreground"
      style={{ maxWidth: 393.256 }}
    >
      {header ? (
        <>
          {pinChrome ? (
            <div
              aria-hidden="true"
              className="mx-auto w-full max-w-md border-b px-4 py-3 invisible pointer-events-none"
            >
              {header}
            </div>
          ) : null}
          <header className={headerClassName}>
            <div className="mx-auto w-full max-w-md border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              {header}
            </div>
          </header>
        </>
      ) : null}

      <main className={mainClassName} style={mainStyle}>
        {children}
      </main>

      {bottomBar ? (
        <div className={bottomBarClassName}>
          <div
            className="mx-auto h-[69.079px] w-full border-t-[1.108px] border-border bg-background"
            style={{
              maxWidth: 393.256,
              paddingLeft: 15.993,
              paddingRight: 15.993,
              paddingTop: 17.101,
            }}
          >
            {bottomBar}
          </div>
        </div>
      ) : null}

      {pinChrome ? (
        <div
          aria-hidden="true"
          className="mx-auto w-full invisible pointer-events-none"
          style={{ maxWidth: 393.256 }}
        >
          <div className="flex h-[65.098px] items-stretch border-t-[1.108px] border-border bg-background">
            <div className="flex flex-1 flex-col items-center justify-center gap-[3.998px] pb-[calc(env(safe-area-inset-bottom)+10.004px)] pt-[10.005px] text-[12px] leading-[16px] text-foreground">
              <BookOpen className="size-[23.99px]" strokeWidth={1.9} />
              <span className="font-normal">Books</span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-[3.998px] pb-[calc(env(safe-area-inset-bottom)+10.004px)] pt-[10.005px] text-[12px] leading-[16px] text-muted-foreground">
              <FileUp className="size-[23.99px]" strokeWidth={1.9} />
              <span className="font-normal">Upload</span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-[3.998px] pb-[calc(env(safe-area-inset-bottom)+10.004px)] pt-[10.005px] text-[12px] leading-[16px] text-muted-foreground">
              <UserIcon className="size-[23.99px]" strokeWidth={1.9} />
              <span className="font-normal">Profile</span>
            </div>
          </div>
        </div>
      ) : null}

      <nav className={navClassName}>
        <div
          className="mx-auto flex h-[65.098px] w-full items-stretch border-t-[1.108px] border-border bg-background"
          style={{ maxWidth: 393.256 }}
        >
          <ShellNavButton
            active={activeTab === "books"}
            icon={BookOpen}
            label="Books"
            onClick={() => onTabChange("books")}
          />
          <ShellNavButton
            active={activeTab === "upload"}
            icon={FileUp}
            label="Upload"
            onClick={() => onTabChange("upload")}
          />
          <ShellNavButton
            active={activeTab === "user"}
            icon={UserIcon}
            label="Profile"
            onClick={() => onTabChange("user")}
          />
        </div>
      </nav>

      {overlay}
    </div>
  );
}

function BooksList({
  books,
  loadingBooks,
}: {
  books: BookRecord[];
  loadingBooks: boolean;
}) {
  return (
    <section>
      {loadingBooks ? (
        <p className="px-1 text-sm text-muted-foreground">Loading books...</p>
      ) : null}
      <ul style={{ display: "grid", gap: 7.997 }}>
        {books.map((book) => (
          <li key={book.id}>
            <Link
              href={`/books/${book.id}`}
              className="block w-full text-left text-[16px] font-normal leading-[24px] text-foreground transition-colors hover:bg-accent/40"
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
        ))}
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
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-label="Close context menu"
      />
      <div className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto w-full" style={{ maxWidth: 393.256 }}>
          <div
            className="bg-background"
            style={{
              minHeight: 281.978,
              borderTopWidth: 1.108,
              borderTopStyle: "solid",
              borderTopColor: "var(--border)",
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              boxShadow: "0 -10px 30px rgba(3, 2, 19, 0.08)",
            }}
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = getTabFromSearchParam(searchParams.get("tab"));
  const { supabase, session, loadingSession, setSession } =
    useAuthenticatedSession();
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [bookQuery, setBookQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const deferredBookQuery = useDeferredValue(bookQuery);

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

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    const { data: bookmarkRows, error: bookmarkRowsError } = await supabase
      .from("bookmarks")
      .select("book_id")
      .neq("bookmark_type", "hidden")
      .neq("bookmark_type", "header");

    if (bookmarkRowsError) {
      setLoadingBooks(false);
      setUploadMessage(bookmarkRowsError.message);
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
      setUploadMessage(error.message);
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

  const uploadFile = async (file: File) => {
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
        details?: unknown;
        books?: number;
        bookmarks?: number;
        fileDeleted?: boolean;
        deleteError?: string | null;
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

      console.info("[upload] import request completed", {
        fileName: file.name,
        fileSize: file.size,
        response: responseJson,
      });

      const deletedText = responseJson.fileDeleted
        ? "File deleted"
        : "Delete retry needed";
      setUploadMessage(
        `Imported books: ${responseJson.books ?? 0}, bookmarks: ${responseJson.bookmarks ?? 0}. ${deletedText}.`,
      );

      await loadBooks();
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
  };

  if (loadingSession) {
    return <main className="p-6 text-sm">Loading...</main>;
  }

  if (!session) {
    return <AuthScreen onSignedIn={setSession} />;
  }

  const userLabel =
    session.user.user_metadata.name ?? session.user.email ?? session.user.id;

  let content: ReactNode = null;
  let header: ReactNode = null;
  let bottomBar: ReactNode = null;

  if (activeTab === "books") {
    bottomBar = (
      <div className="relative h-[35.985px] w-full">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-[12px] top-[7.99px] size-[19.992px] text-muted-foreground"
          strokeWidth={1.9}
        />
        <Input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={bookQuery}
          onChange={(event) => setBookQuery(event.target.value)}
          placeholder="Search books..."
          aria-label="Search books"
          className="h-[35.985px] rounded-[8px] border-[1.108px] border-input bg-muted/70 px-0 py-0 text-[16px] font-normal text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0"
          style={{
            paddingLeft: 40,
            paddingRight: 12,
            paddingTop: 4,
            paddingBottom: 4,
            WebkitAppearance: "none",
            appearance: "none",
          }}
        />
      </div>
    );

    content = <BooksList books={visibleBooks} loadingBooks={loadingBooks} />;
  }

  if (activeTab === "upload") {
    header = <h2 className="text-sm font-semibold">Upload</h2>;

    content = (
      <UploadSection
        uploading={uploading}
        uploadMessage={uploadMessage}
        onUpload={(file) => {
          void uploadFile(file);
        }}
      />
    );
  }

  if (activeTab === "user") {
    header = <h2 className="text-sm font-semibold">User</h2>;

    content = (
      <UserSection
        userLabel={userLabel}
        onLogout={async () => {
          await supabase.auth.signOut();
          setSession(null);
        }}
      />
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={(tab) => {
        router.replace(getTabHref(tab));
      }}
      header={header}
      bottomBar={bottomBar}
    >
      {content}
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
  const [bookmarkFilter, setBookmarkFilter] =
    useState<BookmarkFilter>("without-hidden");
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const menuHistoryActive = useRef(false);

  const visibleBookmarks = applyBookmarkFilter(bookmarks, bookmarkFilter);

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

  const handleLongPressStart = (
    event: TouchEvent<HTMLLIElement>,
    bookmark: BookmarkRecord,
  ) => {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    longPressTimer.current = window.setTimeout(() => {
      openMenu(bookmark);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

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
            <div
              className="relative border-b border-border bg-background"
              style={{
                ...opaqueHeaderSurfaceStyle,
                height: 65.081,
                borderBottomWidth: 1.108,
                borderBottomColor: "var(--border)",
              }}
            >
              <button
                type="button"
                className="absolute flex items-center justify-center rounded-[10px] text-foreground transition-colors hover:bg-accent"
                style={{
                  left: 15.993,
                  top: 12,
                  width: 39.983,
                  height: 39.983,
                }}
                onClick={() => {
                  router.push("/");
                }}
                aria-label="Back to books"
              >
                <ArrowLeft className="size-[23.99px]" strokeWidth={1.9} />
              </button>

              <div
                className="absolute flex items-center justify-center px-2"
                style={{
                  left: 55.98,
                  right: 55.98,
                  top: 17,
                  height: 30,
                }}
              >
                <h1 className="line-clamp-1 text-center text-[20px] font-medium leading-[30px] text-foreground">
                  {book?.title ?? "Book bookmarks"}
                </h1>
              </div>

              <button
                type="button"
                className="absolute flex flex-col items-center justify-center rounded-[10px] text-foreground transition-colors hover:bg-accent"
                style={{
                  right: 15.993,
                  top: 12,
                  width: 39.983,
                  height: 39.983,
                  gap: 1.5,
                }}
                onClick={() =>
                  setBookmarkFilter((current) => nextBookmarkFilter(current))
                }
                aria-label={`Change bookmark filter. Current filter: ${bookmarkFilterLabels[bookmarkFilter]}`}
              >
                <Filter className="size-[18px]" strokeWidth={1.9} />
                <span className="text-[10px] leading-[10px] text-foreground">
                  {bookmarkFilterLabels[bookmarkFilter]}
                </span>
              </button>
            </div>
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
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openMenu(bookmark);
                      }}
                      onTouchStart={(event) =>
                        handleLongPressStart(event, bookmark)
                      }
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
