# v2 Contract — Teams

> Status: IMPLEMENTED — `apps/server/src/teams/route.ts` (+ `routes.ts`,
> `service.ts`), `apps/server/src/teams/memberships/{routes,service}.ts`,
> shared formatters in `apps/server/src/users/formatter.ts`
> Depends on: `_conventions.md` (D19, D26–D28), `@nuvix/db`
> Old code (reference only): root `apps/server/src/teams/`

Team management plus the membership invite/accept lifecycle, backed by
`@nuvix/db` collections (`teams`, `memberships`) in the project's `auth`
schema. Every route requires a project (via `x-nuvix-publishable-key`) and an
authenticated caller resolved by the shared tenant context chain; the
invite-creation and roles-change `owner`-role gate described in earlier
drafts is **not** implemented — see Known gaps.

---

## Endpoints — Teams

| Method | Path                      | Purpose                | Notes                                 |
| ------ | ------------------------- | ---------------------- | ------------------------------------- |
| POST   | `/v2/teams`               | Create team            |                                       |
| GET    | `/v2/teams`               | List teams             | `search`, `limit`, `offset`, `cursor` |
| GET    | `/v2/teams/:teamId`       | Get team               |                                       |
| PUT    | `/v2/teams/:teamId`       | Update name            | body `{ name }`                       |
| DELETE | `/v2/teams/:teamId`       | Delete team (cascades) |                                       |
| GET    | `/v2/teams/:teamId/prefs` | Get prefs              |                                       |
| PUT    | `/v2/teams/:teamId/prefs` | Replace prefs          | body `{ prefs }`                      |
| GET    | `/v2/teams/:teamId/logs`  | Reserved               | always `501 general_not_implemented`  |

### Team object

```json
{
  "$id": "team_abc123",
  "name": "Design",
  "total": 3,
  "prefs": { "theme": "dark" },
  "$createdAt": "2026-08-26T10:00:00.000Z",
  "$updatedAt": "2026-08-26T10:00:00.000Z"
}
```

`total` counts **confirmed** members only — pending invites don't count
until accepted.

### `POST /v2/teams`

Body: `{ teamId?, name, roles? }`. `teamId` follows the standard create-id
convention (D28) — `'unique()'` (default) or a caller-supplied id.
Duplicate `teamId` → `409 team_already_exists`.

When the request resolves to a user, that user is enrolled as a member with
`['owner', ...roles]` (owner is always prepended, deduplicated), the
membership is created already `confirm: true` / `joined: now`, and `total`
starts at `1`. Guest/API-key callers (no resolved user) create an empty team
(`total: 0`, no owner) — ownership is established afterward via an invite.

### `PUT /v2/teams/:teamId`

Body: `{ name }` only. Roles are never editable after creation.

### `DELETE /v2/teams/:teamId`

Deletes every membership belonging to the team, then the team itself.
Returns `200 { status: 'ok' }`.

### Prefs

Arbitrary JSON object, replaced wholesale by `PUT` (no merge). Unknown team
→ `404 team_not_found` on both prefs endpoints (the legacy
non-functional-check bug is fixed).

### `GET /v2/teams/:teamId/logs`

Reserved: always `501 general_not_implemented` (legacy's own `teamLogs()`
was a permanent stub — nothing to port).

---

## Endpoints — Memberships

Nested under `/v2/teams/:teamId/memberships`:

| Method | Path                                                 | Purpose                                        |
| ------ | ---------------------------------------------------- | ---------------------------------------------- |
| POST   | `/v2/teams/:teamId/memberships`                      | Invite member                                  |
| GET    | `/v2/teams/:teamId/memberships`                      | List memberships (`search`, `limit`, `offset`) |
| GET    | `/v2/teams/:teamId/memberships/:membershipId`        | Get membership                                 |
| PATCH  | `/v2/teams/:teamId/memberships/:membershipId`        | Replace roles                                  |
| PATCH  | `/v2/teams/:teamId/memberships/:membershipId/status` | Accept invite                                  |
| DELETE | `/v2/teams/:teamId/memberships/:membershipId`        | Remove member / decline invite                 |

### Membership object

```json
{
  "$id": "memb_xyz789",
  "userId": "user_001",
  "teamId": "team_abc123",
  "teamName": "Design",
  "userName": "Ada Lovelace",
  "userEmail": "ada@example.com",
  "roles": ["owner"],
  "invited": "2026-08-26T10:00:00.000Z",
  "joined": null,
  "confirm": false,
  "$createdAt": "2026-08-26T10:00:00.000Z",
  "$updatedAt": "2026-08-26T10:00:00.000Z"
}
```

- `confirm` is the source of truth (`false` = pending invite, `true` =
  accepted). There is no derived `status` field, no `mfa` field, and no
  `confirmUrl` — earlier drafts proposed all three; none shipped.
- `userName`/`userEmail`/`teamName` are populated by the **invite** response
  only; reads return them as stored (empty strings).
- The **`secret` is never returned** by the API — it is stored hashed on
  the membership document only (invite email dispatch is a Known gap).

### `POST /v2/teams/:teamId/memberships`

Body: `{ userId?, email?, phone?, roles, url?, name? }` — `roles` is
required; at least one of `userId`/`email`/`phone` is required (else
`400 general_argument_invalid`). Resolution precedence:
`userId` → `email` → `phone` (first match wins; given identifiers are not
cross-validated against each other).

- Known `userId` that doesn't exist → `404 user_not_found`.
- No user matches `email`/`phone` → a **new unverified user is created**
  (`name` falls back to `name` → `email` → `''`); this is a real side
  effect, not just documentation.
- A membership is always created `confirm: false` with a generated secret —
  there is no privileged "instant add" shortcut.
- `url` is accepted but unused (reserved for email dispatch).

### `PATCH …/memberships/:membershipId/status` — accept

Body: `{ userId, secret }`. Checks, in order: membership exists and belongs
to `:teamId` (else `404 membership_not_found`), secret hash matches (else
`400 team_invalid_secret`), `userId` matches the invited user (else
`400 team_invite_mismatch`), not already accepted (else
`400 membership_already_confirmed`). On success: `confirm: true`,
`joined: now`, `team.total` incremented. No session is created and
`emailVerification` is not touched.

### `PATCH …/memberships/:membershipId` — roles

Body: `{ roles }` (complete replacement list). No owner-role gate beyond the
shared auth chain (see Known gaps).

### `DELETE …/memberships/:membershipId`

Single mechanism for remove/leave/decline. `team.total` is decremented
(floored at 0) **only if the removed membership was `confirm: true`**.
Returns `200 { status: 'ok' }`.

---

## List envelope

Both list endpoints use the server list convention — `{ total, <resources> }`:

```json
{ "total": 2, "teams": [ … ] }
{ "total": 2, "memberships": [ … ] }
```

`total` is a real count query over the filter-type query params,
independent of `limit`/`offset`.

## Errors

| Status | Type                      | Code                           | When                                     |
| ------ | ------------------------- | ------------------------------ | ---------------------------------------- |
| 400    | `/errors/bad-request`     | `general_argument_invalid`     | invite with no identifier                |
| 400    | `/errors/bad-request`     | `team_invalid_secret`          | invite secret hash mismatch              |
| 400    | `/errors/bad-request`     | `team_invite_mismatch`         | `userId` doesn't match the invited user  |
| 400    | `/errors/bad-request`     | `membership_already_confirmed` | accepting an already-accepted invite     |
| 404    | `/errors/not-found`       | `team_not_found`               | unknown team                             |
| 404    | `/errors/not-found`       | `membership_not_found`         | unknown membership or team mismatch      |
| 404    | `/errors/not-found`       | `user_not_found`               | invite references a nonexistent `userId` |
| 409    | `/errors/conflict`        | `team_already_exists`          | duplicate `teamId`                       |
| 501    | `/errors/not-implemented` | `general_not_implemented`      | `GET /v2/teams/:teamId/logs`             |

## Known gaps

Documented in earlier drafts, **not implemented** in v2 (no code emits these
codes):

- Owner-role gate on invite creation / roles change / removal
  (`user_unauthorized` for non-owner members).
- Last-owner protection (`team_last_owner`).
- Invite email/SMS dispatch, redirect-URL validation, SMTP gating
  (`general_smtp_disabled`), derived `confirmUrl`.
- Cross-validation of `userId`+`email`/`phone` pairs on invite.
- Project-level feature gates (`auths.invites` →
  `user_auth_method_unsupported`) and per-project limits
  (`user_count_exceeded`, `limits.arrayParamsSize`).
- Membership-derived `status`/`mfa` response fields.
- Webhook fan-out and audit events for teams/memberships mutations.
