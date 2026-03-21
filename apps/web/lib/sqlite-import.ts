import path from "node:path";
import initSqlJs from "sql.js";

import { normalizeBookmarkType } from "./domain.ts";

interface RawBook {
  source_hash: string;
  title: string;
  authors: string;
}

interface RawBookmark {
  source_uid: string;
  book_source_hash: string;
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
    source_hash: string;
    title: string;
    authors: string;
  }>;
  bookmarks: Array<{
    source_uid: string;
    book_source_hash: string;
    bookmark_text: string;
    paragraph: number;
    word: number;
    source_style_id: number | null;
    source_visible: number | null;
    source_creation_time: number | null;
    source_modification_time: number | null;
    bookmark_type: "default" | "header" | "hidden";
  }>;
  diagnostics: {
    sourceTables: string[];
    bookHash: {
      totalRows: number;
      selectedRows: number;
      tiedLatestBookCount: number;
      tiedLatestBookSamples: Array<{
        bookId: number;
        timestamp: number;
        candidateCount: number;
        hashes: string[];
      }>;
    } | null;
  };
}

function mapRows<T>(columns: string[], values: unknown[][]): T[] {
  return values.map((row) => {
    return columns.reduce<Record<string, unknown>>((acc, col, index) => {
      acc[col] = row[index] ?? null;
      return acc;
    }, {}) as T;
  });
}

function getExistingTables(db: {
  exec: (sql: string) => { columns: string[]; values: unknown[][] }[];
}): Set<string> {
  const tablesResult = db.exec(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `);

  const tablesQuery = tablesResult[0];

  if (!tablesQuery) {
    return new Set();
  }

  const rows = mapRows<{ name: string }>(
    tablesQuery.columns,
    tablesQuery.values,
  );

  return new Set(rows.map((row) => String(row.name)));
}

function getLatestBookHashCte(): string {
  return `
    WITH latest_book_hash AS (
      SELECT bh.book_id, bh.hash, bh.timestamp
      FROM BookHash bh
      WHERE NOT EXISTS (
        SELECT 1
        FROM BookHash newer
        WHERE newer.book_id = bh.book_id
          AND (
            newer.timestamp > bh.timestamp
            OR (newer.timestamp = bh.timestamp AND newer.hash < bh.hash)
          )
      )
    )
  `;
}

function getScalarNumber(
  db: { exec: (sql: string) => { columns: string[]; values: unknown[][] }[] },
  sql: string,
): number {
  const result = db.exec(sql)[0];
  const value = result?.values?.[0]?.[0];

  return typeof value === "number" ? value : Number(value ?? 0);
}

function getBookHashDiagnostics(
  db: { exec: (sql: string) => { columns: string[]; values: unknown[][] }[] },
  hasBookHash: boolean,
): ImportPayload["diagnostics"]["bookHash"] {
  if (!hasBookHash) {
    return null;
  }

  const totalRows = getScalarNumber(db, `SELECT COUNT(*) FROM BookHash`);
  const selectedRows = getScalarNumber(
    db,
    `
      ${getLatestBookHashCte()}
      SELECT COUNT(*)
      FROM latest_book_hash
    `,
  );
  const tiedLatestBookCount = getScalarNumber(
    db,
    `
      WITH latest_timestamp AS (
        SELECT book_id, MAX(timestamp) AS latest_timestamp
        FROM BookHash
        GROUP BY book_id
      )
      SELECT COUNT(*)
      FROM (
        SELECT bh.book_id
        FROM BookHash bh
        JOIN latest_timestamp latest
          ON latest.book_id = bh.book_id
         AND latest.latest_timestamp = bh.timestamp
        GROUP BY bh.book_id, bh.timestamp
        HAVING COUNT(*) > 1
      ) tied_books
    `,
  );
  const tiedLatestBookSamplesQuery = db.exec(`
    WITH latest_timestamp AS (
      SELECT book_id, MAX(timestamp) AS latest_timestamp
      FROM BookHash
      GROUP BY book_id
    )
    SELECT
      bh.book_id AS book_id,
      bh.timestamp AS timestamp,
      COUNT(*) AS candidate_count,
      GROUP_CONCAT(bh.hash, ',') AS hashes
    FROM BookHash bh
    JOIN latest_timestamp latest
      ON latest.book_id = bh.book_id
     AND latest.latest_timestamp = bh.timestamp
    GROUP BY bh.book_id, bh.timestamp
    HAVING COUNT(*) > 1
    ORDER BY candidate_count DESC, bh.book_id ASC
    LIMIT 10
  `)[0];
  const tiedLatestBookSamplesRows = tiedLatestBookSamplesQuery
    ? mapRows<{
        book_id: number;
        timestamp: number;
        candidate_count: number;
        hashes: string;
      }>(tiedLatestBookSamplesQuery.columns, tiedLatestBookSamplesQuery.values)
    : [];

  return {
    totalRows,
    selectedRows,
    tiedLatestBookCount,
    tiedLatestBookSamples: tiedLatestBookSamplesRows.map((row) => ({
      bookId: Number(row.book_id),
      timestamp: Number(row.timestamp),
      candidateCount: Number(row.candidate_count),
      hashes: String(row.hashes)
        .split(",")
        .filter((hash) => hash.length > 0),
    })),
  };
}

export async function parseSqlitePayload(
  fileBuffer: ArrayBuffer,
): Promise<ImportPayload> {
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(process.cwd(), "node_modules/sql.js/dist", file),
  });

  const db = new SQL.Database(new Uint8Array(fileBuffer));
  const existingTables = getExistingTables(db);
  const hasBooks = existingTables.has("Books");
  const hasBookHash = existingTables.has("BookHash");
  const hasAuthors = existingTables.has("Authors");
  const hasBookAuthor = existingTables.has("BookAuthor");
  const hasBookmarks = existingTables.has("Bookmarks");
  const bookHashDiagnostics = getBookHashDiagnostics(db, hasBookHash);

  const booksSql =
    hasBooks && hasBookHash
      ? hasAuthors && hasBookAuthor
        ? `
            ${getLatestBookHashCte()}
            SELECT
              lbh.hash AS source_hash,
              b.title AS title,
              COALESCE((
                SELECT GROUP_CONCAT(author_name, ', ')
                FROM (
                  SELECT a.name AS author_name
                  FROM BookAuthor ba
                  JOIN Authors a ON a.author_id = ba.author_id
                  WHERE ba.book_id = b.book_id
                  ORDER BY ba.author_index
                ) ordered_authors
              ), '') AS authors
            FROM Books b
            JOIN latest_book_hash lbh ON lbh.book_id = b.book_id
            ORDER BY b.book_id
          `
        : `
            ${getLatestBookHashCte()}
            SELECT
              lbh.hash AS source_hash,
              b.title AS title,
              '' AS authors
            FROM Books b
            JOIN latest_book_hash lbh ON lbh.book_id = b.book_id
            ORDER BY b.book_id
          `
      : null;

  const bookmarksSql =
    hasBookmarks && hasBookHash
      ? `
          ${getLatestBookHashCte()}
          SELECT
            bm.uid AS source_uid,
            lbh.hash AS book_source_hash,
            bm.bookmark_text AS bookmark_text,
            bm.paragraph AS paragraph,
            bm.word AS word,
            bm.style_id AS style_id,
            bm.visible AS visible,
            bm.creation_time AS creation_time,
            bm.modification_time AS modification_time
          FROM Bookmarks bm
          JOIN latest_book_hash lbh ON lbh.book_id = bm.book_id
          ORDER BY bm.paragraph, bm.word, bm.bookmark_id
        `
      : null;

  const booksResult = booksSql ? db.exec(booksSql) : [];

  const bookmarksResult = bookmarksSql ? db.exec(bookmarksSql) : [];

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
      source_hash: String(book.source_hash),
      title: String(book.title),
      authors: String(book.authors),
    })),
    bookmarks: bookmarksRows.map((bookmark) => ({
      source_uid: String(bookmark.source_uid),
      book_source_hash: String(bookmark.book_source_hash),
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
    diagnostics: {
      sourceTables: Array.from(existingTables).sort(),
      bookHash: bookHashDiagnostics,
    },
  };
}
