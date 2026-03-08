# Implementation Fact Summary

## What Was Implemented

### Monorepo and package structure

- Implemented product features in `apps/web`.
- Added reusable shadcn-style shared components in `packages/ui/src/components`.
- Added shared UI utility `packages/ui/src/lib/utils.ts` and theme/style tokens in `packages/ui/src/styles.css`.
- Added `packages/ui/components.json` for reusable shadcn package conventions.
- Updated `packages/ui/package.json` exports for reusable component entrypoints.

### App wiring and styling

- Updated `apps/web` and `apps/docs` layouts to import shared UI stylesheet.
- Added `transpilePackages: ["@repo/ui"]` to both Next configs.
- Added `postcss.config.mjs` in both apps for Tailwind v4 postcss plugin.
- Simplified app global CSS in both apps to remove duplicated theme tokens.

### Book Repeat web app (actual app behavior)

- Replaced starter web page with `AppClient` app shell (`apps/web/app/app-client.tsx`).
- Implemented auth gate with Supabase session check and sign-in/sign-up form.
- Implemented bottom navigation tabs: `Books`, `Upload`, `User`.
- Implemented books list view (title-only) and book detail view with back button.
- Implemented bookmark filter toggle with 3 states.
- Implemented bookmark rendering behavior for `header` vs normal text.
- Implemented long-press/right-click context menu for bookmark type updates.
- Implemented user tab with identity display and logout action.

### Import and domain logic

- Added domain/filter helpers:
  - `apps/web/lib/domain.ts`
  - `apps/web/lib/bookmark-filters.ts`
- Added Supabase clients:
  - browser client `apps/web/lib/supabase/client.ts`
  - service client `apps/web/lib/supabase/service.ts`
- Added SQLite parser/import mapper in `apps/web/lib/sqlite-import.ts`.
- Added API route `apps/web/app/api/import-sqlite/route.ts`:
  - validates auth token
  - uploads file to Supabase Storage
  - parses and maps SQLite data
  - upserts books/bookmarks
  - deletes uploaded file
  - writes import run summary

### Supabase local project and schema

- Added local Supabase config `supabase/config.toml`.
- Added migration `supabase/migrations/20260303120000_initial_schema.sql` with:
  - `books`, `bookmarks`, `import_runs`
  - `bookmark_type` enum
  - unique constraints for upsert dedupe
  - indexes for sorting/read performance
  - update timestamp triggers
  - RLS policies for user-scoped access
  - storage bucket and storage object policies (`imports`)

### Documentation updates

- Replaced root `README.md` with project-focused setup and deploy instructions.
- Updated `apps/web/README.md` with app-specific setup/import behavior.
- Added `apps/web/.env.example` for required environment variables.
- Added dependency policy scripts in root `package.json`:
  - `deps:check`
  - `deps:update`

## Important Caveats / Current Status

1. **Dependency installation was not executed successfully in this environment**
   - Terminal commands fail due sandbox missing tools (`rg`, `bwrap`, `socat`).
   - Package manifests were updated, but `pnpm install` still needs to be run in a valid local environment.

2. **Automated validation was not completed here**
   - `pnpm lint`, `pnpm check-types`, `pnpm build` could not be run for the same environment limitation.

3. **One docs-page syntax issue was fixed after diff review**
   - Removed an extra closing `</div>` from `apps/docs/app/page.tsx`.

## Follow-up Needed (outside this sandbox)

- Run `pnpm install`.
- Run `pnpm lint && pnpm check-types && pnpm build`.
- Start Supabase locally and apply migration (`supabase start`, `supabase db reset`).
- Populate `apps/web/.env.local` and verify end-to-end upload/auth/bookmark flows.
