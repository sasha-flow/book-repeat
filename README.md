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

4. Create `apps/web/.env.local` and fill:

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

## Production CI/CD

The repository includes two GitHub Actions workflows for the `main` branch:

- `.github/workflows/web-main-check.yml`: validates the `apps/web` app on pushes and pull requests targeting `main`
- `.github/workflows/supabase-production.yml`: validates Supabase migrations on pull requests to `main` and applies them on pushes to `main`

### Web app checks

The web workflow runs on every push to `main` and every pull request targeting `main`.

It does the following:

1. installs dependencies
2. runs `pnpm --filter web lint`
3. runs `pnpm --filter web build`

### Supabase production workflow

The Supabase workflow also runs on every push to `main` and every pull request targeting `main`.

It does the following:

1. links the production Supabase Cloud project
2. runs `supabase db push --dry-run` on pull requests and pushes to validate migrations
3. runs `supabase db push` on pushes to `main`

Pull requests do not mutate production. The actual production database push only runs for `push` events on `main`.

### GitHub setup

Add these GitHub Actions variables before enabling the workflows:

- `SUPABASE_PROJECT_ID`: production Supabase project reference used by `supabase link`

Add these GitHub Actions secrets before enabling the workflows:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: production Supabase anon or publishable key used during the GitHub web build
- `SUPABASE_DB_PASSWORD`: database password for the production Supabase project
- `SUPABASE_ACCESS_TOKEN`: Supabase access token for non-interactive CLI usage

The web workflow derives `NEXT_PUBLIC_SUPABASE_URL` from `SUPABASE_PROJECT_ID` as `https://{project-ref}.supabase.co`.

### Vercel production environment

Vercel should be configured separately to auto-deploy the `main` branch.

Add these production environment variables in the Vercel project linked to `apps/web`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_IMPORT_BUCKET` if you want a value other than the default `imports`

### Production environment checklist

1. Create or choose the production Supabase project in Supabase Cloud.
2. Copy its project reference into the `SUPABASE_PROJECT_ID` GitHub variable.
3. Copy its anon key, database password, and Supabase access token into the GitHub secrets listed above.
4. Create or link a Vercel project whose root directory is `apps/web`.
5. Connect Vercel Git integration so pushes to `main` publish the production app.
6. Add the production runtime environment variables in Vercel.
7. Open a pull request to `main` to validate both workflows.
8. Merge to `main` to apply the Supabase migrations and let Vercel publish the app.

### Important notes

- The Supabase workflow does not run `supabase config push` because `supabase/config.toml` contains local-only values such as `localhost` auth URLs.
- The `imports` storage bucket is provisioned by the tracked SQL migration, so it is created when the production database is migrated.
- `NEXT_PUBLIC_` variables are build-time values for Next.js. Keep the derived GitHub build value and the Vercel runtime value aligned.

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
