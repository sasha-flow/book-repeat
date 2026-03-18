# Product

## Summary

Book Repeat is a mobile-first reading utility for users who export highlight and bookmark data from a source SQLite database and want to review that data in a focused web interface.

The current product scope is intentionally narrow:

- authenticate the user
- import bookmark data from a SQLite database file
- keep imported records isolated per user
- let the user browse books and read imported bookmarks
- let the user control bookmark visibility by assigning bookmark types

This document describes the current implemented behavior only.

## Primary user journey

1. The user opens the application and sees the authentication screen if there is no active session.
2. The user signs in with email and password (no ability to create an account now).
3. After authentication, the user lands in the mobile-first app shell.
4. The user uploads a SQLite file from the `Upload` tab.
5. The system imports books and bookmarks into the user's own dataset.
6. The user opens the `Books` tab to browse imported books.
7. The user opens a book, filters visible bookmarks, and optionally changes bookmark types.
8. The user opens the `User` tab to inspect the current account and sign out.

## Signed-out experience

When the user is not authenticated, the app shows a single card-based authentication screen.

Supported actions:

- sign in with email and password

The signed-out screen is a gate for the application. The books list, upload flow, and user area are not available until a session exists.

## Signed-in application shell

The signed-in experience is built around a mobile-first shell with three bottom navigation destinations:

- `Books`
- `Upload`
- `User`

Product expectations for this shell:

- work comfortably on mobile-width layouts
- keep navigation persistent and simple
- expose the app's three main tasks without secondary navigation depth

## Books experience

The `Books` area is the default signed-in destination.

Current behavior:

- fetch books that belong to the authenticated user
- allow free-text search over title and authors
- show each book as a compact card/list item
- navigate to a dedicated book detail route when a book is selected

The list is intended for rapid scanning rather than metadata-heavy browsing.

## Book reading experience

The book detail screen is optimized for reading imported bookmark text in order.

Current behavior:

- show the selected book title in the header
- allow navigation back to the books list
- cycle between three visibility modes:
  - `All`
  - `No hidden`
  - `Reading`
- render bookmark rows sorted by source location
- render `header` bookmarks differently from regular bookmarks
- allow a long press or right click to open bookmark actions

The reading screen intentionally emphasizes text consumption and low-friction scrolling over editing density.

## Bookmark type behavior

Each bookmark has one of three application-level types:

- `default`: standard visible reading item
- `header`: visible item rendered as a section-like heading
- `hidden`: excluded from reading-oriented views

The user can change a bookmark type from the context menu in the book detail screen. The new type is persisted immediately.

The visibility filter uses these types as its main control surface:

- `All` shows every bookmark
- `No hidden` hides only `hidden`
- `Reading` hides both `hidden` and `header`

## Upload experience

The `Upload` area handles SQLite import.

Current behavior:

- accept a SQLite database file from the user
- send the file to a server route with the current auth token
- parse source books, authors, and bookmarks on the server
- deduplicate books and bookmarks per user by source UID
- write an import summary row
- delete the uploaded file from storage after processing

The upload flow is intended to be repeatable. Re-importing overlapping source files should not create duplicate books or bookmarks for the same user.

## User area

The `User` area is deliberately small.

Current behavior:

- show the current user email
- allow sign out

Signing out returns the user to the authentication screen and hides application data.

## Product rules

- all imported books and bookmarks belong to exactly one authenticated user
- imported source identifiers are used to prevent duplicates inside that user's dataset
- bookmark reading order follows source `paragraph` and `word`
- bookmark visibility in the reader is controlled by application bookmark types, not directly by source UI state

## Out of scope in the current implementation

- collaborative or shared libraries
- bookmark editing beyond bookmark type changes
- import history UI beyond backend logging
- advanced account management
- server-side background job orchestration for imports
- roadmap documentation for not-yet-built features
