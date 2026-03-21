# Data Model And Storage

## Summary

This feature document captures the core persisted entities and storage rules that support the current application behavior.

## Persistent entities

### Books

Stored fields:

- application id
- owning user id
- source hash
- title
- flattened authors text
- created and updated timestamps

Uniqueness rule:

- one row per `(user_id, source_hash)`

### Bookmarks

Stored fields:

- application id
- owning user id
- source UID
- referenced book id
- bookmark text
- paragraph and word ordering fields
- application bookmark type
- copied source metadata fields
- created and updated timestamps

Uniqueness rule:

- one row per `(user_id, source_uid)`

### Import runs

Stored fields:

- application id
- owning user id
- source file name
- imported books count
- imported bookmarks count
- storage delete error
- creation timestamp

## Storage model

- uploaded SQLite files are stored in the private `imports` bucket
- objects are written into a folder named after the authenticated user's id
- users can upload, read, and delete only objects in their own folder according to storage policies

## Integrity and ordering rules

- bookmarks reference books through `book_id`
- books are deduplicated by a deterministic `source_hash` selection from source `BookHash` rows
- deleting a book cascades to its bookmarks
- deleting a user cascades to imported books, bookmarks, and import runs
- bookmarks are displayed in source order using `(paragraph, word)`

## Security rules

- row-level security is enabled on `books`, `bookmarks`, and `import_runs`
- select, insert, update, and delete access is restricted to row owners where applicable
- storage policies enforce the same user boundary for import files

## Out of scope

- cross-user shared datasets
- soft delete and archive layers
- immutable import snapshots
- separate author entity in the target application schema
