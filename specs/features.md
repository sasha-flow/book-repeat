# Features

This index tracks the currently documented, implemented features of Book Repeat.

Related cross-cutting documentation:

- `specs/product.md` for product scope and current user journeys
- `specs/architecture.md` for system boundaries and architectural decisions
- `specs/db.md` for schema, constraints, row-level security, and database-side rules
- `specs/infra.md` for local development, CI, deployment, and operational flow
- `specs/design.md` for shared UI, UX, layout, and presentation conventions

## Implemented features

1. [01-auth-and-app-shell.md](features/01-auth-and-app-shell.md) - signed-out authentication, signed-in three-tab shell, URL-backed tab state, and browser-local theme preference
2. [02-books-browsing.md](features/02-books-browsing.md) - searchable books list with pinned search inside the primary shell
3. [03-book-reading-and-filters.md](features/03-book-reading-and-filters.md) - dedicated reader route, source-ordered bookmark reading, and visibility filters
4. [04-bookmark-type-management.md](features/04-bookmark-type-management.md) - bookmark context actions, long-press rules, and persisted bookmark-type changes
5. [05-sqlite-import-pipeline.md](features/05-sqlite-import-pipeline.md) - authenticated SQLite upload, canonical-book reconciliation, diagnostics, and cleanup
6. [06-data-model-and-storage.md](features/06-data-model-and-storage.md) - persistence responsibilities, canonical identity rules, RLS-backed ownership, and import storage expectations

## Documentation rules

- each feature document describes current behavior only
- each feature document should stay aligned with implemented code paths
- architectural cross-cutting concerns belong in `specs/architecture.md`
- database schema, constraints, relations, and database-side business rules belong in `specs/db.md`
- design and UX conventions that apply across multiple screens belong in `specs/design.md`
- high-level product intent belongs in `specs/product.md`
