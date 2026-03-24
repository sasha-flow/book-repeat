# Book Repeat Monorepo

Book Repeat is a mobile-first web application for importing SQLite bookmark databases into Supabase and reading imported bookmarks by book.

The current implementation supports:

- email/password authentication with Supabase Auth, including account creation from the signed-out screen
- a mobile-first application shell with bottom navigation for `Books`, `Upload`, and `Profile`
- SQLite file upload, parsing, user-scoped deduplication, and import run logging
- a searchable books list
- a per-book reading screen with bookmark visibility filters
- bookmark type changes between `default`, `header`, and `hidden`

Deeper project documentation lives under [specs/product.md](specs/product.md), [specs/architecture.md](specs/architecture.md), [specs/db.md](specs/db.md), [specs/infra.md](specs/infra.md), [specs/design.md](specs/design.md), and [specs/features.md](specs/features.md).

## Workspace layout

- `apps/web`: product app built with Next.js App Router, TypeScript, Tailwind, and Supabase
- `packages/ui`: shared shadcn-style UI primitives used by the web app
- `packages/eslint-config`: shared ESLint configuration
- `packages/typescript-config`: shared TypeScript configuration
- `supabase`: local Supabase configuration and SQL migrations
- `specs`: product, architecture, and feature documentation

## Product flow

1. The user signs in or creates an account.
2. The authenticated app opens in a mobile-first shell.
3. In `Upload`, the user selects a SQLite database file exported from the source reader app.
4. The backend uploads the file to Supabase Storage, parses source books plus all of their `BookHash` values, resolves or merges one canonical user-scoped book per overlapping hash set, upserts bookmarks, writes an import summary, and deletes the uploaded file.
5. In `Books`, the user browses imported books and opens a book detail screen.
6. In the book detail screen, the user reads bookmarks, cycles the visibility filter, and changes bookmark types from the context menu.
7. In `Profile`, the user sees the current account email, can change appearance settings, and can sign out.

## Prerequisites

- Node.js `>= 24`
- `pnpm`
- Supabase CLI
- Docker for local Supabase services

## Install and run

Install dependencies and start the workspace:

```bash
pnpm install
pnpm dev
```

Run only the web app:

```bash
pnpm --filter web dev
```

## Local Supabase setup

1. Start local Supabase services:

```bash
supabase start
```

2. Reset the local database and apply tracked migrations:

```bash
supabase db reset
```

3. Read the local project credentials:

```bash
supabase status
```

The command prints values such as:

- `Project URL` for example `http://127.0.0.1:54321`
- `Publishable` sometimes labeled `anon` by older Supabase CLI versions
- `Secret` sometimes labeled `service_role` by older Supabase CLI versions

4. Copy `apps/web/.env.example` to `apps/web/.env.local` and update the values:

- `NEXT_PUBLIC_SUPABASE_URL` = local `Project URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = local `Publishable` or `anon`
- `SUPABASE_SERVICE_ROLE_KEY` = local `Secret` or `service_role`
- `SUPABASE_IMPORT_BUCKET` = optional bucket override, defaults to `imports`

Example:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_IMPORT_BUCKET=imports
```

## Useful commands

Run app checks:

```bash
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web check-types
pnpm --filter web build
```

Run workspace-level checks:

```bash
pnpm lint
pnpm check-types
pnpm build
pnpm format
```

## Dependency policy

- install new dependencies at the latest stable version
- prefer package manager commands over manual version edits
- use workspace maintenance commands when checking or updating dependencies
- the workspace currently pins TypeScript `5.9.2` in root and app packages so local and CI type generation stay reproducible

```bash
pnpm run deps:check
pnpm run deps:update
```
