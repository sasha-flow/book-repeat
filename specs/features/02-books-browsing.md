# Books Browsing

## Summary

This feature covers discovery and navigation of imported books.

## Current behavior

- the app loads books that belong to the authenticated user
- books can be searched by free text across title and authors
- the default books state shows the list without a visible search field
- the books screen exposes search through a floating action button anchored above the lower-right edge of the reading column
- the floating search action is rendered as one dark circular button with a centered white search icon and a soft elevated shadow
- activating search opens a dedicated search field surface and focuses the input immediately
- when the mobile software keyboard opens during search, the temporary search field remains visible and the filtered results continue to use the actual visible viewport instead of disappearing above it
- scrolling the filtered list or moving focus away from the input does not dismiss books search
- the search surface includes an explicit `Cancel` action that closes search, clears the query, and restores the unfiltered list
- browser `Back` and `Escape` close books search through the same clear-and-dismiss path
- each result navigates to a dedicated book detail route
- the books list stores the last book opened from the list in local browser storage
- returning to the books list scrolls the last opened book toward the center of the visible list area when possible and otherwise lets browser clamping keep it near the top
- after scroll restoration, the last opened book briefly flashes with a high-contrast highlight so the user can quickly identify it
- the books area is the default signed-in destination

## Presentation rules

- the list is optimized for quick scanning on mobile
- the list scrolls beneath pinned shell chrome without visually bleeding through the books top bar or temporary search surface
- the floating search action should read as a single elevated control, not as a bordered or double-ring element
- while the search field is actively using the mobile software keyboard, temporary search chrome may move to the top so the list and short result sets stay visible
- the restored book should be centered within the visible list area as much as the available scroll range allows
- the highlight is intentionally short and should not remain sticky after the initial hint animation completes
- title is the primary visual field
- authors are supporting metadata when available
- navigation to the selected book is a primary action on each item

## Business rules

- only user-owned books are visible
- books are imported records, not manually authored in the app
- search is intended as a lightweight client-side convenience, not an advanced catalog feature
- the temporary search query is session-local UI state and is discarded whenever the search field closes
- last opened book state is local-only browser state and is updated only when the user opens a book from the books list UI

## Data dependencies

- `books` table in Supabase
- user session for user-scoped access via row-level security

## Out of scope

- manual book creation
- sorting controls beyond the current implementation
- pagination and large-library browsing tools
- book metadata editing
