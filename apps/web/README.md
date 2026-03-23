# Book Repeat Web App

## What it does

- Authenticates users with Supabase Auth.
- Supports sign-in and sign-up with Supabase Auth.
- Shows mobile-first app shell with bottom navigation: `Books`, `Upload`, `Profile`.
- Imports uploaded SQLite bookmark files to Supabase (`books`, `book_source_hashes`, and `bookmarks`), deduplicated by canonical book hash sets and bookmark UID.
- Allows per-book bookmark reading with filter toggle and bookmark type context menu (`default`, `header`, `hidden`).

## Environment variables

Copy `apps/web/.env.example` to `apps/web/.env.local` and set values from `supabase start` (or `supabase status`):

- `NEXT_PUBLIC_SUPABASE_URL` = `Project URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `Publishable` (or `anon` in older CLI output)
- `SUPABASE_SERVICE_ROLE_KEY` = `Secret` (or `service_role` in older CLI output)
- `SUPABASE_IMPORT_BUCKET` (default `imports`)

Example local values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_IMPORT_BUCKET=imports
```

## Run

```bash
pnpm --filter web dev
```

## Build checks

```bash
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web check-types
pnpm --filter web build
```

## Import flow

1. User picks a SQLite file in `Upload` tab.
2. API route stores file in Supabase Storage bucket (`imports`).
3. Server parses source tables (`Books`, `BookHash`, `Bookmarks`, `Authors`, `BookAuthor`).
4. Server groups each source book by all of its `BookHash` rows, resolves existing canonical books by overlapping hash sets, and auto-merges canonical books when one import bridges multiple existing hash groups.
5. Server upserts hash aliases into `book_source_hashes` and bookmarks into `bookmarks`.
6. Server logs detailed import diagnostics, planning, merge results, and failures to the terminal, and the browser logs failed import responses to the console.
7. Deletes uploaded file from storage and writes `import_runs` summary.
