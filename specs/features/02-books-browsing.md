# Books Browsing

## Summary

This feature covers discovery and navigation of imported books.

## Current behavior

- the app loads books that belong to the authenticated user
- books can be searched by free text across title and authors
- the search field remains visible while the user scrolls the books list
- each result navigates to a dedicated book detail route
- the books area is the default signed-in destination

## Presentation rules

- the list is optimized for quick scanning on mobile
- the list scrolls beneath pinned shell chrome without visually bleeding through the books search bar or bottom navigation
- title is the primary visual field
- authors are supporting metadata when available
- navigation to the selected book is a primary action on each item

## Business rules

- only user-owned books are visible
- books are imported records, not manually authored in the app
- search is intended as a lightweight client-side convenience, not an advanced catalog feature

## Data dependencies

- `books` table in Supabase
- user session for user-scoped access via row-level security

## Out of scope

- manual book creation
- sorting controls beyond the current implementation
- pagination and large-library browsing tools
- book metadata editing
