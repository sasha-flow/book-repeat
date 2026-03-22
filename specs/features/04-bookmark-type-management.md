# Bookmark Type Management

## Summary

This feature covers classification of bookmarks into application-specific types and the UI used to change them.

## Current behavior

- a long press or right click on a bookmark opens a modal bottom sheet
- the sheet exposes a copy action and three target types: `default`, `header`, and `hidden`
- the sheet labels `default` as `Text` in the UI
- the sheet uses an opaque background surface so bookmark text behind it does not bleed through
- on desktop-width viewports, the sheet stays in the same centered vertical column as the reader content
- selecting an action updates the stored bookmark record
- the active bookmark type is visually indicated inside the sheet
- the sheet closes after the update action is triggered
- the sheet can also close through backdrop tap, `Esc`, or the browser or phone back action
- the visible list updates according to the current active filter

## Type semantics

- `default`: regular reading content
- `header`: visible structural marker rendered as a heading-style row
- `hidden`: excluded from reading-focused filters

## Business rules

- bookmark type is persisted per user bookmark record
- bookmark type changes are independent from source file re-upload intent, but rely on stable imported bookmark identity
- the reader uses bookmark type as the single application-level visibility model
- changing bookmark type updates local reader state immediately so card styling and visibility match the active filter without a reload
- `header` bookmarks are rendered with emphasized heading styling
- `hidden` bookmarks remain visible only in the `All` filter and use muted styling there

## Data dependencies

- `bookmark_type` enum in Postgres
- bookmark update permissions through row-level security

## Out of scope

- bulk bookmark type editing
- custom bookmark types
- audit trail for bookmark type changes
- per-device bookmark visibility preferences
