# Data Model And Storage

## Summary

This feature document captures the application-level persistence behavior and storage expectations that support the current product behavior.

Detailed schema, table fields, constraints, RLS policies, and database-side merge mechanics live in `specs/db.md`.

## Persistence responsibilities

- canonical books persist user-visible book records for browsing and reading
- source hash aliases persist cross-device reconciliation state for imported books
- bookmarks persist user-readable imported content and current bookmark type
- import runs persist lightweight operational history for completed imports

## Storage model

- uploaded SQLite files are stored in the private `imports` bucket
- objects are written into a folder named after the authenticated user's id
- users can upload, read, and delete only objects in their own folder according to storage policies

## Application integrity rules

- bookmarks always reference canonical books, not transient source-book identities
- source `BookHash` rows can accumulate over time for the same canonical book
- canonical books are merged when one imported hash set overlaps multiple existing canonical books for the same user
- deleting a canonical book removes its bookmarks and hash aliases
- deleting a user removes imported books, aliases, bookmarks, and import runs
- bookmarks are displayed in source order using `(paragraph, word)`

## Security rules

- the persisted model is owner-scoped through row-level security and storage policies
- browser-side reads and normal updates are expected to use RLS-constrained clients
- server-side import writes are expected to happen only after token validation via the service-role client

## Out of scope

- cross-user shared datasets
- soft delete and archive layers
- immutable import snapshots
- separate author entity in the target application schema
