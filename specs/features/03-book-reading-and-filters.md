# Book Reading And Filters

## Summary

This feature covers the book detail screen used for reading imported bookmark text.

## Current behavior

- the book detail screen is opened from the books list route
- the reader uses a dedicated mobile-width layout without the app shell's bottom navigation
- the header is sticky and includes a back action, the current book title, and a filter toggle
- bookmarks are rendered in source order using `paragraph` and `word`
- the filter toggle cycles through three modes: `All`, `Visible`, and `Text`
- `header` bookmarks are rendered as emphasized semibold heading-style items
- `hidden` bookmarks are rendered as muted gray items when the active filter is `All`
- the bookmark action sheet stays visually above the reader content with an opaque surface
- on wider desktop viewports, the bookmark action sheet stays aligned to the same centered mobile-width column as the reader content instead of anchoring to the viewport edge

## Filter semantics

- `All` shows every stored bookmark
- `Visible` excludes bookmarks with type `hidden`
- `Text` excludes bookmarks with type `hidden` and `header`

## Business rules

- source order is preserved for reading consistency
- filter changes affect only presentation, not stored data
- the default active reader filter is `Visible`
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
