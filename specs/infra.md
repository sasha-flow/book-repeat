# Infrastructure

## Overview

Book Repeat is delivered as a pnpm monorepo with a single Next.js application, shared workspace packages, local Supabase tooling for development, and GitHub Actions for continuous validation and migration delivery.

The current infrastructure model is intentionally small:

- one deployable web application in `apps/web`
- shared workspace packages for UI, linting, and TypeScript configuration
- Supabase as the external platform for authentication, database, and storage
- GitHub Actions for automated checks and Supabase migration rollout

This document describes the currently implemented infrastructure only.

## Repository and build system

The repository is managed as a monorepo with `pnpm` workspaces and Turborepo task orchestration.

Relevant top-level areas:

- `apps/web`: Next.js application runtime and server routes
- `packages/ui`: shared UI primitives consumed by the web app
- `packages/eslint-config`: shared lint configuration
- `packages/typescript-config`: shared TypeScript configuration
- `supabase`: local Supabase configuration and tracked SQL migrations

Primary workspace commands:

- `pnpm install` installs all workspace dependencies
- `pnpm dev` starts the workspace development flow
- `pnpm lint`, `pnpm check-types`, and `pnpm build` run workspace-level verification tasks

For web-only work, the repository also supports filtered commands such as `pnpm --filter web dev`.

## Application runtime

The product runtime is centered on the `apps/web` Next.js application.

Current runtime characteristics:

- Next.js App Router application
- TypeScript codebase
- Tailwind-based styling
- browser and server integration with Supabase

The deployed application requires Supabase-backed authentication and database access. The import flow also requires privileged server access through the Supabase service role key.

## Local development environment

Local development depends on the following tools:

- Node.js `>= 18`
- `pnpm`
- Supabase CLI
- Docker for local Supabase services

The expected local setup flow is:

1. Install workspace dependencies with `pnpm install`.
2. Start local Supabase services with `supabase start`.
3. Reset the local database and apply tracked migrations with `supabase db reset`.
4. Inspect local Supabase credentials with `supabase status`.
5. Create `apps/web/.env.local` with the required environment variables.
6. Start the app with `pnpm dev` or `pnpm --filter web dev`.

## Local Supabase services

Supabase is the local infrastructure dependency for development and testing.

The repository uses local Supabase services for:

- Auth
- Postgres
- Storage
- migration application during local resets

The local status output is used to populate application environment variables:

- `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
- `Publishable` or `anon` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `Secret` or `service_role` -> `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_IMPORT_BUCKET` is optional and defaults to `imports`.

## Environment variables

The current application infrastructure expects these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL used by the browser application
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon or publishable key used by the browser application
- `SUPABASE_SERVICE_ROLE_KEY`: server-side service role key used by privileged import operations
- `SUPABASE_IMPORT_BUCKET`: optional storage bucket override, defaults to `imports`

Operational expectations:

- `NEXT_PUBLIC_` variables are build-time values for Next.js
- production values must point to the same deployed Supabase project
- the service role key must be available only in trusted server environments

## Continuous integration

The repository currently defines two GitHub Actions workflows under `.github/workflows`.

### Web validation workflow

`web-main-check.yml` validates the web application on pushes and pull requests targeting `main`.

Current behavior:

1. checks out the repository
2. installs `pnpm` using `pnpm/action-setup@v4`
3. installs Node.js `24` using `actions/setup-node@v4` with pnpm cache enabled
4. installs dependencies with `pnpm install --frozen-lockfile`
5. runs `pnpm --filter web lint`
6. runs `pnpm --filter web build`

Workflow environment:

- `CI=true`
- `NEXT_PUBLIC_SUPABASE_URL` is derived from `SUPABASE_PROJECT_ID` as `https://{project-ref}.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is provided from GitHub Actions secrets

The workflow uses a concurrency group keyed by the Git ref and cancels in-progress runs for the same ref.

### Supabase migration workflow

`supabase-production.yml` validates and deploys tracked Supabase migrations for pushes and pull requests targeting `main`.

Current behavior:

- `validate-migrations` runs on pull requests and pushes
- `deploy-migrations` runs only on push events after validation succeeds

Validation and deployment flow:

1. checks out the repository
2. installs the latest Supabase CLI through `supabase/setup-cli@v1`
3. links the production Supabase project using `supabase link --project-ref "$SUPABASE_PROJECT_ID" -p "$SUPABASE_DB_PASSWORD"`
4. validates migrations with `supabase db push --linked --dry-run -p "$SUPABASE_DB_PASSWORD"`
5. on pushes, applies migrations with `supabase db push --linked -p "$SUPABASE_DB_PASSWORD"`

The workflow also uses a per-ref concurrency group and cancels superseded runs.

## GitHub Actions configuration

The current CI/CD setup depends on one repository variable and several secrets.

Required GitHub Actions variable:

- `SUPABASE_PROJECT_ID`: production Supabase project reference used for URL derivation and `supabase link`

Required GitHub Actions secrets:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: production browser key used during web builds
- `SUPABASE_DB_PASSWORD`: database password used by Supabase CLI during link and push commands
- `SUPABASE_ACCESS_TOKEN`: access token used for non-interactive Supabase CLI authentication

## Production delivery model

Production deployment is currently split between two systems:

- a Next.js hosting target for `apps/web`
- Supabase Cloud for managed backend services and database schema delivery

Expected production flow:

1. create the Supabase project
2. link the local `supabase` directory with `supabase link --project-ref <project-ref>`
3. push tracked schema migrations with `supabase db push`
4. configure runtime environment variables in the deployment platform
5. deploy the Next.js application from `apps/web`

The `imports` bucket is expected to be created by tracked SQL migrations rather than by ad hoc runtime setup.

## Operational notes

- `supabase/config.toml` is used for local development configuration and is not the mechanism used to apply production schema changes
- production schema changes are migration-driven through the tracked SQL files in `supabase/migrations`
- pull request validation checks production migration compatibility without mutating production
- the web CI workflow validates lint and build, but does not currently run a dedicated type-check step
- the current GitHub Actions triggers are configured for the `main` branch

## Current limitations

- no separate staging environment is documented in the repository
- no preview deployment workflow is defined in GitHub Actions
- no infrastructure automation for provisioning hosting or Supabase projects is tracked in the repository
- no background job infrastructure exists for import processing; imports run inline in the application request lifecycle
