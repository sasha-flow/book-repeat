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
- keeping the primary shell chrome pinned on the three top-level tabs
- applying the selected light, dark, or system theme to the document root
- fetching books and bookmarks from Supabase
- applying client-side bookmark visibility filters
- sending bookmark type updates
- managing the reader's modal bottom sheet and its close behavior
- uploading SQLite files to the server import route

Most user-facing state lives in the client-side application shell implemented in `apps/web/app/app-client.tsx`.

The primary shell screens (`Books`, `Upload`, and `User`) share a pinned mobile chrome layout: the optional top header, the books search bar when present, and the bottom navigation remain fixed on-screen while the main content scrolls underneath reserved layout spacers. Nested routes such as the book reader bypass this shell and render their own page-specific layout with a back action instead of the shell navigation.

The reader's bookmark action sheet is implemented as a client-side fixed overlay with a dimmed backdrop and an opaque bottom-sheet surface. On wider viewports, the overlay still uses a full-width fixed rail for modal behavior, but the visible sheet content is constrained to the same centered mobile-width column as the reader so contextual actions stay visually attached to the reading surface.

The browser also stores the selected appearance mode in local storage. Theme resolution stays entirely client-side and updates the root document class so the shared UI package CSS variables can switch between light and dark tokens.

### Server route

The import endpoint lives at `apps/web/app/api/import-sqlite/route.ts`.

Its responsibilities are:

- validate that a file exists in the request
- validate the caller by resolving the bearer token through Supabase Auth
- upload the raw file into the configured Supabase Storage bucket under a request-scoped object key
- parse the SQLite payload on the server
- resolve large source-hash alias lookups in bounded batches so Supabase PostgREST requests do not exceed URI limits
- log detailed request-scoped import diagnostics, stage transitions, cleanup attempts, and normalized failures to the server console
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

Persistent schema, RLS policies, storage ownership rules, and database-side merge behavior are documented in `specs/db.md`.

At the architecture level, the key idea is:

- `books.id` is the canonical application identity for a user's logical book
- `book_source_hashes` maps many imported source hashes to one canonical book
- `bookmarks` always point at canonical books, not transient source identities
- `import_runs` captures operational summaries rather than domain state

## Import pipeline

The current import pipeline is synchronous inside the request lifecycle.

1. The browser sends `multipart/form-data` with the selected file.
2. The server validates the bearer token.
3. The raw file is uploaded to the `imports` storage bucket.
4. The file bytes are parsed with the asset-free `sql.js` asm build on the server, which avoids runtime filesystem lookup for a separately packaged WASM asset.
5. Source books are read from `BookHash`, `Books`, `BookAuthor`, and `Authors`, with every `BookHash.hash` retained for each source `book_id`.
6. Existing canonical books are resolved through `book_source_hashes` using overlapping source hash sets.
7. If one imported hash set overlaps multiple canonical books, those canonical books are auto-merged into one deterministic winner.
8. Bookmarks are read from `Bookmarks` and mapped to canonical application book ids through the import plan.
9. Source hash aliases are upserted by `(user_id, source_hash)` in `book_source_hashes`.
10. Bookmarks are upserted by `(user_id, source_uid)`.
11. The uploaded storage object is deleted.
12. An `import_runs` row is inserted.

This pipeline favors correctness and deduplication over asynchronous throughput.

## Source SQLite mapping

The checked-in source schema reference lives in `specs/sqlite-db-structue.sql`.

Detailed source-to-target field mapping and reconciliation rules live in `specs/db.md`.

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

- `books`, `book_source_hashes`, `bookmarks`, and `import_runs` enforce user ownership through RLS policies
- storage object policies restrict upload, read, and delete operations to objects inside the current user's folder
- server import writes use a service-role client only after validating the request token

## Operational characteristics

- imports run inline during the HTTP request
- uploaded files are intended to be short-lived
- the client depends on environment variables for Supabase project URL and keys
- production schema management is migration-driven through the `supabase` directory
- the server logs request-scoped JSON import diagnostics, duplicate summaries, bounded alias-lookup metrics, and normalized failure details to the console
- the browser client logs import request failures and responses to the browser console while keeping user-facing failure text generic

## Current limitations

- no background worker or queue for large imports
- no dedicated import history UI
- no UI for inspecting import diagnostics beyond the current upload message and browser console
- no manual UI for reviewing or overriding automatic canonical-book merges
- no server-side synchronization for browser-local appearance preferences
