# Implementation Plan Summary

## Goal
Build Book Repeat as a mobile-first authenticated web app that imports SQLite books/bookmarks into Supabase, deduplicates data per user, and provides fast bookmark reading workflows.

## Architecture Decisions

### 1) App placement
- **Decision:** Implement in `apps/web` (replace starter content), keep `apps/docs` minimal.
- **Reasoning:** Existing monorepo already has `web` as product app and shared package wiring.

### 2) Reusable UI package
- **Decision:** Host shadcn-style reusable components in `packages/ui`.
- **Reasoning:** Enables reuse across future web apps, centralizes design tokens/components/utilities.

### 3) Dependency policy
- **Decision:** Use latest package versions by default (no old pinned versions for new deps).
- **Reasoning:** Matches requested policy and keeps stack current; add dependency update scripts and CI validation flow.

### 4) Backend and data ownership
- **Decision:** Use Supabase Auth + Postgres + Storage with per-user row ownership and RLS.
- **Reasoning:** Required by spec and supports strict user-level isolation.

### 5) Bookmark state model
- **Decision:** Hybrid model:
  - preserve source fields (`style_id`, `visible`, timestamps)
  - add app-specific `bookmark_type` enum (`default|header|hidden`)
- **Reasoning:** Keeps import traceability while supporting explicit UI behavior and user edits.

### 6) Deduplication policy
- **Decision:** Upsert by stable source IDs:
  - books unique on `(user_id, source_uid)` (from `BookUid.uid`)
  - bookmarks unique on `(user_id, source_uid)` (from `Bookmarks.uid`)
- **Reasoning:** Handles repeated uploads and overlapping sources as requested.

### 7) Upload/import flow
- **Decision:** API route flow:
  1. upload SQLite file to private storage bucket
  2. parse source tables
  3. upsert books and bookmarks
  4. delete uploaded file
  5. persist import run summary
- **Reasoning:** Matches required lifecycle and provides auditability via import logs.

### 8) UI/UX behavior
- **Decision:** Mobile-first single app shell with bottom nav tabs: `Books`, `Upload`, `User`.
- **Reasoning:** Direct requirement and optimized for mobile consumption.

### 9) Bookmarks reading interactions
- **Decision:**
  - list sorted by `(paragraph, word)`
  - filter toggle cycles: `all` → `without-hidden` → `reading`
  - context menu on long-press/right-click to set type: `header|hidden|default`
- **Reasoning:** Mirrors spec interaction model exactly.

## Planned Validation
- Run workspace checks: lint, typecheck, build.
- Verify auth gate, upload-import dedupe behavior, filters, and context menu persistence.
- Verify RLS and storage policies in local Supabase.

## Risks Noted During Planning
- SQLite parsing dependency/runtime compatibility.
- Exact source `style_id` semantics for header mapping are inferred and may need adjustment.
- Need local environment support for package install + validation commands.
