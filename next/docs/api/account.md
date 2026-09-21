# v2 Contract — Account (End-User Auth)

> Status: PROPOSED — review before implementation
> Depends on: `_conventions.md` (D19, D26–D28), `_i18n.md`, D5 (password
> hashing), D6 (JWT), D23 (token-ready auth model), D29 (legacy compat
> dropped), `@nuvix/db`
> Old code (reference only): root `apps/server/src/account/**`
> Sibling contract: `docs/api/users.md` (admin-facing surface over the same
> data — sessions/MFA/identity object shapes are shared)

This is the end-user-facing auth surface: signup/login, session lifecycle,
email/phone verification, password recovery, MFA, OAuth2, and push targets.
It is the highest-risk module in the rewrite (`MIGRATION.md` Phase 4) and,
until now, had no written contract — this document is the first one,
written directly from an exhaustive line-by-line read of legacy
`account/**` (account, sessions, mfa, recovery, identities, targets), not
from a stale/partial mental model. Every legacy endpoint, business rule, and
error code is accounted for below; anywhere v2 changes behavior it's called
out explicitly in "v1 → v2 deviations" as either a **correction** (the old
behavior was a bug) or an **improvement** (a deliberate upgrade) — never a
silent feature drop.

## D23, resolved: the session/token model

D23 deferred a final call between "DB sessions" and "short-lived access +
refresh tokens (Clerk-style)" to this gate. **Resolution: both, and they're
the same mechanism v1 already has, just formalized as primary/secondary
instead of primary/side-feature:**

- **Session** = the long-lived, DB-backed, revocable credential (v1's
  `sessions` collection, unchanged in spirit). Returned once as a plaintext
  `secret` on creation; every subsequent presentation is via the
  `x-nuvix-session` header. This *is* the refresh token in Clerk's model —
  it's what proves "this device is still logged in" and what mints new
  access tokens.
- **Access token** = a short-lived JWT (default 15 min, caller may request
  1 min – 1 hr) minted from a valid session via
  `POST /v2/account/tokens/jwt` (v1's `/account/jwts`, renamed for
  consistency with the other `tokens/*` endpoints). Carries `sub` (user id)
  and `sid` (session id) claims; presented via `x-nuvix-jwt`. Stateless to
  verify (no DB hit), so it's the recommended credential for
  latency-sensitive or client-side code paths, while the session secret
  stays server-side/long-lived-storage only where possible.
- Both headers remain valid simultaneously (`context/auth.ts`'s existing
  `session > jwt > key > guest` precedence, built in Phase 1, already
  matches this exactly — no context-chain changes needed).
- **v2 simplification**: v1's `x-nuvix-session` value is an AES-GCM
  encrypted `{id, secret}` blob (so the id doesn't require a DB hash
  lookup). v2 drops the encryption step: the header carries the raw
  session `secret` directly, looked up by a **unique index on
  `Auth.hash(secret)`** (SHA-256, same as every other token in this module).
  This is strictly simpler (no encrypt/decode step, one less key to manage)
  and equally secure (a high-entropy random secret, hashed at rest,
  compared via constant-time equality) — not a capability reduction.

---

## Project configuration & limits (D42) — dynamic, not hardcoded

Every feature gate and numeric limit referenced anywhere in this document
(and in `docs/api/teams.md`/`users.md`) is resolved from the **calling
project's own settings** at request time, never a hardcoded constant in
service code. This mirrors legacy's `project.auths.*`/`project.limits.*`
pattern exactly — v1 already designed these as per-project, so this isn't
new behavior, it's a rule this contract makes explicit so no implementer
accidentally bakes a default in as a constant. A project that never
customizes a setting gets the documented default; one that does gets its
override, resolved the same way `context/project.ts` already resolves the
project itself (D40/D41) — one more thing hanging off the same resolved
`ResolvedProject`, not a separate mechanism.

Defaults (overridable per project, exact legacy values carried forward
unless noted):

| Setting | Default | Used by |
| ------- | ------- | ------- |
| `auths.emailPassword` | `true` | `POST /account`, `POST /account/sessions/email` |
| `auths.anonymous` | `true` | `POST /account/sessions/anonymous` |
| `auths.magicUrl` | `true` | `POST /account/tokens/magic-url` |
| `auths.emailOtp` | `true` | `POST /account/tokens/email` |
| `auths.phone` | `false` (needs an SMS provider configured) | `POST /account/tokens/phone` |
| `auths.invites` | `true` | `docs/api/teams.md` invite creation |
| `auths.duration` | `31536000` (1 year) | session `expire` |
| `auths.limit` | `0` (unlimited) | `user_count_exceeded` gate |
| `auths.passwordHistory` | `0` (disabled) | password-reuse check |
| `auths.personalDataCheck` | `false` | personal-data-in-password check |
| `auths.sessionAlerts` | `false` | new-session email notice |
| `auths.mockNumbers` | `[]` | QA phone-OTP bypass |
| `limits.userSessionsMax` | `100` | hard cap, v2 now enforces (see Sessions section) |
| `limits.userSessionsDefault` | `10` | soft/expected cap before LRU eviction kicks in |
| `limits.arrayParamsSize` | `100` | max array length for `roles`/`labels`/etc. across this doc and `teams.md`/`users.md` |

A disabled gate fails with `501 user_auth_method_unsupported`, exactly as
in v1. Implementation depends on the Phase 7 "auth-settings" platform slice
for real per-project persistence; until it lands, services read these from
a settings object with the table above as compiled-in defaults, structured
so swapping in the real per-project lookup later is a one-line change, not
a rewrite.

---

## Auth posture

Documented per endpoint below (mirrors v1 exactly: most mutation endpoints
require `SESSION | JWT`; session-*creation* endpoints are guest-accessible;
a few are gated by project-level feature flags via `AllowSessionType`).
Scope: `account` for self-service profile/session endpoints, `sessions.write`
for session/token-creation endpoints (matches v1's scope split, which
existing API keys already assume).

---

## Endpoints — Account core (`/v2/account`)

| Method | Path                  | Purpose                                   | Auth        | Gate |
| ------ | --------------------- | ------------------------------------------ | ----------- | ---- |
| POST   | `/v2/account`         | Create account (email + password)           | guest       | `auths.emailPassword` |
| GET    | `/v2/account`         | Get current account                          | SESSION\|JWT | — |
| DELETE | `/v2/account`         | Delete own account                           | SESSION\|JWT | — |
| GET    | `/v2/account/prefs`   | Get prefs                                    | SESSION\|JWT | — |
| PATCH  | `/v2/account/prefs`   | Merge prefs                                  | SESSION\|JWT | — |
| PATCH  | `/v2/account/name`    | Update name                                  | SESSION\|JWT | — |
| PATCH  | `/v2/account/password`| Update password                              | SESSION\|JWT | — |
| PATCH  | `/v2/account/email`   | Update email                                 | SESSION\|JWT | — |
| PATCH  | `/v2/account/phone`   | Update phone                                 | SESSION\|JWT | — |
| PATCH  | `/v2/account/status`  | Block own account + clear session credential | SESSION\|JWT | — |

### Account object

```json
{
  "$id": "user_001",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "phone": "+15550001234",
  "emailVerification": true,
  "phoneVerification": false,
  "status": true,
  "labels": ["vip"],
  "mfa": false,
  "prefs": { "theme": "dark" },
  "targets": [
    { "$id": "target_1", "name": "Ada's iPhone", "providerType": "push", "identifier": "expo-token-…" }
  ],
  "registration": "2026-08-26T10:00:00.000Z",
  "$createdAt": "2026-08-26T10:00:00.000Z",
  "$updatedAt": "2026-08-26T10:00:00.000Z"
}
```

**Correction — `targets` was missing from the object shape.** v1's
`UserModel` (the shared base both `AccountModel` and `docs/api/users.md`'s
admin `User` object extend) embeds the account's full `targets` array
directly — not just a flat DB row. v2 keeps this: every account/user
response is a **view**, not a 1:1 table dump, and includes the caller's
push/email/sms targets inline so clients don't need a separate round-trip
for the common case of "what targets does this account have."

`password`/`hash`/`hashOptions`/`passwordHistory`/`mfaRecoveryCodes` are
never present in any account response (explicit serialization, not v1's
model-exposes-then-interceptor-strips pattern).

### `POST /v2/account` — create account

Body: `{ userId?, email, password, name? }`. `userId` follows the standard
create-id convention (D28). **v2 improvement**: password is checked against
`passwordHistory`/`personalDataCheck` project settings exactly like
`updatePassword` (v1 already does this at creation — kept, just calling it
out since the previous drafts of sibling contracts missed this class of
rule entirely). Duplicate `userId`/email/phone → `409 user_already_exists`.
Project user-count limit reached → `400 user_count_exceeded`.

### `DELETE /v2/account` — self-service delete

**v2 improvement, new capability**: v1 has no self-service account
deletion — `DELETE /account` in legacy is `AuthType.ADMIN`-only (i.e. it's
actually an admin operation living under the account path, not a real
self-service feature; the equivalent self-service admin path is documented
in `docs/api/users.md`'s `DELETE /v2/users/:userId`). v2 adds a genuine
self-service version here: hard-deletes the account and cascades
sessions/tokens/targets/memberships/identities (same cascade as the admin
path), refuses on a blocked account (`401 user_blocked`, v1 parity for the
refusal condition, just now reachable by the account owner rather than only
an admin). Flagged as new — confirm before implementation (open questions).

### `PATCH /v2/account/prefs`

**v2 improvement**: real shallow merge (v1's `PATCH` here is a full
replace despite the verb — same correction as `docs/api/users.md`).

### `PATCH /v2/account/password`

Body: `{ password, oldPassword }`. Verifies `oldPassword` unless the account
has never had one set (OAuth2/anonymous/magic-url/phone-only accounts —
v1 parity: `passwordUpdate === null` skips verification and simply sets the
new password). Enforces `passwordHistory`/`personalDataCheck` project
settings (v1 parity). Re-hashes with the current default algo/params.
**v2 improvement**: revokes every other session (all sessions except the
one used to make this call) — v1 does not do this (confirmed: no session
deletion anywhere in this path, only a webhook fires). This is a security
upgrade applied consistently with `docs/api/users.md`'s equivalent change.
Wrong `oldPassword` → `401 user_invalid_credentials`.

### `PATCH /v2/account/email` / `/phone`

Body: `{ email, password }` / `{ phone, password }`. Same
skip-if-never-set-password rule as above. Resets the corresponding
verification flag to `false` and renames/creates/deletes the matching
`targets` document for that channel (v1 parity — compound operation, not a
plain field setter; see `docs/api/users.md`'s implementation notes for the
exact target-sync rule, shared logic). Duplicate → `409
user_email_already_exists` / `409 user_phone_already_exists`.

### `PATCH /v2/account/status`

No body. Sets `status: false` (self-block) and revokes the calling
session's credential. **Correction**: there is no "reactivate" endpoint in
v1 and v2 doesn't add one either — reactivation is an admin action via
`docs/api/users.md`'s `PATCH /v2/users/:userId/status`.

---

## Endpoints — Verification (`/v2/account/verifications`)

| Method | Path                          | Purpose                       |
| ------ | ------------------------------ | ------------------------------ |
| POST   | `/v2/account/verifications/email` | Create email verification token |
| PUT    | `/v2/account/verifications/email` | Confirm email verification      |
| POST   | `/v2/account/verifications/phone` | Create phone verification token (OTP) |
| PUT    | `/v2/account/verifications/phone` | Confirm phone verification      |

**Path correction**: v1 exposes both `/verification` (singular, legacy) and
`/verifications/email` (current) as aliases for the same route. v2 keeps
only the plural form — the singular alias is a v1-only compatibility path
that D29 doesn't require carrying forward.

Create requires SMTP/SMS configured (`503 general_smtp_disabled` /
`general_phone_disabled`) and the channel not already verified (`409
..._already_verified`); phone verification additionally requires a phone
already set (`400 user_phone_not_found`). Confirm body:
`{ userId, secret }`; verifies the secret hash, consumes the token
(one-time use — deleted after success, v1 parity), sets the flag `true`.
Invalid/expired/reused secret → `401 user_invalid_token`.

---

## Endpoints — Identities (`/v2/account/identities`)

| Method | Path                                | Purpose                          |
| ------ | ------------------------------------- | ---------------------------------- |
| GET    | `/v2/account/identities`              | List OAuth2 identities linked to current user |
| DELETE | `/v2/account/identities/:identityId`  | Unlink an identity                 |

**v2 improvement**: v1's delete has no ownership check against the caller
(any authenticated user could pass any `identityId` — confirmed by reading
`IdentityController`/`IdentityService`, there is no `userId` comparison
before delete). v2 adds one: deleting an identity that doesn't belong to
the caller → `404 user_identity_not_found` (same code as "doesn't exist" —
deliberately not `403`, to avoid confirming existence of someone else's
identity).

---

## Endpoints — MFA (`/v2/account/mfa`)

| Method | Path                              | Purpose                                                       |
| ------ | ----------------------------------- | ---------------------------------------------------------------- |
| PATCH  | `/v2/account/mfa`                   | Enable/disable MFA                                                |
| GET    | `/v2/account/mfa/factors`            | List available factors (totp/email/phone/recoveryCode booleans) |
| POST   | `/v2/account/mfa/authenticators/totp` | Create TOTP authenticator (secret + provisioning URI)           |
| PUT    | `/v2/account/mfa/authenticators/totp` | Verify/confirm TOTP authenticator via OTP                       |
| DELETE | `/v2/account/mfa/authenticators/totp` | Delete TOTP authenticator                                       |
| PATCH  | `/v2/account/mfa/recovery-codes`     | Generate recovery codes (first time only — 409 if they exist)   |
| PUT    | `/v2/account/mfa/recovery-codes`     | Regenerate/replace existing codes (404 if none exist)            |
| GET    | `/v2/account/mfa/recovery-codes`     | View remaining recovery codes                                    |
| POST   | `/v2/account/mfa/challenge`          | Create MFA challenge (email/phone/totp/recoveryCode)             |
| PUT    | `/v2/account/mfa/challenge`          | Confirm MFA challenge, adds the factor to the current session    |

`type` on authenticator routes is fixed to `totp` in the path (v1 accepts a
`:type` param validated `IsIn(['totp'])` — since TOTP is the only supported
value, v2 makes it literal instead of a single-value enum param).

Recovery codes: exactly 6 single-use 10-char codes generated per batch (v1
parity, `PATCH`/`PUT` semantics as in the table — same correction as
`docs/api/users.md`). TOTP: one authenticator per account; creating while an
unverified one exists replaces it; creating/verifying while a verified one
exists → `409 user_authenticator_already_verified`.

Challenge creation for `email`/`phone` factors requires that channel to be
verified (`401 user_email_not_verified` / `user_phone_not_verified`) and
enabled at the project level; sends a 6-digit numeric OTP with a 15-minute
expiry. `totp`/`recoveryCode` challenges create the challenge row but send
nothing (client already holds the generator/codes). Confirm body:
`{ challengeId, otp }`; on success the factor is appended to the current
session's `factors` and the challenge is deleted (one-time use).

**v2 fix — the MFA chicken-and-egg bug is closed.** v1's global
minimum-factors gate (`ApiInterceptor`) blocks *every* request — including
calls to the MFA challenge endpoints themselves — once
`session.factors.length < minimumFactors`, with no carve-out for the very
endpoints meant to satisfy that gate (the only escape hatch is an unused
`'mfa'` route-scope convention that nothing in the account module actually
declares). Concretely in v1, a user who logs in with MFA enabled cannot
call `POST/PUT /account/mfa/challenge` to complete the second factor,
because those calls are themselves blocked by the same "more factors
required" check. v2 explicitly exempts `POST/PUT /v2/account/mfa/challenge`
(and only those two routes) from the minimum-factors gate, so the
challenge flow is actually completable. This is a correctness fix, not a
new feature — the intent was clearly there in v1 (the unused `'mfa'` scope
convention), just never wired up.

---

## Endpoints — Recovery (`/v2/account/recovery`)

| Method | Path                     | Purpose                                  |
| ------ | -------------------------- | ------------------------------------------- |
| POST   | `/v2/account/recovery`    | Create password-recovery token, email it     |
| PUT    | `/v2/account/recovery`    | Confirm recovery (reset password)             |

Guest-accessible (v1 parity). Create body: `{ email, url }` (`url`
validated against allowed redirect hostnames). Blocked account →
`401 user_blocked`. Confirm body: `{ userId, secret, password }`.

**v2 fix**: v1 runs the password-history check on recovery-reset but *not*
the personal-data check (an inconsistency vs. `updatePassword`, which runs
both) — v2 runs both checks on every password set, recovery included.
**v2 fix, minor**: recovery confirm setting `emailVerification: true` as a
side effect is kept (v1 parity, and it's correct — only the account owner
could have received the recovery email).

Anti-enumeration: create-recovery does not reveal whether the email exists
(returns the same shape regardless — v1 parity, confirmed no branch leaks
existence via response shape, only via timing which is out of scope here).

---

## Endpoints — Sessions & Tokens (`/v2/account/sessions`, `/v2/account/tokens`)

| Method | Path                                   | Purpose                                          | Auth  |
| ------ | ----------------------------------------- | --------------------------------------------------- | ----- |
| GET    | `/v2/account/sessions`                    | List current user's sessions                          | SESSION\|JWT |
| DELETE | `/v2/account/sessions`                    | Delete all sessions (logout everywhere)               | SESSION\|JWT |
| GET    | `/v2/account/sessions/:sessionId`         | Get a session (`current` keyword supported)            | SESSION\|JWT |
| DELETE | `/v2/account/sessions/:sessionId`         | Delete one session                                     | SESSION\|JWT |
| PATCH  | `/v2/account/sessions/:sessionId`         | Refresh session (extend expiry; rotate OAuth2 token)   | SESSION\|JWT |
| POST   | `/v2/account/sessions/email`              | Create session via email + password                    | guest, gate `emailPassword` |
| POST   | `/v2/account/sessions/anonymous`          | Create anonymous session                                | guest, gate `anonymous` |
| POST   | `/v2/account/sessions/token`              | Exchange a secret (magic-url/email-otp/phone-otp/oauth2/generic) for a session | guest |
| GET    | `/v2/account/sessions/oauth2/:provider`   | Begin OAuth2 login (302 to provider)                    | guest |
| GET    | `/v2/account/sessions/oauth2/:provider/callback` | OAuth2 token exchange + session/account creation | guest |
| GET    | `/v2/account/tokens/oauth2/:provider`     | Begin OAuth2 login for a **token** (non-cookie) flow    | guest |
| POST   | `/v2/account/tokens/magic-url`            | Create magic-URL login token, email it                  | guest, gate `magicUrl` |
| POST   | `/v2/account/tokens/email`                | Create email-OTP login token                             | guest, gate `emailOtp` |
| POST   | `/v2/account/tokens/phone`                | Create phone-OTP login token, send SMS                   | guest, gate `phone` |
| POST   | `/v2/account/tokens/jwt`                  | **Mint a short-lived access token from the current session** | SESSION\|JWT |

**v2 simplification**: v1's OAuth2 flow has a callback endpoint that does
nothing but 302-redirect to a second "redirect" endpoint with the same
params, because v1's per-project routing needed the extra hop. v2's routing
is publishable-key-based, not path/subdomain-per-project, so the second hop
serves no purpose — v2 collapses `callback` and `redirect` into one
endpoint. No functional OAuth2 behavior changes; this is routing plumbing,
not protocol behavior. `POST` on the callback path is dropped too (v1 kept
it only in case a provider posts a form back instead of a query-string
redirect — if a real provider integration needs it during implementation,
it's re-added then, not sight-unseen here).

**v2 rename**: `POST /account/jwts` → `POST /v2/account/tokens/jwt`, grouped
with the other `tokens/*` endpoints for consistency (they're all "exchange
something for a shorter-lived credential"). Same behavior, default
duration 900s (15 min), caller may request 60–3600s.

### Session object

```json
{
  "$id": "sess_abc123",
  "userId": "user_001",
  "provider": "email",
  "current": true,
  "factors": ["email"],
  "ip": "203.0.113.4",
  "countryCode": "US",
  "countryName": "United States",
  "osName": "macOS",
  "clientName": "Chrome",
  "clientVersion": "128.0",
  "deviceName": "Desktop",
  "expire": "2027-08-26T10:00:00.000Z",
  "mfaUpdatedAt": null,
  "$createdAt": "2026-08-26T10:00:00.000Z",
  "$updatedAt": "2026-08-26T10:00:00.000Z"
}
```

**Field visibility rule (corrected — matches v1's actual `class-transformer`
`groups: ['admin']` mechanism, not the stricter rule an earlier draft of
this contract proposed):**

- `secret` — included in the response of whichever call **creates** the
  session or token (self-service login, or an admin/API key minting one on
  a user's behalf via `docs/api/users.md`), since that's the only channel
  the caller has to receive their own credential (v1 additionally sets it
  as an httpOnly cookie for browser clients at creation time — v2 has no
  cookie mechanism, so the one-time JSON return is the sole delivery path;
  this is a real, deliberate deviation, not a detail v1 already does this
  way). On every subsequent `list`/`get` of an *existing* session or token,
  `secret` is included **only for privileged (admin/API key) callers** —
  exactly like v1's `@Expose({ groups: ['admin'] })` on `SessionModel`/
  `TokenModel`. A non-privileged caller re-listing their own sessions never
  sees it again (they already have it from creation); an admin/API key
  inspecting a user's sessions does, same as v1.
- **OAuth2 provider token fields** (`providerAccessToken`,
  `providerAccessTokenExpiry`, `providerRefreshToken`) — **correction**: an
  earlier draft of this contract said v2 hides these entirely. That would
  have been a real feature reduction: v1's `SessionModel`/`IdentityModel`
  expose these fields with **no** `groups` restriction at all — every
  caller, including the session/identity owner themselves via
  self-service `GET /account/sessions`/`GET /account/identities`, can read
  their own linked provider's access/refresh token (useful for apps that
  call the upstream provider's API directly using the same token). v2
  restores full parity here: these fields are visible to the resource
  owner, not just admin/API-key callers.

This privilege-aware field-visibility mechanism (an explicit "admin can see
more" rule, not a blanket strip) is the general pattern for every
admin/self-service pair of endpoints in this document and in
`docs/api/users.md` — see also `hash`/`hashOptions` visibility in
`users.md`'s User object.

### `POST /v2/account/sessions/email`

Body: `{ email, password }`. Redundant/duplicate failed-login lockout (v1
parity): 5 failed attempts within 10 minutes locks the account for 15
minutes, keyed by email, independent of route-level rate limiting.
Transparently re-hashes the stored password to the current default algo on
successful login if it was stored under a legacy scheme (n/a for new v2
installs per D29, but the re-hash-on-login mechanism itself stays since a
project's users can still be created via the argon2/bcrypt pre-hash import
endpoints in `docs/api/users.md`, which may import from a different cost
setting than the project's current default). Wrong credentials →
`401 user_invalid_credentials`. Blocked account → `401 user_blocked`.

### `POST /v2/account/sessions/token` and the `tokens/*` create endpoints

Magic-URL/email-OTP/phone-OTP all share: look up an existing user by
email/phone; if none exists, **create a new unverified user** (v1 parity —
these endpoints double as signup+login; subject to `user_count_exceeded`).
Optional `phrase: true` returns a human-readable phrase embedded in both
the message and the API response, letting the client display it for a
phishing/MITM sanity check (v1 parity). Consuming the secret via
`POST sessions/token` marks the corresponding channel verified as a side
effect (v1 parity — proof of receipt implies ownership) and deduces the
new session's initial `factors` from the token type.

### `POST /v2/account/sessions/anonymous`

**v2 improvement**: v1 has no rule preventing an already-authenticated
caller from creating an anonymous session on top of their real one. v2
requires the caller be a guest — an authenticated caller gets
`409 user_already_exists` style rejection (`400 general_bad_request`) rather
than silently minting an orphan anonymous session alongside a real login.

### `GET/PATCH/DELETE /v2/account/sessions/:sessionId`

`:sessionId` accepts the literal `current` (v1 parity). **v2 improvement —
concurrent session cap**: `project.limits.userSessionsMax` (default 10, cap
100) is now actually enforced (v1 defines these config values but never
checks them anywhere). Creating a session beyond the cap evicts the
**oldest** session for that user (LRU, same pattern as
`packages/core/src/tenants/pool.ts`'s `TenantResourcePool`) rather than
rejecting the login outright — preserves the "just works" UX while
bounding unbounded session growth.

`PATCH` (refresh) extends `expire` and, for OAuth2-provider sessions,
refreshes the provider's access token. **v2 fix**: v1 has a bug here — it
overwrites *both* `providerAccessToken` and `providerRefreshToken` with the
new access token (the real refresh token is silently dropped and never
updated). v2 fixes this to update only the access token field and rotate
the refresh token correctly when the provider returns one.

---

## Endpoints — Targets (`/v2/account/targets`)

| Method | Path                              | Purpose                    |
| ------ | ----------------------------------- | ----------------------------- |
| POST   | `/v2/account/targets/push`          | Register a push target for the current session |
| PUT    | `/v2/account/targets/:targetId/push`| Update a push target's identifier                |
| DELETE | `/v2/account/targets/:targetId/push`| Delete a push target                             |

Session-only auth (v1 parity — JWT is not accepted here, since a push
target is tied to a specific device/session, and a bare JWT carries no
useful device binding beyond what the session already provides). Body:
`{ targetId?, identifier, providerId? }` — `name` is auto-derived from the
session's detected device brand/model (v1 parity, not caller-supplied,
unlike the admin targets endpoint in `docs/api/users.md` where `name` is a
required body field since there's no "current session" to derive it from).

---

## Error codes

All errors are `AppError` subclasses per `_conventions.md` §3. Every code
below is verified against what legacy actually throws (not assumed):

| Status | Code | Trigger |
| ------ | ---- | ------- |
| 400 | `general_bad_request` | Identity/email conflicts requiring a generic (non-enumerating) response |
| 422 | (validation) | malformed body/query — framework-native |
| 503 | `general_smtp_disabled` | SMTP not configured for email verification/recovery/magic-url/email-OTP/email-MFA-challenge |
| 503 | `general_phone_disabled` | SMS not configured for phone verification/phone-OTP/phone-MFA-challenge |
| 429 | `general_rate_limit_exceeded` | email/password login lockout (5 failures / 10 min → 15 min lock) |
| 404 | `user_not_found` | account/session/recovery/verification target missing |
| 400 | `user_count_exceeded` | project user-count limit reached |
| 409 | `user_already_exists` | duplicate account, or OAuth2 identity/email tied to a different account during session-upgrade linking |
| 409 | `user_email_already_exists` | duplicate email (create, update-email, magic-url/email-otp signup) |
| 409 | `user_phone_already_exists` | duplicate phone |
| 401 | `user_blocked` | blocked account used for login, recovery, or self-delete |
| 401 | `user_invalid_credentials` | wrong password |
| 401 | `user_invalid_token` | expired/invalid/reused verification, recovery, magic-url, email-otp, phone-otp, or generic token |
| 400 | `user_password_recently_used` | password matches `passwordHistory` |
| 400 | `user_password_personal_data` | password contains id/email/name/phone |
| 404 | `user_session_not_found` | unknown session id, or JWT minting with no resolvable session |
| 404 | `user_identity_not_found` | unknown identity, or one not owned by the caller (v2 fix) |
| 401 | `user_unauthorized` | OAuth2 provider returned no email and there's no session to match against |
| 501 | `user_auth_method_unsupported` | the specific auth method is disabled at the project level |
| 409 | `user_target_already_exists` | duplicate target identifier |
| 404 | `user_target_not_found` | target missing or not owned by caller |
| 400 | `user_phone_not_found` | phone verification/challenge with no phone set |
| 401 | `user_phone_not_verified` | phone MFA challenge with unverified phone |
| 409 | `user_phone_already_verified` | re-verifying an already-verified phone |
| 400 | `user_email_not_found` | email MFA challenge with no email set |
| 401 | `user_email_not_verified` | email MFA challenge with unverified email |
| 409 | `user_email_already_verified` | re-verifying an already-verified email |
| 404 | `user_authenticator_not_found` | unknown TOTP authenticator |
| 409 | `user_authenticator_already_verified` | authenticator already verified |
| 409 | `user_recovery_codes_already_exists` | generating codes when some exist |
| 404 | `user_recovery_codes_not_found` | reading/regenerating when none exist |
| 401 | `user_more_factors_required` | MFA gate — insufficient factors on the current session (challenge endpoints exempted, v2 fix) |
| 424 | `user_oauth2_provider_error` | provider error, missing code, or token exchange failure |
| 412 | `project_provider_disabled` | OAuth2 provider disabled/misconfigured at the project level |
| 400 | `project_provider_unsupported` | provider not in the project's configured list |
| 400 | `project_invalid_success_url` / `project_invalid_failure_url` | OAuth2 redirect URL fails the allow-list |

---

## v1 → v2 deviations (summary)

See inline call-outs above for full detail; summarized here for review:

1. **D23 resolved**: session (long-lived, DB) + JWT access token (minted
   via `tokens/jwt`) are formalized as refresh/access-token pair.
2. **Session header simplified**: raw secret + hash-index lookup, no
   AES-GCM cookie encoding.
3. **Self-service account deletion added** (new — v1's `DELETE /account`
   is admin-only).
4. **`PATCH prefs` and password-change session revocation**: same
   corrections/improvements as `docs/api/users.md`.
5. **Identity delete ownership check added** (v1 has none).
6. **MFA challenge chicken-and-egg bug fixed** (explicit gate carve-out).
7. **Recovery now also runs the personal-data check** (v1 only runs
   password-history on recovery).
8. **OAuth2 callback/redirect collapsed to one hop** (routing simplification).
9. **Secret field visibility matches v1's actual privilege-gated rule**:
   returned once on creation to whoever created it, then admin/API-key-only
   on subsequent reads. OAuth2 provider tokens stay visible to the
   resource owner too, same as v1 (an earlier draft of this contract
   proposed hiding them entirely, which would have been a feature
   reduction — corrected).
10. **Concurrent session cap actually enforced** (LRU eviction, v1 defines
    but never checks it).
11. **OAuth2 refresh-token rotation bug fixed** (v1 overwrites the wrong
    field on session refresh).
12. **Anonymous session creation requires guest** (v1 allows stacking on
    an authenticated caller).
13. **Legacy-hash creation paths dropped entirely** (D29 — unrelated to
    this module directly, but account creation shares the password path
    with `docs/api/users.md`).

## Implementation notes

- Shares the `users`/`sessions`/`tokens`/`authenticators`/`challenges`/
  `identities`/`targets` collection family with `docs/api/users.md` — one
  schema, two API surfaces over it. Implement the data-access layer once,
  shared by both modules' services.
- Password hashing, token hashing, and the personal-data/history validators
  are single-source-of-truth helpers shared by every write path in this
  document and in `users.md` — do not reimplement per endpoint.
- OAuth2 provider integrations (Google/Apple/etc.) are themselves a
  separate, per-provider implementation slice — this contract fixes the
  *shape* of the flow (begin/callback, linking rules, anti-hijack rule
  below) independent of which providers ship first.
- **Anti-hijack rule preserved (v1 parity)**: if an OAuth2 email matches an
  `identities.providerEmail` already tied to a *different* provider,
  linking is refused with a generic `400 general_bad_request` (not
  `user_already_exists`) — deliberately non-specific to avoid confirming
  which case applies to an unauthenticated caller.
- Smoke cases without a live DB: guest 403/401s on session-protected
  routes, 422 validation shapes, guest-accessible routes reachable without
  credentials.

## Open questions for review

1. **Self-service account deletion** (new capability, §Account core) —
   confirm this should ship, and confirm it should hard-delete rather than
   soft-delete/deactivate.
2. **Concurrent session cap + LRU eviction** (new enforcement) — confirm
   the default (10) and cap (100) carried over from v1's unused config are
   still the right numbers now that they're actually enforced.
3. **OAuth2 callback/redirect single-hop simplification** — confirm no
   provider integration needs the two-hop hand-off v1 had.
4. **Password-change session revocation** (shared with `users.md`) —
   confirm this is desired; it's the single largest behavior change in
   this document from a client's point of view.
