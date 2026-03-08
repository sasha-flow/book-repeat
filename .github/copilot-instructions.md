# Copilot instructions for `book-repeat`

## Big picture (read this first)

- This is a Turborepo monorepo: product app in `apps/web`, shared UI in `packages/ui`, Supabase schema/config in `supabase`.
- Core flow: user authenticates with Supabase Auth, uploads a SQLite file, server parses it, upserts user-scoped `books`/`bookmarks`, deletes uploaded file, logs `import_runs`.
- Keep architecture mobile-first and single-shell in `apps/web/app/app-client.tsx` (tabs: `books`, `upload`, `user`).

## Key code paths

- UI shell + client state: `apps/web/app/app-client.tsx`.
- Import endpoint: `apps/web/app/api/import-sqlite/route.ts`.
- SQLite parsing/mapping: `apps/web/lib/sqlite-import.ts`.
- Bookmark domain/filter rules: `apps/web/lib/domain.ts`, `apps/web/lib/bookmark-filters.ts`.
- Supabase clients: `apps/web/lib/supabase/client.ts` (browser), `apps/web/lib/supabase/service.ts` (service role, server-only).
- Database, RLS, storage policies: `supabase/migrations/20260303120000_initial_schema.sql`.

## Data model and import conventions

- Deduplicate by stable source IDs per user: `books(user_id, source_uid)` from `BookUid.uid`, `bookmarks(user_id, source_uid)` from `Bookmarks.uid`.
- Maintain sort semantics for reading order: bookmarks are ordered by `(paragraph, word)`.
- `normalizeBookmarkType(source_visible, source_style_id)`: `hidden` if `visible===0`, `header` if `style_id===2`, else `default`.
- In import route, always resolve uploaded `book_source_uid -> books.id` before upserting bookmarks.

## Supabase and security boundaries

- Browser code must use anon client (`getSupabaseBrowserClient`), never service role.
- API routes use `getSupabaseServiceClient`, then validate caller via `auth.getUser(accessToken)` from `Authorization: Bearer <token>`.
- RLS is enabled for `books`, `bookmarks`, `import_runs`; keep queries user-scoped and compatible with policies.
- Storage bucket is private `imports`; uploaded files are namespaced as `${userId}/...` and should be deleted after parse/import.

## UI/component conventions

- Use shared primitives from `@repo/ui/components/*` (Button/Card/Input/Badge/etc.) before adding app-local variants.
- Styling relies on Tailwind utility classes and shared tokens from `@repo/ui/styles.css`; avoid ad-hoc styling systems.
- Preserve existing UX behavior: tabs (`Books`, `Upload`, `User`), filter cycle (`all` -> `without-hidden` -> `reading`), long-press/right-click type menu.

## Developer workflow

- Install: `pnpm install`
- Run all apps: `pnpm dev`
- Run web only: `pnpm --filter web dev`
- Validate web changes: `pnpm --filter web lint && pnpm --filter web check-types && pnpm --filter web build`
- Workspace checks: `pnpm lint`, `pnpm check-types`, `pnpm build`
- Local Supabase: `supabase start` then `supabase db reset`

## Environment expectations

- `apps/web/.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_IMPORT_BUCKET` (default `imports`).
- Follow setup details in `README.md` and `apps/web/README.md`.
