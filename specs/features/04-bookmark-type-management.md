# Bookmark Type Management

## Summary

This feature covers classification of bookmarks into application-specific types and the UI used to change them.

## Current behavior

- a long press or right click on a bookmark opens a context menu
- the menu exposes three target types: `default`, `header`, and `hidden`
- selecting an action updates the stored bookmark record
- the context menu closes after the update action is triggered
- the visible list updates according to the current active filter

## Type semantics

- `default`: regular reading content
- `header`: visible structural marker rendered as a heading-style row
- `hidden`: excluded from reading-focused filters

## Business rules

- bookmark type is persisted per user bookmark record
- bookmark type changes are independent from source file re-upload intent, but rely on stable imported bookmark identity
- the reader uses bookmark type as the single application-level visibility model

## Data dependencies

- `bookmark_type` enum in Postgres
- bookmark update permissions through row-level security

## Out of scope

- bulk bookmark type editing
- custom bookmark types
- audit trail for bookmark type changes
- per-device bookmark visibility preferences
