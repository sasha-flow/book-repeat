BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "Authors" (
"author_id" INTEGER,
"name" TEXT NOT NULL,
"sort_key" TEXT NOT NULL,
"search_key" TEXT,
PRIMARY KEY("author_id"),
CONSTRAINT "Authors_Unique" UNIQUE("name","sort_key")
);
CREATE TABLE IF NOT EXISTS "BookAuthor" (
"author_id" INTEGER NOT NULL,
"book_id" INTEGER NOT NULL,
"author_index" INTEGER NOT NULL,
CONSTRAINT "BookAuthor_Unique0" UNIQUE("author_id","book_id"),
CONSTRAINT "BookAuthor_Unique1" UNIQUE("book_id","author_index"),
FOREIGN KEY("author_id") REFERENCES "Authors"("author_id"),
FOREIGN KEY("book_id") REFERENCES "Books"("book_id")
);
CREATE TABLE IF NOT EXISTS "BookHash" (
"book_id" INTEGER NOT NULL,
"hash" TEXT(40) NOT NULL UNIQUE,
"timestamp" INTEGER NOT NULL,
FOREIGN KEY("book_id") REFERENCES "Books"("book_id")
);
CREATE TABLE IF NOT EXISTS "BookHistory" (
"book_id" INTEGER,
"timestamp" INTEGER NOT NULL,
"event" INTEGER NOT NULL,
FOREIGN KEY("book_id") REFERENCES "Books"("book_id")
);
CREATE TABLE IF NOT EXISTS "BookLabel" (
"label_id" INTEGER NOT NULL,
"book_id" INTEGER NOT NULL,
"timestamp" INTEGER NOT NULL DEFAULT -1,
"uid" TEXT(36) NOT NULL UNIQUE,
CONSTRAINT "BookLabel_Unique" UNIQUE("label_id","book_id"),
FOREIGN KEY("book_id") REFERENCES "Books"("book_id"),
FOREIGN KEY("label_id") REFERENCES "Labels"("label_id")
);
CREATE TABLE IF NOT EXISTS "BookOption" (
"book_id" INTEGER NOT NULL,
"key" TEXT NOT NULL,
"value" TEXT NOT NULL,
CONSTRAINT "BookOption_Unique" UNIQUE("book_id","key"),
FOREIGN KEY("book_id") REFERENCES "Books"("book_id")
);
CREATE TABLE IF NOT EXISTS "BookReadingProgress" (
"book_id" INTEGER,
"numerator" INTEGER NOT NULL,
"denominator" INTEGER NOT NULL,
PRIMARY KEY("book_id"),
FOREIGN KEY("book_id") REFERENCES "Books"("book_id")
);
CREATE TABLE IF NOT EXISTS "BookSeries" (
"book_id" INTEGER NOT NULL,
"series_id" INTEGER NOT NULL,
"book_index" TEXT,
CONSTRAINT "BookSeries_Unique" UNIQUE("series_id","book_id"),
FOREIGN KEY("book_id") REFERENCES "Books"("book_id"),
FOREIGN KEY("series_id") REFERENCES "Series"("series_id")
);
CREATE TABLE IF NOT EXISTS "BookState" (
"book_id" INTEGER NOT NULL UNIQUE,
"paragraph" INTEGER NOT NULL,
"word" INTEGER NOT NULL,
"char" INTEGER NOT NULL,
"timestamp" INTEGER,
FOREIGN KEY("book_id") REFERENCES "Books"("book_id")
);
CREATE TABLE IF NOT EXISTS "BookTag" (
"tag_id" INTEGER NOT NULL,
"book_id" INTEGER NOT NULL,
CONSTRAINT "BookTag_Unique" UNIQUE("tag_id","book_id"),
FOREIGN KEY("book_id") REFERENCES "Books"("book_id"),
FOREIGN KEY("tag_id") REFERENCES "Tags"("tag_id")
);
CREATE TABLE IF NOT EXISTS "BookUri" (
"book_id" INTEGER NOT NULL,
"uri_id" INTEGER NOT NULL UNIQUE,
FOREIGN KEY("book_id") REFERENCES "Books"("book_id"),
FOREIGN KEY("uri_id") REFERENCES "Uri"("uri_id")
);
CREATE TABLE IF NOT EXISTS "Bookmarks" (
"bookmark_id" INTEGER,
"uid" TEXT(36) NOT NULL UNIQUE,
"version_uid" TEXT(36),
"book_id" INTEGER NOT NULL,
"visible" INTEGER DEFAULT 1,
"style_id" INTEGER NOT NULL DEFAULT 1,
"bookmark_text" TEXT NOT NULL,
"original_text" TEXT DEFAULT NULL,
"creation_time" INTEGER NOT NULL,
"modification_time" INTEGER,
"access_time" INTEGER,
"model_id" TEXT,
"paragraph" INTEGER NOT NULL,
"word" INTEGER NOT NULL,
"char" INTEGER NOT NULL,
"end_paragraph" INTEGER,
"end_word" INTEGER,
"end_character" INTEGER,
PRIMARY KEY("bookmark_id"),
FOREIGN KEY("book_id") REFERENCES "Books"("book_id"),
FOREIGN KEY("style_id") REFERENCES "HighlightingStyle"("style_id")
);
CREATE TABLE IF NOT EXISTS "Books" (
"book_id" INTEGER,
"title" TEXT,
"encoding" TEXT,
"language" TEXT,
"exists" INTEGER DEFAULT 1,
"title_key" TEXT,
"search_key" TEXT,
PRIMARY KEY("book_id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "DeletedBookLabelIds" (
"uid" TEXT(36),
PRIMARY KEY("uid")
);
CREATE TABLE IF NOT EXISTS "DeletedBookmarkIds" (
"uid" TEXT(36),
PRIMARY KEY("uid")
);
CREATE TABLE IF NOT EXISTS "HighlightingStyle" (
"style_id" INTEGER,
"name" TEXT NOT NULL,
"bg_color" INTEGER NOT NULL,
"fg_color" INTEGER NOT NULL DEFAULT -1,
"timestamp" INTEGER DEFAULT 0,
"deleted" INTEGER NOT NULL DEFAULT 0,
PRIMARY KEY("style_id")
);
CREATE TABLE IF NOT EXISTS "Labels" (
"label_id" INTEGER,
"uid" TEXT(36) NOT NULL UNIQUE,
"name" TEXT NOT NULL UNIQUE,
PRIMARY KEY("label_id")
);
CREATE TABLE IF NOT EXISTS "Options" (
"name" TEXT,
"value" TEXT,
PRIMARY KEY("name")
);
CREATE TABLE IF NOT EXISTS "ScanList" (
"path" TEXT NOT NULL UNIQUE,
"size" INTEGER NOT NULL,
"timestamp" INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS "Series" (
"series_id" INTEGER,
"name" TEXT NOT NULL UNIQUE,
"search_key" TEXT,
PRIMARY KEY("series_id")
);
CREATE TABLE IF NOT EXISTS "Tags" (
"tag_id" INTEGER,
"name" TEXT NOT NULL,
"parent_id" INTEGER,
"search_key" TEXT,
CONSTRAINT "Tags_Unique" UNIQUE("name","parent_id"),
PRIMARY KEY("tag_id"),
FOREIGN KEY("parent_id") REFERENCES "Tags"("tag_id")
);
CREATE TABLE IF NOT EXISTS "Uri" (
"uri_id" INTEGER,
"uri" TEXT NOT NULL UNIQUE,
"root_scheme" TEXT NOT NULL,
"last_modified" INTEGER NOT NULL,
"mime" TEXT,
"search_key" TEXT,
PRIMARY KEY("uri_id")
);
CREATE TABLE IF NOT EXISTS "VisitedHyperlinks" (
"book_id" INTEGER NOT NULL,
"hyperlink_id" TEXT NOT NULL,
CONSTRAINT "VisitedHyperlinks_Unique" UNIQUE("book_id","hyperlink_id"),
FOREIGN KEY("book_id") REFERENCES "Books"("book_id")
);
CREATE TABLE IF NOT EXISTS "android_metadata" (
"locale" TEXT
);
CREATE INDEX IF NOT EXISTS "BookAuthor_BookIndex" ON "BookAuthor" (
"book_id"
);
CREATE INDEX IF NOT EXISTS "BookTag_BookIndex" ON "BookTag" (
"book_id"
);
COMMIT;
