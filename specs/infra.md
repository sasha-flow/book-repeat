# Infrastructure

## Overview

Book Repeat is delivered as a pnpm monorepo with a single Next.js application, shared workspace packages, and local Supabase tooling for development.

The current infrastructure model is intentionally small:

- one deployable web application in `apps/web`
- shared workspace packages for UI, linting, and TypeScript configuration
- Supabase as the external platform for authentication, database, and storage

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
- `pnpm format` rewrites tracked TypeScript, TSX, and Markdown files with Prettier
- `pnpm run deps:check` reports outdated workspace dependencies
- `pnpm run deps:update` upgrades workspace dependencies to the latest versions allowed by the current package manifests

For web-only work, the repository also supports filtered commands such as `pnpm --filter web dev`, `pnpm --filter web test`, `pnpm --filter web lint`, `pnpm --filter web check-types`, and `pnpm --filter web build`.

## Pull request validation

The repository includes a dedicated pull request validation workflow at `.github/workflows/pull-request-validation.yml`.

The workflow runs on every `pull_request` event and performs the standard workspace verification flow:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm check-types`
- `pnpm build`
- `supabase db push --dry-run` when Supabase CI credentials are available
- `pnpm -r --if-present test`

Implementation notes:

- dependency installation is performed once at the workspace root with `pnpm`
- linting, type checking, and build run through the root scripts, which delegate to Turborepo
- test execution is future-proofed by using `pnpm -r --if-present test`, so packages are tested automatically as soon as package-level `test` scripts are added
- the workflow provides placeholder Supabase environment variables so build validation can run in CI without production credentials
- the workflow also performs a Supabase migration dry-run against the configured remote project when `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_ID` are available in GitHub Actions
- the Supabase dry-run step is skipped when those credentials are not available, which keeps pull requests from forks from failing only because repository secrets are unavailable
- this workflow is intentionally separate from `.github/workflows/production-supabase-migrate.yml`

## Application runtime

The product runtime is centered on the `apps/web` Next.js application.

Current runtime characteristics:

- Next.js 16 App Router application
- React 19 client runtime
- TypeScript codebase pinned to `5.9.2` at the root and in app packages so local, CI, and `next typegen` output stay reproducible
- Tailwind-based styling
- browser and server integration with Supabase
- Vercel-targeted production hosting for `apps/web`

The deployed application requires Supabase-backed authentication and database access. The import flow also requires privileged server access through the Supabase service role key.

## Testing and verification

The current automated checks are intentionally small and run directly from repository scripts.

- the web app uses the Node.js built-in test runner through `pnpm --filter web test`
- linting runs through ESLint with `pnpm --filter web lint` or `pnpm lint`
- type validation runs through `next typegen` plus `tsc --noEmit` inside `pnpm --filter web check-types`
- production build validation runs through `pnpm --filter web build` or `pnpm build`
- pull request validation reuses the root scripts so CI and local workflows stay aligned

## Local development environment

Local development depends on the following tools:

- Node.js `>= 24`
- `pnpm`
- Supabase CLI
- Docker for local Supabase services

The expected local setup flow is:

1. Install workspace dependencies with `pnpm install`.
2. Start local Supabase services with `supabase start`.
3. Reset the local database and apply tracked migrations with `supabase db reset`.
4. Inspect local Supabase credentials with `supabase status`.
5. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the required environment variables.
6. Start the app with `pnpm dev` or `pnpm --filter web dev`.

## Local Supabase services

Supabase is the local infrastructure dependency for development and testing.

The repository uses local Supabase services for:

- Auth
- Postgres
- Storage
- migration application during local resets

The checked-in `supabase/config.toml` currently pins local Postgres to major version `17`. That version should match the remote Supabase project when validating migrations locally or in CI.

The checked-in local auth configuration is expected to keep email/password sign-in available for existing accounts while leaving self-service signup out of the product flow.

Changes to `supabase/config.toml` do not apply to an already running local stack until the developer restarts Supabase with `supabase stop` followed by `supabase start`.

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

The canonical local template for these values is `apps/web/.env.example`.

Operational expectations:

- `NEXT_PUBLIC_` variables are build-time values for Next.js
- production values must point to the same deployed Supabase project
- the service role key must be available only in trusted server environments

## Production delivery model

Production deployment is currently described at a high level, with schema rollout now automated through GitHub Actions.

- a Next.js hosting target for `apps/web`
- Supabase Cloud for managed backend services and database schema delivery
- Vercel Git integration for automatic production deployment of `apps/web` from `main`

Expected production flow:

1. create the Supabase project
2. connect the repository to the hosting platform for application delivery
3. connect `apps/web` to Vercel so Vercel automatically deploys the production environment from `main`
4. connect the Supabase project to the Vercel project so production Vercel environment variables are populated automatically by the Supabase-to-Vercel integration
5. configure GitHub Actions credentials for production Supabase access
6. merge or push tracked schema migrations to `main`, or run the production migration workflow manually
7. let the GitHub Actions production migration workflow link the repository to the production Supabase project and apply `supabase db push`
8. let Vercel build and deploy the Next.js application from `apps/web` to the production environment

The `imports` bucket is expected to be created by tracked SQL migrations rather than by ad hoc runtime setup.

The production migration workflow is implemented in `.github/workflows/production-supabase-migrate.yml` and is triggered on every push to `main` as well as by manual workflow dispatch.
The production application deployment is handled separately by Vercel, which automatically deploys `apps/web` to the Vercel production environment from the `main` branch.

## Operational notes

- `supabase/config.toml` is used for local development configuration and is not the mechanism used to apply production schema changes
- production schema changes are migration-driven through the tracked SQL files in `supabase/migrations`
- pull request validation is executed in CI with the GitHub Actions workflow `.github/workflows/pull-request-validation.yml`
- pull request validation includes a conditional Supabase migration dry-run so schema changes in `supabase/migrations` are checked before merge when GitHub Actions credentials are available
- production schema changes are applied in CI with the GitHub Actions workflow `.github/workflows/production-supabase-migrate.yml`
- application deployment to production is handled by Vercel Git integration on pushes to `main`
- production Vercel environment variables are populated automatically by the Supabase-to-Vercel integration
- failing pull request workflow runs do not block merging by themselves; the repository branch protection rules must require the workflow status check for it to be merge-blocking
- the production migration workflow requires these GitHub Actions values:
  - `SUPABASE_ACCESS_TOKEN`: GitHub secret, personal access token used by Supabase CLI in non-interactive CI runs
  - `SUPABASE_PROJECT_ID`: GitHub variable, production Supabase project reference
  - `SUPABASE_DB_PASSWORD`: GitHub secret, production database password required for remote migration operations
- the migration workflow is intentionally scoped to database schema rollout and does not perform application deployment to Vercel

## Current limitations

- no separate staging environment is documented in the repository
- no staging or preview database migration pipeline is currently tracked in the repository
- no infrastructure automation for provisioning hosting or Supabase projects is tracked in the repository
- no background job infrastructure exists for import processing; imports run inline in the application request lifecycle
