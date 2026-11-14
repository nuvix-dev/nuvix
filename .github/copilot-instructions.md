# Nuvix Copilot Workspace Instructions

## Purpose

This file primes Copilot/agent behavior for the **nuvix** repository — the Bun-native v2 backend. Follow the project conventions, keep responses concise, and use documentation links rather than copying large chunks.

## Key project facts

- **The repo root is the workspace** (`apps/`, `packages/`, `docs/`, `assets/`) — the legacy v1 monorepo was deleted and the old `next/` nesting flattened in the Phase 9 cutover.
- Workspace: Bun workspaces — `apps/*` (server, platform, workers) and `packages/*`.
- Runtime: Bun 1.4 (pinned in `package.json` `packageManager`); TypeScript; Elysia 2 + TypeBox contracts; testing with `bun test`; linting/formatting with Biome.
- Tenant databases: PostgreSQL 18 only (`nuvix/postgres:18.1`). Platform persistence: PostgreSQL or SQLite via `@nuvix/db`.

## Build/test commands (run from the repo root)

1. `bun install --frozen-lockfile`
2. `bun run lint`
3. `bun run typecheck`
4. `bun test`
5. `git diff --check`

`@nuvix/*` platform libraries come from npm as published packages; no sibling checkouts are needed.

## Architecture invariants (see `AGENTS.md` and `MIGRATION.md`)

- Contract-first vertical slices; RFC 9457 problem details with stable snake_case `code`s.
- Request order: publishable key → platform project → PostgreSQL tenant → tenant-local auth → canonical roles → caller-scoped `Session` → handler.
- Routes validate transport input and call a service; services own business rules and receive narrow dependencies; infrastructure construction belongs in composition.

## Coding style

- Prefer existing helpers; avoid duplicating business logic.
- TypeBox (`t.*`) for transport validation.
- Keep new exports in library entrypoints where needed.

## How to use this agent instruction

- Always ask: "What is the specific task, and what user story or issue is being solved?"
- For feature work, identify relevant existing modules and nearby tests first.
- For bug fixes, reproduce steps using unit/integration tests, then code changes.
- Provide a short summary and test commands in your final response.

## Workspace doc links (don't duplicate)

- README: `README.md`
- Contributing: `CONTRIBUTING.md`
- v2 API contracts: `docs/api/`
- Architecture & decisions: `MIGRATION.md` (migration record + DoD)
- Deployment: `docs/deployment.md`

## "Link, don't embed" principle

For high-detail behavior (auth rules, storage policies, messaging flows), prefer linking to docs/data sources above and adding concise notes. Avoid pasting full APIs or long docs into generated code comments.
