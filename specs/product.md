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
2. The user signs in with email and password, or switches the auth card into sign-up mode to create an account.
3. After authentication, the user lands on the `Books` screen at `/`.
4. The user opens the dedicated `Upload` page from the books top bar and uploads a SQLite file.
5. The system imports books and bookmarks into the user's own dataset.
6. The user returns to `Books` to browse imported books.
7. The user opens a book, filters visible bookmarks, and optionally changes bookmark types.
8. The user opens the dedicated `Profile` page from the books top bar to inspect the current account and sign out.
9. The user can switch the application appearance between `Light`, `Dark`, and `System` from the `Profile` page.

## Signed-out experience

When the user is not authenticated, the app shows a single card-based authentication screen.

Supported actions:

- sign in with email and password
- switch to sign-up mode and create an account with email and password

The signed-out screen is a gate for the application. The books list, upload flow, and profile area are not available until a session exists.

If sign-up succeeds without an immediate session, the screen shows a follow-up message that the account was created and the user should check the email verification settings before signing in.

## Signed-in application shell

The signed-in experience is built around a books-first mobile shell with one primary home route and two secondary pages reached from the books header.

Product expectations for this shell:

- work comfortably on mobile-width layouts
- keep navigation shallow and simple without a persistent bottom tab bar
- keep the books top chrome visible while browsing the home screen
- use dedicated page layouts with a back action for `Upload`, `Profile`, and nested reading routes
- expose `Upload` and `Profile` from the books top bar instead of a separate shell navigation row
- react to the real visible viewport on mobile so the software keyboard does not make auth and search flows unusable
- keep top-level signed-in headers visually consistent across books, upload, profile, and reader screens

## Books experience

The `Books` area is the default signed-in destination.

Current behavior:

- fetch books that belong to the authenticated user
- allow free-text search over title and authors
- start with the books list visible and no search field on screen
- expose search through a floating circular action button at the lower-right edge of the reading column
- open a temporary search surface only when the floating search button is activated
- keep search active while the user scrolls results or moves focus away from the input
- close search only through explicit dismissal actions such as `Cancel`, `Escape`, or browser `Back`
- show each book as a compact card/list item
- navigate to a dedicated book detail route when a book is selected
- restore the last opened book position when the user returns to the books list on the same device and browser

The list is intended for rapid scanning rather than metadata-heavy browsing.

## Book reading experience

The book detail screen is optimized for reading imported bookmark text in order.

Current behavior:

- show the selected book title in a sticky top header
- allow navigation back to the books list
- render the reader as its own dedicated route outside the books shell while keeping the shared mobile header geometry
- cycle between three visibility modes:
  - `All`
  - `Visible`
  - `Text`
- render bookmark rows sorted by source location
- render `header` bookmarks as emphasized heading-style rows
- render `hidden` bookmarks as muted gray rows when the active filter is `All`
- allow a long press or right click to open bookmark actions in a modal bottom sheet

The reading screen intentionally emphasizes text consumption and low-friction scrolling over editing density.

## Bookmark type behavior

Each bookmark has one of three application-level types:

- `default`: standard visible reading item
- `header`: visible item rendered as a section-like heading
- `hidden`: excluded from reading-oriented views

The user can change a bookmark type from the context menu in the book detail screen. The new type is persisted immediately.

The context menu is implemented as a modal bottom sheet.

Supported actions:

- copy bookmark text to the clipboard
- change bookmark type to `hidden`
- change bookmark type to `header`
- change bookmark type to `default` (shown in the UI as `Text`)

The active bookmark type is visually indicated inside the sheet. The sheet can be dismissed by tapping the backdrop, pressing `Esc`, or using the browser or phone back action.

The visibility filter uses these types as its main control surface:

- `All` shows every bookmark
- `Visible` hides only `hidden`
- `Text` hides both `hidden` and `header`

## Upload experience

The `Upload` area handles SQLite import.

Current behavior:

- accept a SQLite database file from the user
- send the file to a server route with the current auth token
- upload the raw file to a request-scoped storage key before parsing
- parse source books, authors, and bookmarks on the server
- deduplicate books per user by overlapping source hash sets and bookmarks per user by source UID
- automatically merge canonical books when one incoming hash set bridges multiple existing books for the same user
- write an import summary row
- delete the uploaded file from storage after processing
- keep detailed diagnostics in server logs while showing only generic failure text plus a request reference in the UI

The upload flow is intended to be repeatable. Re-importing overlapping source files should not create duplicate books or bookmarks for the same user.

## Profile area

The `Profile` area is deliberately small.

Current behavior:

- show the current user email
- allow the user to choose `Light`, `Dark`, or `System` appearance for the current browser
- allow sign out

The page is intentionally separate from the books shell state and is reached through the books header rather than a tab switch.

The appearance preference is stored in browser local storage and defaults to the system theme when no explicit choice exists.

Signing out returns the user to the authentication screen and hides application data.

## Product rules

- all imported books and bookmarks belong to exactly one authenticated user
- imported source identifiers are used to prevent duplicates inside that user's dataset
- imported source hash aliases are used to reconcile one logical book across multiple exports and devices for the same user
- bookmark reading order follows source `paragraph` and `word`
- bookmark visibility in the reader is controlled by application bookmark types, not directly by source UI state
- theme preference is a browser-local setting and does not sync through the backend

## Out of scope in the current implementation

- collaborative or shared libraries
- bookmark editing beyond bookmark type changes
- import history UI beyond backend logging
- advanced account management
- server-synced preference management
- server-side background job orchestration for imports
- roadmap documentation for not-yet-built features
