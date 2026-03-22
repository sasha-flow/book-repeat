# Authentication And App Shell

## Summary

This feature covers user authentication and the top-level mobile-first shell that hosts the application.

## Current behavior

- unauthenticated users see a card-based authentication screen
- users can switch between sign-in and sign-up modes
- sign-up uses the same email/password card and may complete either with an immediate session or with a follow-up message to check email verification settings before signing in
- successful authentication opens the main app shell
- the signed-in shell exposes three bottom navigation tabs: `Books`, `Upload`, and `Profile`
- the bottom navigation stays visible on those three primary shell screens while the main content scrolls
- the current tab is preserved in the URL through the `tab` query parameter for non-default tabs
- the `Profile` tab includes a browser-local appearance selector with `Light`, `Dark`, and `System` options

## Main components

- `AuthScreen` handles sign-in and sign-up interactions
- `useAuthenticatedSession` initializes the current session and subscribes to auth state changes
- `AppShell` renders the mobile-width layout, pinned primary-screen chrome, and bottom navigation
- the theme layer resolves the active appearance from browser local storage and system color scheme settings

## Business rules

- the user must be authenticated to access books, uploads, or account data
- auth state changes immediately affect the rendered app shell
- the default signed-in tab is `Books`
- the shell is optimized for narrow screens and constrained to a single-column layout
- primary shell screens keep navigation visible, while nested routes use their own layout instead of reusing the shell navigation
- the auth screen remains the only signed-out surface until a session exists
- theme defaults to `System` when the browser has no stored preference
- explicit theme changes persist in browser local storage for the current device and browser

## Data dependencies

- Supabase Auth session state
- Supabase browser client configured from runtime environment variables
- browser local storage for the persisted appearance preference

## Out of scope

- password reset flows
- social login providers
- profile management beyond sign-out and appearance selection
- role-based application modes
