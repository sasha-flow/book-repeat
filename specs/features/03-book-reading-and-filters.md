# Book Reading And Filters

## Summary

This feature covers the book detail screen used for reading imported bookmark text.

## Current behavior

- the book detail screen is opened from the books list route
- the header includes a back action, the current book title, and a filter toggle
- bookmarks are rendered in source order using `paragraph` and `word`
- the filter toggle cycles through three modes: `All`, `No hidden`, and `Reading`
- `header` bookmarks are rendered differently from regular reading items

## Filter semantics

- `All` shows every stored bookmark
- `No hidden` excludes bookmarks with type `hidden`
- `Reading` excludes bookmarks with type `hidden` and `header`

## Business rules

- source order is preserved for reading consistency
- filter changes affect only presentation, not stored data
- the screen prioritizes legibility and continuous scrolling over dense controls

## Data dependencies

- `bookmarks` table scoped to the selected book id
- `bookmark_type`, `paragraph`, and `word` fields

## Out of scope

- inline bookmark text editing
- bookmark search within a book
- annotation grouping or tagging
- offline caching behavior beyond normal browser state
