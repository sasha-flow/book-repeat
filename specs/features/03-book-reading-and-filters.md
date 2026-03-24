# Book Reading And Filters

## Summary

This feature covers the book detail screen used for reading imported bookmark text.

## Current behavior

- the book detail screen is opened from the books list route
- the reader uses a dedicated mobile-width layout without the app shell's bottom navigation
- the header is sticky and includes a back action, the current book title, and a filter toggle
- bookmarks are rendered in source order using `paragraph` and `word`
- the filter toggle cycles through three modes: `All`, `Visible`, and `Text`
- the browser stores a per-book local resume state containing the last active filter and the last bookmark anchor seen at the top of the visible reader area
- reopening a book from the books list or directly by URL restores the saved filter first and then scrolls the list to the saved bookmark anchor on the same device and browser
- if the exact saved bookmark is no longer visible under the restored filter, the reader resumes from the nearest following visible bookmark in source order and otherwise falls back to the first visible bookmark
- `header` bookmarks are rendered as emphasized semibold heading-style items
- `hidden` bookmarks are rendered as muted gray items when the active filter is `All`
- the bookmark action sheet stays visually above the reader content with an opaque surface
- on wider desktop viewports, the bookmark action sheet stays aligned to the same centered mobile-width column as the reader content instead of anchoring to the viewport edge
- the sheet can be dismissed with backdrop tap, `Esc`, or the browser or phone back action

## Filter semantics

- `All` shows every stored bookmark
- `Visible` excludes bookmarks with type `hidden`
- `Text` excludes bookmarks with type `hidden` and `header`

## Business rules

- source order is preserved for reading consistency
- filter changes affect only presentation, not stored data
- the default active reader filter is `Visible`
- the saved resume state is local-only browser state and is not synchronized through Supabase
- the current bookmark anchor is defined as the bookmark whose own top edge is the highest visible bookmark start below the fixed header, not a bookmark whose top edge has already moved under the header
- the screen prioritizes legibility and continuous scrolling over dense controls
- touch scrolling through bookmark rows must not trigger the bookmark action sheet unless the user keeps one finger stationary long enough to complete a long press

## Data dependencies

- `bookmarks` table scoped to the selected book id
- `bookmark_type`, `paragraph`, and `word` fields

## Out of scope

- inline bookmark text editing
- bookmark search within a book
- annotation grouping or tagging
- offline caching behavior beyond normal browser state
