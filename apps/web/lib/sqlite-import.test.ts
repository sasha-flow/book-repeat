import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import initSqlJs from "sql.js";

const { parseSqlitePayload } = (await import(
  new URL("./sqlite-import.ts", import.meta.url).href
)) as typeof import("./sqlite-import");

async function createSqlitePayload(statements: string[]): Promise<ArrayBuffer> {
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(process.cwd(), "node_modules/sql.js/dist", file),
  });

  const db = new SQL.Database() as unknown as {
    run: (sql: string) => void;
    export: () => Uint8Array;
    close: () => void;
  };

  for (const statement of statements) {
    db.run(statement);
  }

  const exported = db.export();
  db.close();

  return Uint8Array.from(exported).buffer;
}

function sortBooksBySourceBookId<T extends { source_book_id: number }>(
  books: T[],
): T[] {
  return [...books].sort((left, right) =>
    left.source_book_id - right.source_book_id,
  );
}

test("parseSqlitePayload reads source books with all hashes and preserves author order", async () => {
  const payload = await createSqlitePayload([
    `CREATE TABLE Books (book_id INTEGER PRIMARY KEY, title TEXT);`,
    `CREATE TABLE BookHash (book_id INTEGER NOT NULL, hash TEXT NOT NULL UNIQUE, timestamp INTEGER NOT NULL);`,
    `CREATE TABLE Authors (author_id INTEGER PRIMARY KEY, name TEXT NOT NULL, sort_key TEXT NOT NULL);`,
    `CREATE TABLE BookAuthor (author_id INTEGER NOT NULL, book_id INTEGER NOT NULL, author_index INTEGER NOT NULL);`,
    `INSERT INTO Books (book_id, title) VALUES (1, 'Alpha'), (2, 'Beta');`,
    `INSERT INTO BookHash (book_id, hash, timestamp) VALUES (1, 'hash-b', 111), (1, 'hash-c', 333), (2, 'hash-a', 222);`,
    `INSERT INTO Authors (author_id, name, sort_key) VALUES (1, 'Second Author', 'second'), (2, 'First Author', 'first');`,
    `INSERT INTO BookAuthor (author_id, book_id, author_index) VALUES (1, 1, 1), (2, 1, 0);`,
  ]);

  const parsed = await parseSqlitePayload(payload);

  assert.deepEqual(sortBooksBySourceBookId(parsed.books), [
    {
      source_book_id: 1,
      title: "Alpha",
      authors: "First Author, Second Author",
      source_hashes: ["hash-c", "hash-b"],
    },
    {
      source_book_id: 2,
      title: "Beta",
      authors: "",
      source_hashes: ["hash-a"],
    },
  ]);
});

test("parseSqlitePayload reads bookmarks and maps them to the owning source book id", async () => {
  const payload = await createSqlitePayload([
    `CREATE TABLE Books (book_id INTEGER PRIMARY KEY, title TEXT);`,
    `CREATE TABLE BookHash (book_id INTEGER NOT NULL, hash TEXT NOT NULL UNIQUE, timestamp INTEGER NOT NULL);`,
    `CREATE TABLE HighlightingStyle (style_id INTEGER PRIMARY KEY, name TEXT NOT NULL, bg_color INTEGER NOT NULL, fg_color INTEGER NOT NULL DEFAULT -1, timestamp INTEGER DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0);`,
    `CREATE TABLE Bookmarks (bookmark_id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE, book_id INTEGER NOT NULL, visible INTEGER DEFAULT 1, style_id INTEGER NOT NULL DEFAULT 1, bookmark_text TEXT NOT NULL, creation_time INTEGER NOT NULL, modification_time INTEGER, paragraph INTEGER NOT NULL, word INTEGER NOT NULL, char INTEGER NOT NULL);`,
    `INSERT INTO Books (book_id, title) VALUES (7, 'Gamma');`,
    `INSERT INTO BookHash (book_id, hash, timestamp) VALUES (7, 'book-hash-7', 777);`,
    `INSERT INTO HighlightingStyle (style_id, name, bg_color) VALUES (1, 'Text', 0), (2, 'Header', 0);`,
    `INSERT INTO Bookmarks (bookmark_id, uid, book_id, visible, style_id, bookmark_text, creation_time, modification_time, paragraph, word, char) VALUES
      (1, 'bookmark-default', 7, 1, 1, 'Default bookmark', 100, 150, 3, 4, 5),
      (2, 'bookmark-header', 7, 1, 2, 'Header bookmark', 200, NULL, 6, 7, 8),
      (3, 'bookmark-hidden', 7, 0, 2, 'Hidden bookmark', 300, 350, 9, 10, 11);`,
  ]);

  const parsed = await parseSqlitePayload(payload);

  assert.deepEqual(parsed.bookmarks, [
    {
      source_uid: "bookmark-default",
      source_book_id: 7,
      bookmark_text: "Default bookmark",
      paragraph: 3,
      word: 4,
      source_style_id: 1,
      source_visible: 1,
      source_creation_time: 100,
      source_modification_time: 150,
      bookmark_type: "default",
    },
    {
      source_uid: "bookmark-header",
      source_book_id: 7,
      bookmark_text: "Header bookmark",
      paragraph: 6,
      word: 7,
      source_style_id: 2,
      source_visible: 1,
      source_creation_time: 200,
      source_modification_time: null,
      bookmark_type: "header",
    },
    {
      source_uid: "bookmark-hidden",
      source_book_id: 7,
      bookmark_text: "Hidden bookmark",
      paragraph: 9,
      word: 10,
      source_style_id: 2,
      source_visible: 0,
      source_creation_time: 300,
      source_modification_time: 350,
      bookmark_type: "hidden",
    },
  ]);
});

test("parseSqlitePayload keeps every hash for one source book when timestamps tie", async () => {
  const payload = await createSqlitePayload([
    `CREATE TABLE Books (book_id INTEGER PRIMARY KEY, title TEXT);`,
    `CREATE TABLE BookHash (book_id INTEGER NOT NULL, hash TEXT NOT NULL UNIQUE, timestamp INTEGER NOT NULL);`,
    `CREATE TABLE Bookmarks (bookmark_id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE, book_id INTEGER NOT NULL, visible INTEGER DEFAULT 1, style_id INTEGER NOT NULL DEFAULT 1, bookmark_text TEXT NOT NULL, creation_time INTEGER NOT NULL, modification_time INTEGER, paragraph INTEGER NOT NULL, word INTEGER NOT NULL, char INTEGER NOT NULL);`,
    `INSERT INTO Books (book_id, title) VALUES (3, 'Tied hash book');`,
    `INSERT INTO BookHash (book_id, hash, timestamp) VALUES (3, 'hash-z', 999), (3, 'hash-a', 999);`,
    `INSERT INTO Bookmarks (bookmark_id, uid, book_id, visible, style_id, bookmark_text, creation_time, modification_time, paragraph, word, char) VALUES (1, 'bookmark-tied', 3, 1, 1, 'Only bookmark', 100, NULL, 1, 2, 3);`,
  ]);

  const parsed = await parseSqlitePayload(payload);

  assert.deepEqual(parsed.books, [
    {
      source_book_id: 3,
      title: "Tied hash book",
      authors: "",
      source_hashes: ["hash-a", "hash-z"],
    },
  ]);

  assert.deepEqual(parsed.bookmarks, [
    {
      source_uid: "bookmark-tied",
      source_book_id: 3,
      bookmark_text: "Only bookmark",
      paragraph: 1,
      word: 2,
      source_style_id: 1,
      source_visible: 1,
      source_creation_time: 100,
      source_modification_time: null,
      bookmark_type: "default",
    },
  ]);
});
