import path from "node:path";
import initSqlJs from "sql.js";

import { normalizeBookmarkType } from "./domain.ts";

interface RawSourceBook {
  source_book_id: number;
  title: string;
  authors: string;
  source_hashes: string;
}

interface RawBookmark {
  source_uid: string;
  source_book_id: number;
  bookmark_text: string;
  paragraph: number;
  word: number;
  style_id: number | null;
  visible: number | null;
  creation_time: number | null;
  modification_time: number | null;
}

export interface ImportedSourceBook {
  source_book_id: number;
  title: string;
  authors: string;
  source_hashes: string[];
}

export interface ImportedBookmark {
  source_uid: string;
  source_book_id: number;
  bookmark_text: string;
  paragraph: number;
  word: number;
  source_style_id: number | null;
  source_visible: number | null;
  source_creation_time: number | null;
  source_modification_time: number | null;
  bookmark_type: "default" | "header" | "hidden";
}

export interface ImportPayload {
  books: ImportedSourceBook[];
  bookmarks: ImportedBookmark[];
  diagnostics: {
    sourceTables: string[];
    bookHash: {
      totalRows: number;
      distinctBookCount: number;
      multiHashBookCount: number;
      multiHashBookSamples: Array<{
        bookId: number;
        hashCount: number;
        hashes: string[];
      }>;
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

function getScalarNumber(
  db: { exec: (sql: string) => { columns: string[]; values: unknown[][] }[] },
  sql: string,
): number {
  const result = db.exec(sql)[0];
  const value = result?.values?.[0]?.[0];

  return typeof value === "number" ? value : Number(value ?? 0);
}

function parseDelimitedHashes(rawHashes: string | null): string[] {
  if (!rawHashes) {
    return [];
  }

  return rawHashes
    .split(",")
    .map((hash) => hash.trim())
    .filter((hash) => hash.length > 0);
}

function getBookHashDiagnostics(
  db: { exec: (sql: string) => { columns: string[]; values: unknown[][] }[] },
  hasBookHash: boolean,
): ImportPayload["diagnostics"]["bookHash"] {
  if (!hasBookHash) {
    return null;
  }

  const totalRows = getScalarNumber(db, `SELECT COUNT(*) FROM BookHash`);
  const distinctBookCount = getScalarNumber(
    db,
    `SELECT COUNT(DISTINCT book_id) FROM BookHash`,
  );
  const multiHashBookCount = getScalarNumber(
    db,
    `
      SELECT COUNT(*)
      FROM (
        SELECT book_id
        FROM BookHash
        GROUP BY book_id
        HAVING COUNT(*) > 1
      ) multi_hash_books
    `,
  );
  const multiHashBookSamplesQuery = db.exec(`
    SELECT
      bh.book_id AS book_id,
      COUNT(*) AS hash_count,
      GROUP_CONCAT(hash_value, ',') AS hashes
    FROM (
      SELECT book_id, hash AS hash_value
      FROM BookHash
      ORDER BY book_id, timestamp DESC, hash ASC
    ) bh
    GROUP BY bh.book_id
    HAVING COUNT(*) > 1
    ORDER BY hash_count DESC, bh.book_id ASC
    LIMIT 10
  `)[0];
  const multiHashBookSamplesRows = multiHashBookSamplesQuery
    ? mapRows<{
        book_id: number;
        hash_count: number;
        hashes: string;
      }>(multiHashBookSamplesQuery.columns, multiHashBookSamplesQuery.values)
    : [];
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
      GROUP_CONCAT(hash_value, ',') AS hashes
    FROM (
      SELECT book_id, timestamp, hash AS hash_value
      FROM BookHash
      ORDER BY book_id, timestamp DESC, hash ASC
    ) bh
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
    distinctBookCount,
    multiHashBookCount,
    multiHashBookSamples: multiHashBookSamplesRows.map((row) => ({
      bookId: Number(row.book_id),
      hashCount: Number(row.hash_count),
      hashes: parseDelimitedHashes(String(row.hashes ?? "")),
    })),
    tiedLatestBookCount,
    tiedLatestBookSamples: tiedLatestBookSamplesRows.map((row) => ({
      bookId: Number(row.book_id),
      timestamp: Number(row.timestamp),
      candidateCount: Number(row.candidate_count),
      hashes: parseDelimitedHashes(String(row.hashes ?? "")),
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
            SELECT
              b.book_id AS source_book_id,
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
              ), '') AS authors,
              COALESCE((
                SELECT GROUP_CONCAT(hash_value, ',')
                FROM (
                  SELECT bh.hash AS hash_value
                  FROM BookHash bh
                  WHERE bh.book_id = b.book_id
                  ORDER BY bh.timestamp DESC, bh.hash ASC
                ) ordered_hashes
              ), '') AS source_hashes
            FROM Books b
            WHERE EXISTS (
              SELECT 1
              FROM BookHash bh
              WHERE bh.book_id = b.book_id
            )
            ORDER BY b.book_id
          `
        : `
            SELECT
              b.book_id AS source_book_id,
              b.title AS title,
              '' AS authors,
              COALESCE((
                SELECT GROUP_CONCAT(hash_value, ',')
                FROM (
                  SELECT bh.hash AS hash_value
                  FROM BookHash bh
                  WHERE bh.book_id = b.book_id
                  ORDER BY bh.timestamp DESC, bh.hash ASC
                ) ordered_hashes
              ), '') AS source_hashes
            FROM Books b
            WHERE EXISTS (
              SELECT 1
              FROM BookHash bh
              WHERE bh.book_id = b.book_id
            )
            ORDER BY b.book_id
          `
      : null;

  const bookmarksSql =
    hasBookmarks && hasBookHash
      ? `
          SELECT
            bm.uid AS source_uid,
            bm.book_id AS source_book_id,
            bm.bookmark_text AS bookmark_text,
            bm.paragraph AS paragraph,
            bm.word AS word,
            bm.style_id AS style_id,
            bm.visible AS visible,
            bm.creation_time AS creation_time,
            bm.modification_time AS modification_time
          FROM Bookmarks bm
          WHERE EXISTS (
            SELECT 1
            FROM BookHash bh
            WHERE bh.book_id = bm.book_id
          )
          ORDER BY bm.paragraph, bm.word, bm.bookmark_id
        `
      : null;

  const booksResult = booksSql ? db.exec(booksSql) : [];

  const bookmarksResult = bookmarksSql ? db.exec(bookmarksSql) : [];

  const booksQuery = booksResult[0];
  const bookmarksQuery = bookmarksResult[0];

  const booksRows: RawSourceBook[] = booksQuery
    ? mapRows<RawSourceBook>(booksQuery.columns, booksQuery.values)
    : [];
  const bookmarksRows: RawBookmark[] = bookmarksQuery
    ? mapRows<RawBookmark>(bookmarksQuery.columns, bookmarksQuery.values)
    : [];

  db.close();

  return {
    books: booksRows.map((book) => ({
      source_book_id: Number(book.source_book_id),
      title: String(book.title),
      authors: String(book.authors),
      source_hashes: parseDelimitedHashes(String(book.source_hashes ?? "")),
    })),
    bookmarks: bookmarksRows.map((bookmark) => ({
      source_uid: String(bookmark.source_uid),
      source_book_id: Number(bookmark.source_book_id),
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
