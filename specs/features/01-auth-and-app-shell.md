# Authentication And App Shell

## Summary

This feature covers user authentication and the top-level mobile-first shell that hosts the application.

## Current behavior

- unauthenticated users see a card-based authentication screen
- users can switch between sign-in and sign-up modes
- successful authentication opens the main app shell
- the signed-in shell exposes three bottom navigation tabs: `Books`, `Upload`, and `User`
- the current tab is preserved in the URL through the `tab` query parameter for non-default tabs

## Main components

- `AuthScreen` handles sign-in and sign-up interactions
- `useAuthenticatedSession` initializes the current session and subscribes to auth state changes
- `AppShell` renders the mobile-width layout, optional sticky header, and bottom navigation

## Business rules

- the user must be authenticated to access books, uploads, or account data
- auth state changes immediately affect the rendered app shell
- the default signed-in tab is `Books`
- the shell is optimized for narrow screens and constrained to a single-column layout

## Data dependencies

- Supabase Auth session state
- Supabase browser client configured from runtime environment variables

## Out of scope

- password reset flows
- social login providers
- profile editing beyond sign-out
- role-based application modes
