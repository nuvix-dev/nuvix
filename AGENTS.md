# Nuvix v2 Guide

## Mission

Own the Bun-native v2 backend. Own implementation, tests, and
documentation together. Make routine implementation decisions
autonomously: do not pause for naming, file layout, refactoring, test fixes,
error mapping, or selection of the next documented slice.

After a logical slice passes validation, commit it, push `v2-rewrite`, update
the migration records, and continue to the next unblocked slice. Ask the user
only for a genuinely new product decision, a change to a locked architecture
decision, unavailable credentials/infrastructure, or destructive operations
beyond the completed Phase 9 cutover.

## Repository boundaries

- The repo root IS the workspace: `apps/`, `packages/`, `docs/`, `assets/`,
  `test/` live at the root (the `next/` nesting was flattened away after the
  Phase 9 cutover).
- The legacy v1 monorepo root was deleted in the Phase 9 cutover; consult
  git history for legacy behavior only when a contract references it.
- Preserve unrelated worktree changes. Never reset, clean, or broadly stage.
- `.tmp/**` and `thoughts/**` are scratch/history, not authoritative project
  status and not commit targets.
- `@nuvix/*` platform libraries (db, cache, pg, storage, messaging) are
  consumed as **published npm packages**, not local `file:` links. A defect
  belonging in one of their upstream repos (`nuvix-dev/{database,cache,
  pg-ts,storage,messaging}`) is fixed there: validate, commit, push, publish
  a new version (CI publishes on GitHub Release; `npm publish` needs the
  maintainer's browser-auth token), then bump the dependency here.

## Read before implementing a slice

1. `MIGRATION.md`
2. `docs/api/_conventions.md`
3. Relevant ADRs in `docs/architecture/decisions/` (when present)
4. The relevant contract in `docs/api/`
5. Adjacent v2 source and tests
6. Git history of the deleted legacy root, only when a contract references
   legacy behavior

Current user instructions and amended decisions override stale prose. When
committed code and tests prove documentation is stale, correct it in the same
slice instead of asking permission or creating another status document.

## Slice workflow

1. Reconcile the contract and current implementation status.
2. Consult legacy behavior from git history when a contract references it;
   redesign rather than mechanically port.
3. Implement through small, narrow, injected capabilities.
4. Add unit, route, composition, and live integration coverage as applicable.
5. Update the API contract, architecture notes, and `MIGRATION.md`.
6. Run focused checks while iterating, then the relevant full quality gate.
7. Review the exact diff, stage only owned files, commit, push, and continue.

## Non-negotiable architecture

- Bun-only runtime, plain Bun workspaces, TypeScript 7, and pinned Elysia 2.
- Contract-first vertical slices using TypeBox and Eden `treaty` API tests.
- RFC 9457 problem details with stable snake_case `code` values.
- Request order: publishable key → platform project → PostgreSQL tenant →
  tenant-local auth → canonical roles → caller-scoped `Session` → handler.
- `x-nuvix-publishable-key` selects a project; it never authorizes access.
  `x-nuvix-key` is the distinct tenant-local secret API-key credential.
- Platform persistence supports PostgreSQL or SQLite through public
  `@nuvix/db` APIs. Tenant databases are PostgreSQL 18 only, using
  `nuvix/postgres:18.1` (source repository: `nuvix-dev/postgres`).
- One tenant resource owns one Bun `SQL`, shares it with `@nuvix/db` and
  `@nuvix/pg`, and closes it exactly once.
- Routes never receive SQL, adapters, raw `Database`, target metadata,
  registry controls, lifecycle controls, or `Database.system()`.
- `Database.system()` is limited to explicit trusted bootstrap, migration,
  reconciliation, and maintenance boundaries.
- Routes validate transport input and call a service. Services own business
  rules and receive narrow dependencies. Infrastructure construction belongs
  in composition.
- Legacy data, password hashes, sessions, and tokens are intentionally not
  compatible unless a later explicit decision says otherwise.
- Never add package patches, deep imports, declaration shims, generated-file
  edits, or `node_modules` edits. The existing Elysia OpenAPI patch is the only
  approved exception.

## Platform library upgrades

`@nuvix/*` libraries arrive as published npm packages. To pick up a new
upstream release, bump the range in the consuming manifests, run
`bun install` (commit `bun.lock`), and verify the frozen install.

## Validation

Use focused tests during implementation. Before completing a substantial
slice, run from the repo root:

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun test
```

Also run `git diff --check` and inspect `git status --short`. Use scoped Biome
formatting; never format unrelated files. Live tenant behavior must be tested
against exactly `nuvix/postgres:18.1` and must not be simulated while reported
as integration coverage.

## Git

- Work on `v2-rewrite` for routine work.
- Stage exact paths, normally this guide plus the slice's files.
- Use atomic Conventional Commits and push each validated logical slice.
- Never force-push or rewrite shared history.
- Commit upstream-library fixes in their own repositories first, publish, then
  bump here.

## Ask the user only when

- changing a locked Dxx decision or accepted ADR;
- introducing materially new or breaking public behavior not answered by a
  contract or reference behavior;
- credentials, access, or external infrastructure are unavailable; or
- a sibling package needs an incompatible public API change rather than a
  clear bug fix.

When blocked, record the exact blocker and continue another independent,
documented slice when safe.
