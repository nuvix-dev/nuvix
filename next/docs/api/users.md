# v2 Contract — Users

> Status: PROPOSED — review before implementation
> Depends on: `_conventions.md` (D19, D26–D28), `_i18n.md`, D29 (password
> hashing policy), `@nuvix/db`, `docs/api/account.md` (shared session/MFA/
> identity primitives)
> Old code (reference only): root `apps/server/src/users/`

User administration: lifecycle, profile fields, prefs/labels/status,
identities, password-hash imports, tokens/JWTs, sessions, MFA factors and
recovery codes, push targets. Admin-facing surface (the end-user "account"
surface is `docs/api/account.md`).

This revision corrects several inaccuracies in the previous draft found by
re-reading legacy `users.service.ts`/`mfa.service.ts`/`sessions.service.ts`/
`targets.service.ts` line-by-line — see "v1 → v2 deviations" for what's an
intentional improvement vs. a plain correction.

## Auth posture

Admin/key/session/JWT union for most of the module; two documented
exceptions below (`GET /usage` is admin-only in v1; MFA sub-routes are
key-only in v1, widened in v2 — see deviations). Scopes: `users.read`,
`users.write`.

---

## Endpoints — Core

| Method | Path                              | Purpose                                        |
| ------ | ---------------------------------- | ----------------------------------------------- |
| POST   | `/v2/users`                        | Create user (server-side hashing)               |
| POST   | `/v2/users/argon2`                 | Create user with pre-hashed Argon2              |
| POST   | `/v2/users/bcrypt`                 | Create user with pre-hashed bcrypt              |
| GET    | `/v2/users`                        | List users (queries + search)                   |
| GET    | `/v2/users/usage`                  | Aggregate usage stats (**admin-only**)          |
| GET    | `/v2/users/:userId`                | Get user                                        |
| DELETE | `/v2/users/:userId`                | Delete user (hard delete, cascades)             |
| PATCH  | `/v2/users/:userId/name`           | Update name                                     |
| PATCH  | `/v2/users/:userId/password`       | Update password                                 |
| PATCH  | `/v2/users/:userId/email`          | Update email                                    |
| PATCH  | `/v2/users/:userId/phone`          | Update phone                                    |
| PATCH  | `/v2/users/:userId/verification`   | Set email-verification flag directly            |
| PATCH  | `/v2/users/:userId/verification/phone` | Set phone-verification flag directly       |
| GET    | `/v2/users/:userId/prefs`          | Get prefs                                       |
| PATCH  | `/v2/users/:userId/prefs`          | Merge prefs (**v2 improvement** — see below)    |
| PUT    | `/v2/users/:userId/labels`         | Replace labels                                  |
| PATCH  | `/v2/users/:userId/status`         | Activate/block                                  |
| GET    | `/v2/users/:userId/memberships`    | Teams the user belongs to                       |
| GET    | `/v2/users/:userId/logs`           | Audit logs                                      |

**Correction — `DELETE /v2/users/:userId` was missing from the previous
draft entirely** (not a D29 removal, a plain omission). It hard-deletes the
user document and cascades cleanup of sessions/tokens/targets/memberships/
identities (background job once Phase 6 lands; synchronous best-effort
until then). Blocked (`status: false`) users can still be deleted (v1
parity — deletion has no block-check, unlike the self-service delete-account
flow in `account.md` which does refuse on a blocked account. This asymmetry
is intentional: admin delete is a stronger, unconditional operation).

**Correction — the two verification-flag endpoints were also missing.**
They directly set `emailVerification`/`phoneVerification` with no side
effects (no re-send, no expiry check) — an admin override, distinct from
the self-service verification flow in `account.md`.

### Legacy hash variants — REMOVED (D29)

v1's `POST /users/md5 | sha | phpass | scrypt | scrypt-modified` are **not
carried over**. Per D29 only bcrypt/argon2 are supported for verification;
importing legacy hashes would create accounts that can never re-verify
cleanly. SDKs calling these paths get `404 problem+json` like any unknown
route. Migration path for legacy installs: bulk-reset flows, not hash
imports.

### Create user

Body (`POST /v2/users`): `{ userId?, email?, phone?, password?, name? }`.
**v2 improvement**: at least one of `email`/`phone` is explicitly validated
as required (`422` otherwise) — v1 accepts a body with none of them set at
the DTO level (a real gap, not an enforced rule; it "works in practice"
only because nothing downstream needs an identifier, which isn't a
guarantee worth keeping). Server hashes `password` with the project default
(bcrypt/argon2 per D5). The argon2/bcrypt variants accept an already-hashed
`password` (+ `hashOptions` where applicable) so plaintext never crosses the
wire during migrations.

`password` and `hashOptions` are sensitive fields — never echoed back
(explicit response serialization, not v1's blanket model-field exposure
plus after-the-fact interceptor stripping).

### Status

`PATCH status` body: `{ status: boolean }` → maps to v1's active/blocked
duality. Blocked users fail session validation at the auth layer.

## Endpoints — Identities & Tokens & JWTs

| Method | Path                               | Purpose                                          |
| ------ | ----------------------------------- | -------------------------------------------------- |
| GET    | `/v2/users/identities`              | List OAuth identities (admin view, all users)       |
| DELETE | `/v2/users/identities/:identityId`  | Delete identity                                    |
| POST   | `/v2/users/:userId/tokens`          | Create a generic secret token for this user        |
| POST   | `/v2/users/:userId/jwts`            | Issue JWT for user                                 |

Identity object fields: `userId`, `provider`, `providerUid`,
`providerEmail`, `providerAccessToken`, `providerAccessTokenExpiry`,
`providerRefreshToken` (plus base `$id`/`$createdAt`/`$updatedAt`/
`$permissions`). Filterable/sortable: `userId`, `provider`, `providerUid`,
`providerEmail`, `providerAccessTokenExpiry`.

**Correction — `POST /v2/users/:userId/tokens` does not send anything and
has no `url` field.** The previous draft conflated it with the self-service
magic-URL flow (`docs/api/account.md`'s `POST /account/tokens/magic-url`).
The admin endpoint is simpler: body `{ length?, expire? }`
(`length` 4–128 chars default 6, `expire` 60s–1yr default
`TOKEN_EXPIRATION_GENERIC`), and the response returns the **plaintext
secret directly** (`{ secret, expire, userId }`) for the admin caller to
deliver however they choose — no email/SMS dispatch, no `url` templating.

**JWT**: body `{ sessionId?, duration? }` (`sessionId` defaults to the
user's most recent session, `duration` 0–3600s default 900). Response:
`{ jwt }` (not `token`). **v2 improvement**: v1 silently signs a JWT with an
empty `sessionId` claim if the given `sessionId` doesn't belong to the user;
v2 rejects that with `404 user_session_not_found` instead of issuing a
half-valid token.

## Endpoints — Sessions (`/v2/users/:userId/sessions`)

| Method | Path                    | Purpose                |
| ------ | ----------------------- | ----------------------- |
| GET    | `…/sessions`            | List user sessions (no filter/search — same as v1) |
| POST   | `…/sessions`            | Create session (admin) |
| DELETE | `…/sessions`            | Delete all sessions    |
| DELETE | `…/sessions/:sessionId` | Delete one session     |

Session object shape matches `docs/api/account.md`'s session object.
`current` is always `false` here (an admin is never "the" session owner).

## Endpoints — MFA (`/v2/users/:userId/mfa`)

| Method | Path                         | Purpose                                             |
| ------ | ----------------------------- | ---------------------------------------------------- |
| PATCH  | `…/mfa`                       | Enable/disable MFA                                    |
| GET    | `…/mfa/factors`                | List enrolled factors                                 |
| PATCH  | `…/mfa/recovery-codes`         | Generate codes (**first time only** — 409 if they already exist) |
| PUT    | `…/mfa/recovery-codes`         | Regenerate/replace existing codes (404 if none exist) |
| GET    | `…/mfa/recovery-codes`         | View remaining recovery codes                         |
| DELETE | `…/mfa/authenticators/:type`   | Remove authenticator                                  |

**Correction — the PATCH/PUT purposes were swapped in the previous draft.**
Legacy: `PATCH` = `generateMfaRecoveryCodes` (first-time creation, conflicts
if codes already exist); `PUT` = `regenerateMfaRecoveryCodes` (replace,
404s if none exist yet). Kept as-is (v1 parity) — only the documentation
was wrong.

**v2 improvement**: `GET …/mfa/factors`'s `recoveryCode` field is always
`false` in v1 (never actually computed — a legacy loose end, not intended
behavior). v2 computes it as `recoveryCodes.length > 0`.

**Correction — auth posture.** v1's `MfaController` for the *admin* users
module is **key-only** (`AuthType.KEY`), not the admin/key/session/JWT union
implied by the previous draft. **v2 improvement**: widen this to
admin+key, matching the rest of the Users module, since restricting MFA
admin actions to API keys only (excluding admin console sessions) looks
like an oversight rather than an intentional security boundary.

## Endpoints — Targets (`/v2/users/:userId/targets`)

Push/notification targets. Standard CRUD:

`POST` / `GET` / `GET :targetId` / `PATCH :targetId` / `DELETE :targetId`.

**Correction — the create body was incomplete.** Full body:
`{ targetId?, providerType, identifier, name, providerId? }` — `name` is
**required** (not optional, and not in the previous draft at all);
`providerId` is optional. `PATCH` accepts `{ identifier?, name?,
providerId? }` (not just `identifier`). `providerType` ∈
`email | sms | push`; `identifier` is validated against the matching format
(email/E.164 phone) when `providerType` is `email`/`sms`.

---

## v1 → v2 deviations

1. **Legacy hash create endpoints removed** (D29) — see above.
2. **Envelope**: `{ data, meta: { total, limit, offset } }`; list queries
   use the shared cursor/offset conventions from `_conventions.md`. (v1's
   actual envelope is flat `{ data, total }` with no `limit`/`offset` in the
   response — this is a real deviation, not something v1 already does,
   which the previous draft correctly anticipated but should be stated as
   such rather than implied to be a detail already settled.)
3. **Error format**: problem+json with stable `code`s — corrected from the
   previous draft's invented strings (`user_email_exists` →
   `user_email_already_exists`; `identity_not_found` →
   `user_identity_not_found`) to match what legacy actually emits.
4. **Sensitive-field stripping** becomes explicit response serialization
   instead of v1's "expose on the model, strip via a separate interceptor"
   split.
5. **Usage endpoint**: kept for parity, admin-only (matching v1's actual,
   stricter auth posture — corrected from the previous draft's blanket
   claim), flagged as a console-only candidate to move later.
6. **`PATCH prefs` is a real shallow merge in v2** — **correction, not
   parity**: v1's `updatePrefs` is a full replace despite the `PATCH` verb
   (confirmed: `user.set('prefs', prefs)`, no merge step anywhere). The
   previous draft's open question ("v1 uses PATCH-as-merge; proposed keeping
   merge for parity") was based on a wrong premise — there is no v1 merge
   behavior to have parity *with*. v2 makes `PATCH` a genuine merge (matching
   what the verb implies) as a deliberate, documented improvement.
7. **Password update revokes other sessions in v2** — **new, not
   parity**: v1 does not invalidate any other session when an admin resets
   a user's password (confirmed: only a webhook fires; no session deletion
   anywhere in that path). v2 adds this as a security improvement, applied
   consistently with the same change in `docs/api/account.md`'s self-service
   password update.
8. **MFA admin auth posture widened** to admin+key (see above) — v1
   restricts it to key-only, which reads as an oversight.
9. **JWT issuance rejects an unknown `sessionId`** instead of v1's silent
   empty-claim fallback (see above).
10. **`GET …/mfa/factors.recoveryCode` is now computed correctly** instead
    of v1's permanently-`false` field.
11. **Labels**: v2 keeps v1's exact validation — each label
    `^[a-zA-Z0-9]{1,36}$`, array capped at `limits.arrayParamsSize`,
    deduplicated — none of which was documented in the previous draft.
12. **`GET …/memberships` total is a real count in v2** — **correction**:
    v1's `total` is just `memberships.length` of whatever page was fetched,
    not a true count query (unlike every other list endpoint in this
    module, which does call `db.count(...)`). v2 fixes this inconsistency.

## Implementation notes

- Depends on `@nuvix/db` for user docs + identities/targets collections.
- `updateEmail`/`updatePhone` are compound operations, not simple field
  setters (v1 parity): they reset the corresponding verification flag to
  `false`, and rename/delete/create a matching `targets` document for that
  channel so the target stays consistent with the primary field.
- `updatePassword` supports clearing the password to `''` (v1 parity) as a
  distinct "lock out password login" state — this is not re-hashed, it's
  stored empty.
- Password history (`passwordHistory > 0`) and personal-data checks
  (`personalDataCheck`) both apply to `updatePassword`, mirroring
  `docs/api/account.md`'s self-service password update — same validators,
  single source of truth.
- List query allow-lists per sub-resource (v1 parity, previously
  undocumented): `users` → `name, email, phone, status, passwordUpdate,
  registration, emailVerification, phoneVerification, labels`; `identities`
  → `userId, provider, providerUid, providerEmail,
  providerAccessTokenExpiry`; `memberships` → `userId, teamId, invited,
  joined, confirm, roles`; `targets` → `userId, providerId, identifier,
  providerType`; `logs` → `time, period` only. `sessions` has no query
  support at all (returns the full list). Any other attribute →
  `400 general_query_invalid`.
- Smoke cases without DB: guest 403s, 422 validation shapes, removed-route
  404s (`/v2/users/md5` etc.).

## Open questions for review

1. Confirm the `PATCH prefs` merge-semantics change (deviation #6) — this
   is new behavior, not v1 parity as previously assumed.
2. Confirm session revocation on admin-triggered password reset (deviation
   #7) is desired (it's a security improvement, but changes client-visible
   behavior for any session the affected user currently holds).
3. Confirm widening MFA admin auth to admin+key (deviation #8).
