Book-repeat is a web application that will help the user to:

- upload a file (SQLite db) containing list of books and bookmarks that user saved.
- make books and bookmarks are copied to the application db; only new books and bookmarks needs to be loaded. all records should be linked to the user.
- read the bookmarks
  The web app:
- will authenticate the user and then show him the app
- be consumed mostly on the mobile app so it has to have a mobile-first responsive layout
- on the bottom of the app there should be a navigation panel (like usually on mobile apps) with 2 buttons: books, upload, user
- "books" shows the list of each books available. only names of the book. tap/click on a name opens a book screen
- a book screen consist of
  -- header with a back button and the name of the book in the header + a icon-button toggling 3 states: show all / show all except hidden bookmarks / show only non hidden and non header bookmarks (see below)
  -- content area should represent just a list of bookmarks (texts) belong to current book separated by a thin line a small padding, so to be comfortable reading and scrolling
  --- if bookrmark is a header - it's shown as s small header
  --- long tap / right click on bookmark shows a context menu with a 3 buttons: header, hidden, default. clicking on the button changes the bookmark type in DB and how/if it's visible in the list (depending on the toggle set), context menu being closed.
- an 'upload' section provides an ability to upload the file and send it to the backend. what the app does with the file - below.
- the 'user' section just shows the name of the current logged in user and allows to log out - which now shows a login page (instead the app content).

Technical requirements:

- Create NextJS frontend application with Vite and Typescript, shadcn and tailwind - as an app in this monorepo
- Use Supabase as a backend, so you need to create all the required supabase entities (locally) to implement this project (include instructions on how to set up the supabase locally in the readme and how to deploy it to production)

  File upload:

- user will upload SQLite db file (example of the sqlite file is ./data/fb2-old-a5.db)
- user may upload files generated on the same source or different source. They may contain none / some / all the same books and bookmarks.
- you need to upload the file to the storage, import data from the file, delete the file
- here is a definition of the important tables inside the file:
  CREATE TABLE "Books" (
  "book_id" INTEGER,
  "title" TEXT,
  "encoding" TEXT,
  "language" TEXT,
  "exists" INTEGER DEFAULT 1,
  PRIMARY KEY("book_id" AUTOINCREMENT)
  );
  CREATE TABLE "Bookmarks" (
  "bookmark_id" INTEGER,
  "uid" TEXT(36) NOT NULL UNIQUE,
  "version_uid" TEXT(36),
  "book_id" INTEGER NOT NULL,
  "visible" INTEGER DEFAULT 1,
  "style_id" INTEGER NOT NULL DEFAULT 1,
  "bookmark_text" TEXT NOT NULL,
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
  "original_text" TEXT DEFAULT NULL,
  PRIMARY KEY("bookmark_id"),
  FOREIGN KEY("book_id") REFERENCES "Books"("book_id"),
  FOREIGN KEY("style_id") REFERENCES "HighlightingStyle"("style_id")
  );
  CREATE TABLE "Authors" (
  "author_id" INTEGER,
  "name" TEXT NOT NULL,
  "sort_key" TEXT NOT NULL,
  PRIMARY KEY("author_id"),
  CONSTRAINT "Authors_Unique" UNIQUE("name","sort_key")
  );
  CREATE TABLE "BookAuthor" (
  "author_id" INTEGER NOT NULL,
  "book_id" INTEGER NOT NULL,
  "author_index" INTEGER NOT NULL,
  CONSTRAINT "BookAuthor_Unique0" UNIQUE("author_id","book_id"),
  CONSTRAINT "BookAuthor_Unique1" UNIQUE("book_id","author_index"),
  FOREIGN KEY("author_id") REFERENCES "Authors"("author_id"),
  FOREIGN KEY("book_id") REFERENCES "Books"("book_id")
  );
  CREATE TABLE "BookUid" (
  "book_id" INTEGER NOT NULL UNIQUE,
  "type" TEXT NOT NULL,
  "uid" TEXT NOT NULL,
  CONSTRAINT "BookUid_Unique" UNIQUE("book_id","type","uid"),
  FOREIGN KEY("book_id") REFERENCES "Books"("book_id")
  );

- guide on source DB structure:
  -- books.title - use to store book title
  -- authors.name - take authors's names, use BookAuthor to link authors and store all the authors as a single text field inside book records
  -- use BookUid.uid as a unique id which is solid across different uploaded files (for deduplication), use BookUid.book_id to link it with the book. Store book's uid in the target db so to avoid uploading duplicates
  -- use Bookmarks.uid as a unique key for bookmarks. Use Bookmarks.bookd_id -> BookUid.book_id -> BookUid.uid to link it to the book
  -- use Bookmarks.bookmark_text as bookmark's text, but also save Bookmarks.paragraph and Bookmarks.word fields and sort bookmarks by them (within the book) when presenting bookmarks for a book
