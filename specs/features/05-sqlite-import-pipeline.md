# SQLite Import Pipeline

## Summary

This feature covers the end-to-end import of a source SQLite bookmark database into the application's Supabase-backed data model.

## Current behavior

- the user selects a SQLite file from the `Upload` tab
- the client sends the file to the import API route together with the current auth token
- the server uploads the file to the `imports` bucket
- the server parses source books, authors, and bookmarks from SQLite
- books are upserted by `(user_id, source_uid)`
- bookmarks are upserted by `(user_id, source_uid)` after mapping them to stored books
- the uploaded storage object is deleted after processing
- the server writes an `import_runs` summary row

## Source mapping rules

- `BookUid.uid` is the stable unique identifier for books
- `Bookmarks.uid` is the stable unique identifier for bookmarks
- `Books.title` maps to stored book title
- author names are flattened into one stored text field
- bookmark order is captured with `paragraph` and `word`
- source `visible` and `style_id` values are normalized into the application bookmark type

## Business rules

- imports are user-scoped
- re-importing overlapping files should not duplicate stored rows for the same user
- imported files are temporary processing artifacts and should not remain in storage after a successful cleanup
- import success reporting includes counts and storage cleanup status

## Data dependencies

- storage bucket `imports`
- `books`, `bookmarks`, and `import_runs` tables
- source SQLite tables: `Books`, `Bookmarks`, `Authors`, `BookAuthor`, and `BookUid`

## Out of scope

- asynchronous background imports
- resumable uploads
- UI for browsing previous import runs
- partial import conflict resolution tools
