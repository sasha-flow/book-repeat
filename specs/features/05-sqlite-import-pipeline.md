# SQLite Import Pipeline

## Summary

This feature covers the end-to-end import of a source SQLite bookmark database into the application's Supabase-backed data model.

## Current behavior

- the user selects a SQLite file from the `Upload` tab
- the client sends the file to the import API route together with the current auth token
- the server uploads the file to the `imports` bucket
- the server parses source books, all `BookHash` rows for each source book, authors, and bookmarks from SQLite
- the server resolves canonical books by overlapping source hash sets stored in `book_source_hashes`
- if one imported hash set overlaps multiple existing canonical books, the importer auto-merges them into one winner before writing aliases and bookmarks
- duplicate bookmark rows inside the parsed payload are removed before database upserts
- canonical books are created or updated in `books`, while source hashes are upserted by `(user_id, source_hash)` in `book_source_hashes`
- bookmarks are upserted by `(user_id, source_uid)` after mapping source `book_id` values to canonical book ids
- the uploaded storage object is deleted after processing
- the server writes an `import_runs` summary row
- the route logs structured parsing diagnostics, canonical-book planning, merge results, and failures to the server console, and the browser logs failed import responses to the browser console

## Source mapping rules

- each source `Books.book_id` is imported with all of its `BookHash.hash` values
- canonical books are matched by any overlapping `BookHash.hash` stored in `book_source_hashes`
- if several source books or existing canonical books are connected by overlapping hashes, they collapse into one canonical book for that user
- `Bookmarks.uid` is the stable unique identifier for bookmarks
- `Bookmarks.book_id` links each bookmark to the imported source book, which is then resolved to one canonical application book through the import plan
- `Books.title` maps to stored book title
- author names are flattened into one stored text field in `author_index` order
- bookmark order is captured with `paragraph` and `word`
- source `visible` and `style_id` values are normalized into the application bookmark type

## Business rules

- imports are user-scoped
- re-importing overlapping files should not duplicate stored rows for the same user
- importing a file that bridges multiple existing canonical books should merge them automatically for that user
- imported files are temporary processing artifacts and should not remain in storage after a successful cleanup
- import success reporting includes counts and storage cleanup status
- import diagnostics include duplicate summaries, `BookHash` distribution diagnostics, canonical merge planning, and merge execution results in server logs

## Data dependencies

- storage bucket `imports`
- application persistence described in `specs/db.md`, especially `books`, `book_source_hashes`, `bookmarks`, and `import_runs`
- source SQLite tables: `Books`, `BookHash`, `Bookmarks`, `Authors`, and `BookAuthor`

## Out of scope

- asynchronous background imports
- resumable uploads
- UI for browsing previous import runs
- partial import conflict resolution tools
