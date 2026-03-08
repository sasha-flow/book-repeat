# Book Repeat Monorepo

Book Repeat is a mobile-first web app for uploading SQLite bookmark databases, deduplicating and storing records per user, and reading bookmarks by book.

## Workspace layout

- `apps/web`: product app (Next.js App Router)
- `packages/ui`: reusable shared shadcn-style component package
- `supabase`: local Supabase project config and SQL migrations

## Prerequisites

- Node.js `>= 18`
- `pnpm`
- Supabase CLI
- Docker (required by local Supabase)

## Install and run

```bash
pnpm install
pnpm dev
```

Run only web app:

```bash
pnpm --filter web dev
```

## Local Supabase setup

1. Start local services:

```bash
supabase start
```

2. Apply migration in `supabase/migrations`:

```bash
supabase db reset
```

3. Get local project keys:

```bash
supabase status
```

`supabase start` / `supabase status` prints values like:

- `Project URL` (for example `http://127.0.0.1:54321`)
- `Publishable` (sometimes labeled `anon` in older CLI output)
- `Secret` (sometimes labeled `service_role` in older CLI output)

4. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill:

- `NEXT_PUBLIC_SUPABASE_URL` = `Project URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `Publishable` (or `anon`)
- `SUPABASE_SERVICE_ROLE_KEY` = `Secret` (or `service_role`)
- `SUPABASE_IMPORT_BUCKET` (default `imports`)

Example:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_IMPORT_BUCKET=imports
```

## Production deployment

1. Create a Supabase project in Supabase Cloud.
2. Link local project:

```bash
supabase link --project-ref <your-project-ref>
```

3. Push schema migrations:

```bash
supabase db push
```

4. Configure app environment variables in your hosting provider with production Supabase values.
5. Deploy `apps/web` as a Next.js app.

## Dependency policy

- Install new dependencies as latest stable versions.
- Run workspace update checks with:

```bash
pnpm run deps:check
pnpm run deps:update
```

- If a latest dependency breaks compatibility, use temporary `pnpm.overrides` and remove it as soon as upstream fixes are available.
