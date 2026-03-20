# Architecture

## Overview

Book Repeat is implemented as a pnpm monorepo with a single product application and shared configuration packages.

Core architecture choices:

- Next.js App Router for the web client and server route handling
- Supabase for authentication, Postgres persistence, row-level security, and object storage
- `sql.js` for server-side parsing of uploaded SQLite database files
- shared UI primitives in a workspace package

## Repository structure

- `apps/web`: application code, UI, routes, import endpoint, and Supabase clients
- `packages/ui`: reusable UI primitives used by the app
- `packages/eslint-config`: shared lint rules
- `packages/typescript-config`: shared TypeScript settings
- `supabase`: local Supabase configuration and SQL migrations
- `specs`: product and engineering documentation

## Runtime boundaries

### Browser client

The browser client is responsible for:

- session-aware rendering
- tab navigation inside the mobile-first shell
- fetching books and bookmarks from Supabase
- applying client-side bookmark visibility filters
- sending bookmark type updates
- managing the reader's modal bottom sheet and its close behavior
- uploading SQLite files to the server import route

Most user-facing state lives in the client-side application shell implemented in `apps/web/app/app-client.tsx`.

### Server route

The import endpoint lives at `apps/web/app/api/import-sqlite/route.ts`.

Its responsibilities are:

- validate that a file exists in the request
- validate the caller by resolving the bearer token through Supabase Auth
- upload the raw file into the configured Supabase Storage bucket
- parse the SQLite payload on the server
- upsert books and bookmarks into Postgres
- delete the uploaded object from storage
- record an `import_runs` summary row

This route is the boundary between untrusted uploaded content and application persistence.

### Supabase service client

The service-role Supabase client is used only on the server.

It handles:

- auth token introspection for the incoming request
- privileged storage operations for import files
- privileged upserts into `books`, `bookmarks`, and `import_runs`

The browser client continues to rely on row-level security for normal user-scoped reads and updates.

## Authentication model

Authentication is provided by Supabase Auth using email/password credentials.

Application behavior:

- the client reads the current session on startup
- auth state changes update the rendered shell in real time
- unauthenticated users only see the auth screen
- authenticated users can access only their own rows through row-level security

## Data model

### Books

`books` stores user-scoped book records imported from the source SQLite database.

Key fields:

- `user_id`: owner of the row
- `source_uid`: stable book identifier from the source database
- `title`: imported book title
- `authors`: flattened author list as a single text field

Uniqueness is enforced by `(user_id, source_uid)`.

### Bookmarks

`bookmarks` stores user-scoped bookmark records linked to a stored book.

Key fields:

- `user_id`: owner of the row
- `source_uid`: stable bookmark identifier from the source database
- `book_id`: reference to the imported book
- `bookmark_text`: imported bookmark text
- `paragraph` and `word`: source position fields used for ordering
- `bookmark_type`: application enum with `default`, `header`, and `hidden`
- source metadata columns copied from the SQLite file for traceability

Uniqueness is enforced by `(user_id, source_uid)`.

### Import runs

`import_runs` stores lightweight summaries of completed import attempts.

It captures:

- user id
- original file name
- imported book count
- imported bookmark count
- storage deletion error if cleanup failed

### Storage

The `imports` bucket stores uploaded SQLite files temporarily during import processing.

Objects are written under a user-specific path prefix and deleted after processing.

## Import pipeline

The current import pipeline is synchronous inside the request lifecycle.

1. The browser sends `multipart/form-data` with the selected file.
2. The server validates the bearer token.
3. The raw file is uploaded to the `imports` storage bucket.
4. The file bytes are parsed with `sql.js`.
5. Books are read from `BookUid`, `Books`, `BookAuthor`, and `Authors`.
6. Bookmarks are read from `Bookmarks` and mapped to application bookmark rows.
7. Books are upserted by `(user_id, source_uid)`.
8. Returned book ids are used to map bookmark rows to stored books.
9. Bookmarks are upserted by `(user_id, source_uid)`.
10. The uploaded storage object is deleted.
11. An `import_runs` row is inserted.

This pipeline favors correctness and deduplication over asynchronous throughput.

## Source SQLite mapping

The application currently interprets source data as follows:

- `BookUid.uid` becomes the stored `books.source_uid`
- `Books.title` becomes `books.title`
- `Authors.name` values are flattened into `books.authors`
- `Bookmarks.uid` becomes `bookmarks.source_uid`
- `Bookmarks.bookmark_text` becomes `bookmarks.bookmark_text`
- `Bookmarks.paragraph` and `Bookmarks.word` are used for ordering
- source `visible` and `style_id` are normalized into the application `bookmark_type`

Normalization rules:

- `visible = 0` maps to `hidden`
- `style_id = 2` maps to `header` when the bookmark is not hidden
- all other cases map to `default`

## Reader filtering model

Reader filtering is client-side and built on top of persisted `bookmark_type` values.

Filter states:

- `all`: no filtering
- `without-hidden`: exclude `hidden`
- `reading`: exclude `hidden` and `header`

Current user-facing labels:

- `all` -> `All`
- `without-hidden` -> `Visible`
- `reading` -> `Text`

This keeps the database model simple while letting the UI provide multiple reading views without duplicating data.

When the `all` filter is active, `hidden` bookmarks remain visible but are rendered with muted visual treatment so they are distinguishable from normal reading content.

## Security model

Security is primarily enforced through Supabase row-level security and storage policies.

Current protections:

- `books`, `bookmarks`, and `import_runs` enforce user ownership through RLS policies
- storage object policies restrict upload, read, and delete operations to objects inside the current user's folder
- server import writes use a service-role client only after validating the request token

## Operational characteristics

- imports run inline during the HTTP request
- uploaded files are intended to be short-lived
- the client depends on environment variables for Supabase project URL and keys
- production schema management is migration-driven through the `supabase` directory

## Current limitations

- no background worker or queue for large imports
- no dedicated import history UI
- no automated conflict reporting beyond route errors and import summary fields
- no multi-source reconciliation beyond per-user UID deduplication
