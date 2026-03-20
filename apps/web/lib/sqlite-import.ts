import path from "node:path";
import initSqlJs from "sql.js";

import { normalizeBookmarkType } from "./domain";

interface RawBook {
  source_uid: string;
  title: string;
  authors: string | null;
}

interface RawBookmark {
  source_uid: string;
  book_source_uid: string;
  bookmark_text: string;
  paragraph: number;
  word: number;
  style_id: number | null;
  visible: number | null;
  creation_time: number | null;
  modification_time: number | null;
}

interface ImportPayload {
  books: Array<{
    source_uid: string;
    title: string;
    authors: string;
  }>;
  bookmarks: Array<{
    source_uid: string;
    book_source_uid: string;
    bookmark_text: string;
    paragraph: number;
    word: number;
    source_style_id: number | null;
    source_visible: number | null;
    source_creation_time: number | null;
    source_modification_time: number | null;
    bookmark_type: "default" | "header" | "hidden";
  }>;
}

function mapRows<T>(columns: string[], values: unknown[][]): T[] {
  return values.map((row) => {
    return columns.reduce<Record<string, unknown>>((acc, col, index) => {
      acc[col] = row[index] ?? null;
      return acc;
    }, {}) as T;
  });
}

export async function parseSqlitePayload(
  fileBuffer: ArrayBuffer,
): Promise<ImportPayload> {
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(process.cwd(), "node_modules/sql.js/dist", file),
  });

  const db = new SQL.Database(new Uint8Array(fileBuffer));

  const booksResult = db.exec(`
    SELECT
      bu.uid AS source_uid,
      b.title AS title,
      GROUP_CONCAT(a.name, ', ') AS authors
    FROM BookUid bu
    JOIN Books b ON b.book_id = bu.book_id
    LEFT JOIN BookAuthor ba ON ba.book_id = b.book_id
    LEFT JOIN Authors a ON a.author_id = ba.author_id
    GROUP BY bu.uid, b.title
  `);

  const bookmarksResult = db.exec(`
    SELECT
      bm.uid AS source_uid,
      bu.uid AS book_source_uid,
      bm.bookmark_text AS bookmark_text,
      bm.paragraph AS paragraph,
      bm.word AS word,
      bm.style_id AS style_id,
      bm.visible AS visible,
      bm.creation_time AS creation_time,
      bm.modification_time AS modification_time
    FROM Bookmarks bm
    JOIN BookUid bu ON bu.book_id = bm.book_id
  `);

  const booksQuery = booksResult[0];
  const bookmarksQuery = bookmarksResult[0];

  const booksRows: RawBook[] = booksQuery
    ? mapRows<RawBook>(booksQuery.columns, booksQuery.values)
    : [];
  const bookmarksRows: RawBookmark[] = bookmarksQuery
    ? mapRows<RawBookmark>(bookmarksQuery.columns, bookmarksQuery.values)
    : [];

  db.close();

  return {
    books: booksRows.map((book) => ({
      source_uid: String(book.source_uid),
      title: String(book.title),
      authors: book.authors ? String(book.authors) : "",
    })),
    bookmarks: bookmarksRows.map((bookmark) => ({
      source_uid: String(bookmark.source_uid),
      book_source_uid: String(bookmark.book_source_uid),
      bookmark_text: String(bookmark.bookmark_text),
      paragraph: Number(bookmark.paragraph ?? 0),
      word: Number(bookmark.word ?? 0),
      source_style_id:
        bookmark.style_id === null ? null : Number(bookmark.style_id),
      source_visible:
        bookmark.visible === null ? null : Number(bookmark.visible),
      source_creation_time:
        bookmark.creation_time === null ? null : Number(bookmark.creation_time),
      source_modification_time:
        bookmark.modification_time === null
          ? null
          : Number(bookmark.modification_time),
      bookmark_type: normalizeBookmarkType(
        bookmark.visible === null ? null : Number(bookmark.visible),
        bookmark.style_id === null ? null : Number(bookmark.style_id),
      ),
    })),
  };
}
