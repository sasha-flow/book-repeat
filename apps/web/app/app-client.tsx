"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  BookOpen,
  FileUp,
  Filter,
  User as UserIcon,
} from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
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
import { getSupabaseBrowserClient } from "../lib/supabase/client";

type Tab = "books" | "upload" | "user";

interface MenuState {
  bookmarkId: string;
  x: number;
  y: number;
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
          <CardTitle>Book Repeat</CardTitle>
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

export function AppClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("books");
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookRecord | null>(null);
  const [bookmarkFilter, setBookmarkFilter] = useState<BookmarkFilter>("all");
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  const visibleBookmarks = applyBookmarkFilter(bookmarks, bookmarkFilter);

  const loadBooks = async () => {
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

    setBooks(data ?? []);
  };

  const loadBookmarks = async (bookId: string) => {
    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, book_id, bookmark_text, paragraph, word, bookmark_type")
      .eq("book_id", bookId)
      .order("paragraph", { ascending: true })
      .order("word", { ascending: true });

    if (error) {
      setUploadMessage(error.message);
      return;
    }

    setBookmarks((data ?? []) as BookmarkRecord[]);
  };

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

  useEffect(() => {
    if (!session) {
      setBooks([]);
      setBookmarks([]);
      setSelectedBook(null);
      return;
    }

    void loadBooks();
  }, [session]);

  const openMenu = (bookmarkId: string, x: number, y: number) => {
    setMenuState({ bookmarkId, x, y });
  };

  const handleLongPressStart = (
    event: React.TouchEvent<HTMLLIElement>,
    bookmarkId: string,
  ) => {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    longPressTimer.current = window.setTimeout(() => {
      openMenu(bookmarkId, touch.clientX, touch.clientY);
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
    setMenuState(null);

    const { error } = await supabase
      .from("bookmarks")
      .update({ bookmark_type: bookmarkType })
      .eq("id", bookmarkId);

    if (error) {
      setUploadMessage(error.message);
      return;
    }

    setBookmarks((current) =>
      current.map((bookmark) =>
        bookmark.id === bookmarkId
          ? { ...bookmark, bookmark_type: bookmarkType }
          : bookmark,
      ),
    );

    await loadBooks();
  };

  const openBook = (book: BookRecord) => {
    setSelectedBook(book);
    setBookmarkFilter("all");
    void loadBookmarks(book.id);
  };

  const uploadFile = async (file: File) => {
    if (!session) {
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append("file", file);

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
      setUploadMessage(responseJson.error ?? "Import failed");
      return;
    }

    const deletedText = responseJson.fileDeleted
      ? "File deleted"
      : "Delete retry needed";
    setUploadMessage(
      `Imported books: ${responseJson.books ?? 0}, bookmarks: ${responseJson.bookmarks ?? 0}. ${deletedText}.`,
    );

    await loadBooks();
  };

  if (loadingSession) {
    return <main className="p-6 text-sm">Loading...</main>;
  }

  if (!session) {
    return <AuthScreen onSignedIn={setSession} />;
  }

  const userLabel =
    session.user.user_metadata.name ?? session.user.email ?? session.user.id;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="border-b px-4 py-3">
        <h1 className="text-base font-semibold">Book Repeat</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-3">
        {activeTab === "books" ? (
          selectedBook ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    className="h-9 w-9 bg-transparent text-foreground shadow-none hover:bg-accent"
                    onClick={() => {
                      setSelectedBook(null);
                      setBookmarks([]);
                    }}
                    aria-label="Back to books"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="line-clamp-1 text-sm font-semibold">
                    {selectedBook.title}
                  </h2>
                </div>
                <Button
                  className="h-8 border border-input bg-background px-3 text-xs text-foreground shadow-none hover:bg-accent"
                  onClick={() =>
                    setBookmarkFilter((current) => nextBookmarkFilter(current))
                  }
                >
                  <Filter className="mr-1 h-4 w-4" />
                  {bookmarkFilterLabels[bookmarkFilter]}
                </Button>
              </div>

              <ul className="divide-y rounded-md border">
                {visibleBookmarks.map((bookmark) => (
                  <li
                    key={bookmark.id}
                    className="p-3"
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openMenu(bookmark.id, event.clientX, event.clientY);
                    }}
                    onTouchStart={(event) =>
                      handleLongPressStart(event, bookmark.id)
                    }
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                  >
                    {bookmark.bookmark_type === "header" ? (
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {bookmark.bookmark_text}
                      </p>
                    ) : (
                      <p className="text-sm leading-6">
                        {bookmark.bookmark_text}
                      </p>
                    )}
                  </li>
                ))}
                {!visibleBookmarks.length ? (
                  <li className="p-3 text-sm text-muted-foreground">
                    No bookmarks for this filter.
                  </li>
                ) : null}
              </ul>
            </section>
          ) : (
            <section className="space-y-2">
              {loadingBooks ? (
                <p className="text-sm text-muted-foreground">
                  Loading books...
                </p>
              ) : null}
              <ul className="divide-y rounded-md border">
                {books.map((book) => (
                  <li key={book.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-3 text-left text-sm"
                      onClick={() => openBook(book)}
                    >
                      {book.title}
                    </button>
                  </li>
                ))}
                {!books.length && !loadingBooks ? (
                  <li className="px-3 py-4 text-sm text-muted-foreground">
                    No books yet. Upload a file.
                  </li>
                ) : null}
              </ul>
            </section>
          )
        ) : null}

        {activeTab === "upload" ? (
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
                    void uploadFile(file);
                    event.currentTarget.value = "";
                  }}
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground">
                  Only new and changed books/bookmarks will be upserted for your
                  account.
                </p>
                {uploadMessage ? (
                  <p className="text-sm">{uploadMessage}</p>
                ) : null}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {activeTab === "user" ? (
          <section className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">User</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-medium">{userLabel}</p>
                </div>
                <Button
                  className="border border-input bg-background text-foreground shadow-none hover:bg-accent"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setSession(null);
                  }}
                >
                  Log out
                </Button>
              </CardContent>
            </Card>
          </section>
        ) : null}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t bg-background">
        <div className="mx-auto flex w-full max-w-md items-center justify-around px-2 py-2">
          <button
            type="button"
            className="flex flex-col items-center gap-1 px-3 py-1 text-xs"
            onClick={() => setActiveTab("books")}
          >
            <BookOpen className="h-4 w-4" />
            <span>Books</span>
            {activeTab === "books" ? <Badge>●</Badge> : null}
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 px-3 py-1 text-xs"
            onClick={() => setActiveTab("upload")}
          >
            <FileUp className="h-4 w-4" />
            <span>Upload</span>
            {activeTab === "upload" ? <Badge>●</Badge> : null}
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 px-3 py-1 text-xs"
            onClick={() => setActiveTab("user")}
          >
            <UserIcon className="h-4 w-4" />
            <span>User</span>
            {activeTab === "user" ? <Badge>●</Badge> : null}
          </button>
        </div>
      </nav>

      {menuState ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setMenuState(null)}
            aria-label="Close context menu"
          />
          <div
            className="fixed z-50 min-w-40 rounded-md border bg-card p-1 shadow-lg"
            style={{ left: menuState.x, top: menuState.y }}
          >
            <button
              type="button"
              className="block w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
              onClick={() => updateBookmarkType(menuState.bookmarkId, "header")}
            >
              Header
            </button>
            <button
              type="button"
              className="block w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
              onClick={() => updateBookmarkType(menuState.bookmarkId, "hidden")}
            >
              Hidden
            </button>
            <button
              type="button"
              className="block w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
              onClick={() =>
                updateBookmarkType(menuState.bookmarkId, "default")
              }
            >
              Default
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
