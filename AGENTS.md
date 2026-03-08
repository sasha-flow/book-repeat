# Agent Guide

## Core behavior

- IMPORTANT: Do not guess the user's intent. Ask for clarification when the request is ambiguous or there are multiple valid implementations or solutions with meaningful tradeoffs.
- Preserve the current project structure unless the task clearly requires a new app, package, or integration.
- Use Context7 MCP to fetch up-to-date documentation for any library, framework, or API you are changing or introducing.
- Keep code simple. Avoid overengineering, speculative abstractions, and premature generalization.
- Add comments only when they explain non-obvious reasoning, constraints, or tradeoffs.
- Keep modules focused and organized according to the existing monorepo boundaries.
- When introducing environment variables, document each variable with:
  - an example value
  - what it is used for
  - where it is expected to be set

## Repository architecture

- Follow existing turborepo + pnpm monorepo structure and conventions, keep everything close to the base structure and patterns
- If new shared logic is needed, place it in the appropriate package under `packages/` and export it for internal reuse
- If a new worker or standalone runtime is needed, create it as a separate app.
- Internal imports should use workspace package names and subpath exports, for example `@repo/ui/button`.
- Workspace scripts: `package.json`
- Task orchestration and caching: `turbo.json`
- Shared ESLint presets: `packages/eslint-config/base.js`, `packages/eslint-config/next.js`, `packages/eslint-config/react-internal.js`
- Shared TypeScript configs: `packages/typescript-config/base.json`, `packages/typescript-config/nextjs.json`, `packages/typescript-config/react-library.json`
- Working with specific apps or packages should be done through their local scripts, for example `pnpm --filter web dev` or `pnpm --filter ui test`

## Codebase conventions

- Use TypeScript for all code.

### Frontend: Next.js and React

- When creating a new frontend app, ask the user whether they prefer Next.js or plain React, and follow their preference for the app's framework.
- Always use Shadcn UI and Tailwind CSS for frontend components and styling. Do not introduce new styling solutions or component libraries without explicit user approval. Keep styling simple and consistent with the existing codebase and as close to original Shadcn and tailwind patterns as possible.

## Dependencies and infrastructure

- Before introducing a new dependency or library suggest it to the user and ask for confirmation, providing a brief justification for why it is needed and how it will be used, and mention any potential alternatives that were considered.
- When adding dependencies, use the newest compatible version that fits the app or package needs.
- If a change adds a required third-party service such as Redis, Postgres, or similar, also add:
  - a local `docker-compose` setup
  - brief setup instructions
  - any required environment variable documentation
- If using Supabase, make sure you're using latest version, documentation, CLI and conventions. Always keep documentation on how to set up and run local Supabase up to date in this guide, and make sure to follow it yourself when working with Supabase-related code or changes.

## Validation expectations

- Do not leave lint warnings or type errors behind.
- For most code changes, validate with:
  - `pnpm lint`
  - `pnpm check-types`
- If you change only one package or app, you may start with its local script, but still consider repo-wide checks when shared code is affected.
