# Authentication And App Shell

## Summary

This feature covers user authentication and the top-level mobile-first shell that hosts the application.

## Current behavior

- unauthenticated users see a card-based authentication screen
- users can switch between sign-in and sign-up modes
- sign-up uses the same email/password card and may complete either with an immediate session or with a follow-up message to check email verification settings before signing in
- successful authentication opens the main app shell
- the signed-in default route is the `Books` screen at `/`
- the books screen uses a pinned top bar with secondary actions for `Upload` and `Profile`
- `Upload` and `Profile` are dedicated signed-in routes with their own top bars and explicit back actions to `/`
- the books, upload, and profile pages reuse the same shared mobile header geometry that is also used by the reader route
- when the mobile software keyboard opens, the shell switches to the real visible viewport height and may temporarily move temporary bottom search chrome to the top so focused text fields remain usable
- the `Profile` page includes a browser-local appearance selector with `Light`, `Dark`, and `System` options

## Main components

- `AuthScreen` handles sign-in and sign-up interactions
- `useAuthenticatedSession` initializes the current session and subscribes to auth state changes
- `AppShell` renders the mobile-width layout plus optional pinned top chrome, optional temporary bottom chrome, and overlays such as the books search action button
- `MobilePageHeader` and `MobilePageHeaderButton` provide the shared top-bar geometry used by books, upload, profile, and reader pages
- the theme layer resolves the active appearance from browser local storage and system color scheme settings

## Business rules

- the user must be authenticated to access books, uploads, or account data
- auth state changes immediately affect the rendered app shell
- the default signed-in destination is `Books`
- the shell is optimized for narrow screens and constrained to a single-column layout
- the books screen keeps its top chrome visible, while secondary signed-in pages and nested routes use their own layout instead of shared bottom navigation
- keyboard-aware shell behavior should be shared across text-entry surfaces instead of handling each input with one-off viewport hacks
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
