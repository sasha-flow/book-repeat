# Book Repeat Web App

## What it does

- Authenticates users with Supabase Auth.
- Shows mobile-first app shell with bottom navigation: `Books`, `Upload`, `User`.
- Imports uploaded SQLite bookmark files to Supabase (`books` + `bookmarks`), deduplicated by source UID.
- Allows per-book bookmark reading with filter toggle and bookmark type context menu (`default`, `header`, `hidden`).

## Environment variables

Copy `.env.example` to `.env.local` and set values from `supabase start` (or `supabase status`):

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
pnpm --filter web lint
pnpm --filter web check-types
pnpm --filter web build
```

## Import flow

1. User picks a SQLite file in `Upload` tab.
2. API route stores file in Supabase Storage bucket (`imports`).
3. Server parses source tables (`Books`, `Bookmarks`, `Authors`, `BookAuthor`, `BookUid`).
4. Upserts user-scoped records into `books` and `bookmarks`.
5. Deletes uploaded file from storage and writes `import_runs` summary.
