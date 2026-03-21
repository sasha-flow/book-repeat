# SQLite Import Pipeline

## Summary

This feature covers the end-to-end import of a source SQLite bookmark database into the application's Supabase-backed data model.

## Current behavior

- the user selects a SQLite file from the `Upload` tab
- the client sends the file to the import API route together with the current auth token
- the server uploads the file to the `imports` bucket
- the server parses source books, authors, and bookmarks from SQLite
- when multiple `BookHash` rows share the latest timestamp for one source book, the importer picks the lexicographically smallest hash
- duplicate book or bookmark rows inside the parsed payload are removed before database upserts
- books are upserted by `(user_id, source_hash)`
- bookmarks are upserted by `(user_id, source_uid)` after mapping them to stored books
- the uploaded storage object is deleted after processing
- the server writes an `import_runs` summary row
- the route logs structured import diagnostics and failures to the server console, and the browser logs failed import responses to the browser console

## Source mapping rules

- `BookHash.hash` is the stable unique identifier for books
- if several `BookHash` rows tie for the latest timestamp for one book, the smallest hash is selected deterministically
- `Bookmarks.uid` is the stable unique identifier for bookmarks
- `Bookmarks.book_id -> BookHash.book_id -> BookHash.hash` links each bookmark to its imported book
- `Books.title` maps to stored book title
- author names are flattened into one stored text field in `author_index` order
- bookmark order is captured with `paragraph` and `word`
- source `visible` and `style_id` values are normalized into the application bookmark type

## Business rules

- imports are user-scoped
- re-importing overlapping files should not duplicate stored rows for the same user
- imported files are temporary processing artifacts and should not remain in storage after a successful cleanup
- import success reporting includes counts and storage cleanup status
- import diagnostics include duplicate summaries and `BookHash` tie diagnostics in server logs

## Data dependencies

- storage bucket `imports`
- `books`, `bookmarks`, and `import_runs` tables
- source SQLite tables: `Books`, `BookHash`, `Bookmarks`, `Authors`, and `BookAuthor`

## Out of scope

- asynchronous background imports
- resumable uploads
- UI for browsing previous import runs
- partial import conflict resolution tools
