# v2 Contract — Teams

> Status: PROPOSED — review before implementation
> Depends on: `_conventions.md` (D19, D26–D28), `_i18n.md`, `@nuvix/db`
> Old code (reference only): root `apps/server/src/teams/`

Team management plus the membership invite/accept lifecycle. Backed by
`@nuvix/db` collections (teams, memberships) inside the project's document
schema — implementation waits on the new `@nuvix/db` package.

This revision corrects several inaccuracies in the previous draft found by
re-reading legacy `teams.service.ts`/`memberships.service.ts` line-by-line
(see "v1 → v2 deviations" for what's an intentional improvement vs. a plain
correction).

## Auth posture

Full auth: admin sessions, API keys (`KEY`), user sessions (`SESSION`), and
JWTs — same union as v1. Scopes: `teams.read`, `teams.write`. Privileged
callers (admin/API key) bypass the `owner`-role checks described below,
exactly as in v1.

---

## Endpoints — Teams

| Method | Path                      | Purpose                        | Scope       |
| ------ | ------------------------- | ------------------------------- | ----------- |
| POST   | `/v2/teams`               | Create team                     | teams.write |
| GET    | `/v2/teams`               | List teams (filter/search)      | teams.read  |
| GET    | `/v2/teams/:teamId`       | Get team                        | teams.read  |
| PUT    | `/v2/teams/:teamId`       | Update name                     | teams.write |
| DELETE | `/v2/teams/:teamId`       | Delete team (cascades)          | teams.write |
| GET    | `/v2/teams/:teamId/prefs` | Get prefs                       | teams.read  |
| PUT    | `/v2/teams/:teamId/prefs` | Replace prefs                   | teams.write |
| GET    | `/v2/teams/:teamId/logs`  | Audit logs for team (see below) | teams.read  |

### Team object

```json
{
  "$id": "team_abc123",
  "$permissions": ["update(\"team:team_abc123/owner\")", "delete(\"team:team_abc123/owner\")"],
  "name": "Design",
  "total": 3,
  "prefs": { "theme": "dark" },
  "$createdAt": "2026-08-26T10:00:00.000Z",
  "$updatedAt": "2026-08-26T10:00:00.000Z"
}
```

`total` counts **confirmed** members only — pending invites don't count
until accepted (v1 parity; see membership lifecycle below). `$permissions` is
included like every other document (base model field), omitted from the
original draft by oversight.

### `POST /v2/teams`

Body: `{ teamId?, name, roles? }`. `teamId` follows the standard create-id
convention (D28) — `'unique()'` (default) or a caller-supplied id (the
previous draft omitted this field entirely).

`roles` (array of strings, max the project's `limits.arrayParamsSize` —
dynamic per-project config, D42, not a hardcoded number — each ≤32 chars)
are assigned to the **creating user**. `"owner"` is unconditionally added to that
list if missing — not merely a default applied when the array is empty (v1
parity: `if (!roles.includes('owner')) roles.push('owner')`).

**Privileged-caller exception (v1 parity):** if the creator is an admin
session or API key, no membership document is created for anyone — the team
starts with `total: 0` and no owner. This mirrors v1 (an API key/console
provisioning a team on someone else's behalf shouldn't auto-enroll the
caller as a member); ownership is established afterward via an invite.

Duplicate `teamId` → `409 team_already_exists`.

### `PUT /v2/teams/:teamId`

Body: `{ name }` only. **Correction, not a deviation**: legacy's
`UpdateTeamDTO` already excludes `roles` from this endpoint (roles only ever
applied at creation time) — there is nothing being dropped here, the
previous draft's "v1 → v2 deviation" claim on this point was simply wrong
about what legacy does.

### `DELETE /v2/teams/:teamId`

Cascades: deletes every membership belonging to the team and invalidates
each affected member's cached user document (v1 parity — v1 does this
synchronously in the request via its deletes-queue helper; v2 does the
equivalent synchronously too since there's no async job infra yet, Phase 6).
DB failure during cascade → `500 /errors/internal`.

### Prefs

Arbitrary JSON object, replaced wholesale by `PUT` (v1 parity — confirmed:
`updateDocument('prefs', prefs)`, no merge).

**Bug fix (v2 improvement):** legacy's `getPrefs`/`setPrefs` have a
non-functional `TEAM_NOT_FOUND` check (`if (!team)` on a value that's never
null/undefined — `db.getDocument` always returns a `Doc`, so the check never
fires) — a request for prefs on a nonexistent team silently falls through
and returns `{}` instead of 404. v2 fixes this: both prefs endpoints use
`.empty()` like every other method in the module and correctly 404.

### `GET /v2/teams` — list

Standard D27 envelope (`data`, `meta.total/limit/offset` or cursor).
Filterable/sortable attributes: `name`, `total` (plus universal
`$id`/`$createdAt`/`$updatedAt`). Full-text `search` matches a synthetic
`[teamId, name].join(' ')` index (v1 parity). `total` in `meta` reflects
filter-type query params only, independent of `limit`/`offset` (v1 parity).

### `GET /v2/teams/:teamId/logs`

**Not implemented in this slice.** Legacy's own `teamLogs()` is a permanent
stub that always throws `501 general_not_implemented` and is hidden from its
own API docs — there is no real v1 behavior to port. v2 keeps the route
reserved in this contract (so the shape is agreed ahead of time) but returns
the same `501` until the shared audit-log pipeline exists (tracked
separately, not Phase 3/4 scope); this is **not** a feature regression since
v1 never had this feature either, despite exposing the route.

---

## Endpoints — Memberships

Nested under `/v2/teams/:teamId/memberships`:

| Method | Path                                                 | Purpose                    |
| ------ | ----------------------------------------------------- | --------------------------- |
| POST   | `/v2/teams/:teamId/memberships`                       | Invite member                |
| GET    | `/v2/teams/:teamId/memberships`                       | List memberships (filter/search) |
| GET    | `/v2/teams/:teamId/memberships/:membershipId`         | Get membership               |
| PATCH  | `/v2/teams/:teamId/memberships/:membershipId`         | Update roles                 |
| PATCH  | `/v2/teams/:teamId/memberships/:membershipId/status`  | Accept invite                |
| DELETE | `/v2/teams/:teamId/memberships/:membershipId`         | Remove member / decline invite |

### Membership object

```json
{
  "$id": "memb_xyz789",
  "$permissions": ["delete(\"user:user_001\")", "update(\"team:team_abc123/owner\")"],
  "userId": "user_001",
  "userName": "Ada Lovelace",
  "userEmail": "ada@example.com",
  "teamId": "team_abc123",
  "teamName": "Design",
  "roles": ["owner"],
  "status": "invited",
  "invited": "2026-08-26T10:00:00.000Z",
  "joined": null,
  "mfa": false,
  "confirmUrl": "https://console.example.com/invite?teamId=…&membershipId=…&userId=…&secret=…&expiry=…"
}
```

**Correction:** there is no `status` **column** in legacy — it stores
`confirm: boolean` + `invited`/`joined` timestamps, and `userName`/
`userEmail`/`teamName`/`mfa` are computed live from the current user/team
documents on every read (never persisted, never stale — there's no
sync-on-write mechanism because there's nothing to keep in sync). v2 keeps
`confirm`, `invited`, `joined` as the source of truth internally, but the API
response derives a `status: "invited" | "accepted"` field from `confirm`
purely for ergonomics (`status = confirm ? "accepted" : "invited"`) — this
is new, additive API sugar, not a port of a real column. `mfa` is preserved
as v1 computes it: `true` only if the member has MFA enabled **and** at
least one verified second factor (verified TOTP, or verified email/phone).

The **`secret` is never returned** by the API (v1 `sensitiveFields`) — it
only travels inside the emailed `confirmUrl`.

### `GET /v2/teams/:teamId/memberships` — list

Filterable/sortable attributes: `userId`, `teamId`, `invited`, `joined`,
`confirm`, `roles` (plus universal `$id`/`$createdAt`/`$updatedAt`).
Full-text `search` matches `[membershipId, userId].join(' ')` (v1 parity).

### Invite lifecycle

1. **Invite** — `POST memberships` with **at least one** of `email` /
   `userId` / `phone` (not exactly one — v1 allows multiple and
   cross-validates them: if `userId`+`email` are both given but the
   resolved user's actual email differs, `409 user_already_exists`; same for
   the `userId`+`phone` and `email`+`phone` pairs), plus `roles[]`.
   - **Authorization**: caller must hold the `owner` role on this team, or
     be privileged (admin/API key). A member with `teams.write` scope but no
     `owner` role gets `401 user_unauthorized` — the scope alone is not
     sufficient (v1 parity; the previous draft's "auth'd + teams.write"
     description was incomplete).
   - `url` (base confirmation link) is **required unless the caller is
     privileged**; missing when required → `422`. When present, it's
     validated against the project's allowed redirect hostnames.
   - Requires SMTP configured for non-privileged callers →
     `503 general_smtp_disabled` otherwise.
   - If no user matches the given identifier(s), a **new, unverified user
     account is created** for the invitee (subject to the project's
     user-count limit → `400 user_count_exceeded`; email collision against
     an existing OAuth identity → `409 user_email_already_exists`). This
     mirrors v1 — inviting an email/phone with no existing account silently
     provisions one — and is worth knowing since it's a real side effect,
     not just a documentation nicety.
   - **Privileged shortcut**: when the caller is admin/API key, the
     membership is created already `confirm: true`/`joined: now` with no
     secret, no email, and `team.total` incremented immediately — an
     "instant add," not an invite round-trip.
   - **v2 improvement**: v1 has no SMS dispatch for phone-only invites (the
     `phone` field is accepted and cross-validated but nothing is ever sent
     — a legacy gap, not a deliberate design). v2 dispatches phone invites
     through the messaging module's SMS provider once Phase 5 lands; until
     then, phone-only invites behave like v1 (accepted/validated, but
     delivery is a no-op) — this must be called out to callers via
     documentation, not silently shipped as "done."
   - Duplicate invite (same user already invited/member) →
     `409 team_invite_already_exists`.
   - Disabled at the project level (`auths.invites` off, non-privileged
     caller) → `501 user_auth_method_unsupported`.
2. **Accept** — invitee calls `PATCH …/status` with `{ userId, secret }`.
   Server checks, in order: membership belongs to `:teamId` (else
   `404 team_membership_mismatch`), secret hash matches
   (else `401 team_invalid_secret`), `userId` matches the membership's
   invited user (else `401 team_invite_mismatch`), not already accepted
   (else `409 membership_already_confirmed`). On success: `confirm: true`,
   `joined: now`, `team.total` incremented, the invitee's `emailVerification`
   is set `true` as a side effect (v1 parity — receiving the invite at that
   address proves ownership), and — **only if the caller has no existing
   session** — a new session is created for them (an ordinary
   email-factor session, `factors: ["email"]`; **correction**: v1 has no
   `INVITES` session type or pre-auth-only gate on this endpoint at all —
   the previous draft's claim to the contrary didn't match any guard in the
   code) so the flow completes without a separate login.
3. **Decline** — **correction**: there is no decline branch on the status
   endpoint in v1. Declining is `DELETE membership` by the invitee
   themselves (permitted because the membership grants delete to
   `user:<invitee>` directly) — this is the same endpoint used to leave a
   team, and is kept as the single mechanism for "remove myself" whether
   before or after accepting.
4. **Roles change** — `PATCH membership` with `{ roles[] }`. Same
   authorization as invite creation (`owner` role or privileged) — not just
   `teams.write` scope.
5. **Remove** — `DELETE membership`. Enforced by document permissions, not
   service-layer checks (v1 parity): the invitee can always remove their own
   membership (leave/decline), and any current `owner` can remove anyone's.
   A non-owner member removing someone else gets `401 user_unauthorized`
   (an `AuthorizationException` from the DB layer, remapped). `team.total`
   is decremented **only if the removed membership was `confirm: true`**
   (removing a still-pending invite doesn't affect the count).

**v2 improvement — last-owner protection (new, not in v1):** v1 has no
safeguard anywhere against a team ending up with zero owners — the sole
owner can leave, be removed by another owner, or have their `owner` role
stripped via a plain roles-replace `PATCH`, with nothing to stop it; an
ownerless team then can't use any owner-gated endpoint short of an
admin/API-key session. v2 adds an explicit guard: removing/downgrading the
last remaining `owner` membership (via `DELETE`, or via `PATCH roles` that
would drop `owner` from the last holder) is rejected with
`409 team_last_owner`. Flagging this for review since it's new behavior, not
ported from anywhere — confirm before implementation (see open questions).

Errors (`type` = coarse class, `code` = what SDKs branch on):

| Status | Type                      | Code                          | Trigger |
| ------ | ------------------------- | ------------------------------ | ------- |
| 404    | `/errors/not-found`       | `team_not_found`                | unknown team |
| 409    | `/errors/conflict`        | `team_already_exists`           | duplicate `teamId` |
| 404    | `/errors/not-found`       | `membership_not_found`          | unknown membership |
| 409    | `/errors/conflict`        | `team_invite_already_exists`    | already invited/member |
| 404    | `/errors/not-found`       | `team_membership_mismatch`      | membership doesn't belong to `:teamId` |
| 401    | `/errors/unauthorized`    | `team_invalid_secret`           | invite secret hash mismatch |
| 401    | `/errors/unauthorized`    | `team_invite_mismatch`          | `userId` doesn't match the invited user |
| 409    | `/errors/conflict`        | `membership_already_confirmed`  | accepting an already-accepted invite |
| 401    | `/errors/unauthorized`    | `user_unauthorized`             | non-owner, non-privileged caller tries an owner-gated action |
| 409    | `/errors/conflict`        | `team_last_owner`               | (v2 new) would leave the team with zero owners |
| 501    | `/errors/bad-request`     | `user_auth_method_unsupported`  | invites disabled at the project level |
| 503    | `/errors/bad-gateway`     | `general_smtp_disabled`         | SMTP not configured for a non-privileged invite |
| 400    | `/errors/bad-request`     | `user_count_exceeded`           | project user limit reached while auto-provisioning an invitee |
| 409    | `/errors/conflict`        | `user_email_already_exists`     | invitee email collides with an existing OAuth identity |

---

## v1 → v2 deviations

1. **Envelope**: `{ data, meta: { total, limit, offset } }` everywhere.
2. **Error format**: problem+json with the stable `code`s in the table
   above — corrected from the previous draft, which used
   `invalid_invite_secret` where legacy actually emits `team_invalid_secret`,
   and was missing most of the table entirely.
3. **`status` field on memberships is new API sugar** derived from
   `confirm`, not a ported column (see membership object section).
4. **Last-owner protection is new** (not in v1) — see invite lifecycle §6.
5. **`getPrefs`/`setPrefs` 404 bug is fixed**, not ported.
6. **Phone invite delivery is new** once Phase 5's messaging module lands;
   v1 never sent anything for phone-only invites.
7. **Audit events** (`membership.create`, etc.) move to the shared audit
   pipeline when it lands (Phase 6) — `GET .../logs` stays a reserved,
   `501`-returning route until then, matching its actual (non-)status in
   v1, not a regression.
8. **Webhook fan-out** (`teams.*`/`memberships.*` events → project webhooks)
   is preserved once the webhooks module (Phase 5) lands — tracked
   separately from the audit-log point above; not silently dropped.

## Implementation notes

- Both services stay pure over `@nuvix/db` docs; route layer owns auth,
  scopes, and the `owner`-role gate via hooks/guards.
- Secret hashing must reuse the same helper as auth tokens (single source of
  truth for comparison logic) — see `docs/api/account.md`.
- Smoke cases (no live DB): guest gets `403` on all endpoints; malformed
  create bodies get `422`. Full lifecycle cases need integration fixtures.

## Open questions for review

1. **Confirm the new last-owner protection** (§ invite lifecycle, point 6) —
   this is genuinely new behavior with no v1 precedent; confirm the
   `team_last_owner` error and the exact rule (blocks removal *and*
   role-downgrade of the sole owner) before implementation.
2. Confirm the derived `status` field convention (`confirm` stays the
   source of truth; `status` is response-only sugar).
3. Confirm phone-invite delivery is acceptable as a Phase-5-gated follow-up
   rather than a blocking dependency for this slice landing.
