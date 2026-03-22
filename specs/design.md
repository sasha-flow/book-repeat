# Design

## Overview

This document captures the current UI, UX, layout, and presentation conventions that apply across Book Repeat.

It is the cross-cutting design reference for implemented behavior only. It should describe conventions that apply across the product, not feature-specific interaction details. Feature-specific business rules still belong in the relevant feature files, and schema details still belong in `specs/db.md`.

## Design goals

- prioritize focused reading on mobile-width screens
- keep the main app navigation shallow and predictable
- preserve visual continuity between primary navigation, content surfaces, and overlays
- prefer clear typography, restrained color, and stable layout over dense control-heavy presentation
- keep chrome stable while content scrolls beneath it

## Layout principles

- the product is mobile-first and optimized around a single centered column
- primary application layouts are constrained to a narrow centered column on larger viewports instead of stretching into desktop dashboard layouts
- top-level shell screens use persistent chrome so the user can move between the app's primary tasks without losing orientation
- nested routes use dedicated page layouts with a back action instead of reusing bottom navigation
- layout decisions should favor reading comfort, clear touch targets, and predictable vertical flow over high information density
- layouts with editable text inputs should react to the real visible viewport on mobile instead of assuming the pre-keyboard page height remains usable

## Surface conventions

- important structural surfaces such as headers, navigation, cards, sheets, and bars should use opaque backgrounds
- scrolling content should not visually bleed through fixed chrome or modal surfaces
- borders and elevation are subtle and should separate surfaces without creating a heavy dashboard aesthetic
- rounded corners come from the shared radius token and should stay visually consistent across reusable surfaces

## Theme and color system

- the project uses a neutral shadcn-style token theme defined in shared CSS custom properties under `packages/ui/src/styles.css`
- the color system is based on semantic tokens such as `background`, `foreground`, `card`, `muted`, `accent`, `border`, `input`, `ring`, and `destructive`
- token values are defined in OKLCH for both light and dark appearances
- the light theme uses a bright neutral canvas with dark text and low-contrast gray supporting surfaces
- the dark theme inverts that relationship with dark neutral surfaces, bright text, and softened borders
- the design system is intentionally restrained and grayscale-first rather than brand-color-led
- color usage should remain semantic through tokens instead of hard-coded per-screen color choices

## Theme behavior

- the supported appearance preferences are `Light`, `Dark`, and `System`
- `System` is the fallback and default preference when no stored value exists
- theme preference is stored in browser local storage under the application theme storage key
- the active theme is resolved client-side from either the stored preference or the system color-scheme media query
- the root document is updated with `data-theme-preference`, `data-resolved-theme`, the `dark` class, and `color-scheme` so the entire UI stays in sync
- an initialization script runs before interactive hydration to avoid visible theme flicker on first paint

## Typography

- typography should stay simple, readable, and utility-first rather than decorative
- the app root loads local Geist sans and mono font assets for the application runtime
- shared base styles currently fall back to a generic sans-serif body stack in the UI package, so feature work should avoid introducing one-off font stacks without a deliberate design-system decision
- type scale and weight changes should communicate hierarchy sparingly and should not rely on color alone for emphasis

## Navigation and interaction patterns

- top-level navigation belongs in the bottom tab bar only
- secondary flows should prefer a single explicit back action instead of duplicating shell navigation
- interaction design should favor a small number of obvious actions over dense persistent toolbars
- contextual actions should appear in dedicated surfaces instead of expanding the baseline layout with always-visible controls
- dismissal behavior for temporary UI should stay predictable across touch, pointer, keyboard, and browser navigation where supported
- when the software keyboard opens on mobile, active text entry and nearby content take priority over persistent bottom chrome until the keyboard closes

## Component system

- shared UI primitives from `packages/ui` provide the baseline component language for cards, buttons, inputs, labels, and related controls
- component styling should be driven by shared semantic tokens and shared radius values before introducing local overrides
- cross-cutting layout helpers are part of the effective design system and should remain visually consistent when screens evolve
- feature implementations should reuse shared primitives and existing layout helpers before introducing screen-specific one-off patterns

## Base styling rules

- the document should prevent horizontal overflow at the page level
- body surfaces should always inherit the semantic background and foreground tokens
- box sizing is normalized globally so spacing and surface measurements remain predictable across features
- links inherit surrounding text color by default and should signal interactivity through context, layout, and component styling rather than browser-default coloration alone

## Documentation boundaries

- use `specs/product.md` for product scope and user journey descriptions
- use `specs/architecture.md` for runtime boundaries, layout architecture decisions, and client versus server responsibilities
- use `specs/db.md` for persistence rules, schema details, and row-level security
- use the feature files in `specs/features/` for screen-specific behavior and business rules
