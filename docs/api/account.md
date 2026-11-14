# v2 Contract — Account (End-User Auth)

> Status: IMPLEMENTED — `apps/server/src/account/route.ts` (+ `profile/`,
> `sessions/`, `tokens/`, `identities/`, `targets/`, `mfa/`, `recovery/`,
> `oauth2/`), auth gate in `apps/server/src/account/auth.ts`, shared
> formatters in `apps/server/src/{account,users}/formatter.ts`
> Depends on: `_conventions.md` (D19, D26–D28), `_i18n.md`, D5 (password
> hashing), D6 (JWT), D23 (token-ready auth model), D29 (legacy compat
> dropped), `@nuvix/db`
> Old code (reference only): root `apps/server/src/account/**`
> Sibling contract: `docs/api/users.md` (admin-facing surface over the same
> data — session/identity object shapes are shared)

This is the end-user-facing auth surface: signup/login, session lifecycle,
email/phone verification, password recovery, MFA, OAuth2, and push targets.
It is the highest-risk module in the rewrite (`MIGRATION.md` Phase 4). This
document was drafted from a line-by-line read of legacy `account/**` and
has since been reconciled against the implemented v2 code — every endpoint,
business rule, and error code below is verified against the implementation;
where earlier drafts and the code diverge, the code won and "Known gaps"
records what did not ship.

## D23, resolved: the session/token model

D23 deferred a final call between "DB sessions" and "short-lived access +
refresh tokens (Clerk-style)" to this gate. **Resolution: both, and they're
the same mechanism v1 already has, just formalized as primary/secondary
instead of primary/side-feature:**

- **Session** = the long-lived, DB-backed, revocable credential (v1's
  `sessions` collection, unchanged in spirit). The plaintext secret is
  computed at creation time and presented thereafter via the
  `x-nuvix-session` header. This _is_ the refresh token in Clerk's model —
  it's what proves "this device is still logged in" and what mints new
  access tokens. **Caveat (gap):** v2 session-create routes currently
  return the masked session view only — the plaintext session secret is
  dropped instead of being returned once to the caller (see Known gaps);
  token-creation endpoints do return their secret.
- **Access token** = a short-lived JWT (fixed 15 min) minted from a valid
  session via `POST /v2/account/tokens/jwts` (v1's `/account/jwts`, moved
  under `tokens/*` for consistency). Carries `sub` (user id)
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

| Setting                      | Default                                    | Used by                                                                              |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `auths.emailPassword`        | `true`                                     | `POST /account`, `POST /account/sessions/email`                                      |
| `auths.anonymous`            | `true`                                     | `POST /account/sessions/anonymous`                                                   |
| `auths.magicUrl`             | `true`                                     | `POST /account/tokens/magic-url`                                                     |
| `auths.emailOtp`             | `true`                                     | `POST /account/tokens/email`                                                         |
| `auths.phone`                | `false` (needs an SMS provider configured) | `POST /account/tokens/phone`                                                         |
| `auths.invites`              | `true`                                     | `docs/api/teams.md` invite creation                                                  |
| `auths.duration`             | `31536000` (1 year)                        | session `expire`                                                                     |
| `auths.limit`                | `0` (unlimited)                            | `user_count_exceeded` gate                                                           |
| `auths.passwordHistory`      | `0` (disabled)                             | password-reuse check                                                                 |
| `auths.personalDataCheck`    | `false`                                    | personal-data-in-password check                                                      |
| `auths.sessionAlerts`        | `false`                                    | new-session email notice                                                             |
| `auths.mockNumbers`          | `[]`                                       | QA phone-OTP bypass                                                                  |
| `limits.userSessionsMax`     | `100`                                      | hard cap, v2 now enforces (see Sessions section)                                     |
| `limits.userSessionsDefault` | `10`                                       | soft/expected cap before LRU eviction kicks in                                       |
| `limits.arrayParamsSize`     | `100`                                      | max array length for `roles`/`labels`/etc. across this doc and `teams.md`/`users.md` |

A disabled gate fails with `501 user_auth_method_unsupported`, exactly as
in v1. The per-project settings themselves are configurable from the
platform (`docs/api/platform.md`'s auth-settings endpoints, Phase 7), but
the **server-side enforcement of these gates/limits is not wired yet** —
services currently run with the compiled-in defaults above and no gate
checks (see Known gaps).

---

## Auth posture

Every route requires a project (`x-nuvix-publishable-key`) resolved by the
shared context chain; the caller is then resolved from session/JWT/API-key
(`context/auth.ts` — console-audience JWTs are treated as guest, i.e.
rejected on the tenant surface). Endpoint requirements below: most
self-service endpoints call `requireAuth` (any resolved user —
`401 user_unauthorized` otherwise); session/token _creation_ endpoints are
guest-accessible. The v1-style per-endpoint session-type gates
(`AllowSessionType`, scopes) are not implemented — see Known gaps.

---

## Endpoints — Account core (`/v2/account`)

| Method | Path                   | Purpose                                      | Auth         | Gate                  |
| ------ | ---------------------- | -------------------------------------------- | ------------ | --------------------- |
| POST   | `/v2/account`          | Create account (email + password)            | guest        | `auths.emailPassword` |
| GET    | `/v2/account`          | Get current account                          | SESSION\|JWT | —                     |
| DELETE | `/v2/account`          | Delete own account                           | SESSION\|JWT | —                     |
| GET    | `/v2/account/prefs`    | Get prefs                                    | SESSION\|JWT | —                     |
| PATCH  | `/v2/account/prefs`    | Merge prefs                                  | SESSION\|JWT | —                     |
| PATCH  | `/v2/account/name`     | Update name                                  | SESSION\|JWT | —                     |
| PATCH  | `/v2/account/password` | Update password                              | SESSION\|JWT | —                     |
| PATCH  | `/v2/account/email`    | Update email                                 | SESSION\|JWT | —                     |
| PATCH  | `/v2/account/phone`    | Update phone                                 | SESSION\|JWT | —                     |
| PATCH  | `/v2/account/status`   | Block own account + clear session credential | SESSION\|JWT | —                     |

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
    {
      "$id": "target_1",
      "name": "Ada's iPhone",
      "providerType": "push",
      "identifier": "expo-token-…"
    }
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
create-id convention (D28). Password is checked against the personal-data
rule. An email already tied to an OAuth identity → `400
general_bad_request` (anti-enumeration); a duplicate account
email/userId → `409 user_already_exists`. The per-project user-count limit
is not enforced on this path (see Known gaps).

### `DELETE /v2/account` — self-service delete

Implemented self-service deletion (v1's `DELETE /account` was admin-only):
deletes the calling user's document and returns `{ status: 'ok' }`.
Refuses on a blocked account (`401 user_blocked`). Note: the cascade to
sessions/tokens/targets/memberships/identities described in earlier drafts
is **not** implemented — only the user document is deleted today (see
Known gaps; the admin path in `docs/api/users.md` does cascade).

### `PATCH /v2/account/prefs`

Body: `{ prefs }`. **Replaces** the whole prefs object (the "real shallow
merge" proposed in earlier drafts was not implemented — same as
`docs/api/users.md`).

### `PATCH /v2/account/password`

Body: `{ password, oldPassword? }`. Verifies `oldPassword` unless the
account has never had one set (`passwordUpdate === null` — OAuth2/
anonymous/magic-url/phone-only accounts). Enforces the personal-data and
password-history checks. Re-hashes with the current default algo/params
and keeps a 10-entry history. Wrong `oldPassword` →
`401 user_invalid_credentials`. Session revocation on password change is
**not** implemented (see Known gaps).

### `PATCH /v2/account/email` / `/phone`

Body: `{ email, password? }` / `{ phone, password? }`. Same
skip-if-never-set-password rule as above. Resets the corresponding
verification flag to `false` and renames (or creates) the matching
`targets` document for that channel (v1 parity — compound operation, not a
plain field setter; see `docs/api/users.md`'s implementation notes for the
exact target-sync rule, shared logic). Duplicate → `409
user_email_already_exists` / `409 user_phone_already_exists`; an email
tied to a different user's OAuth identity → `400 general_bad_request`.

### `PATCH /v2/account/status`

No body. Sets `status: false` (self-block) and revokes the calling
session's credential. **Correction**: there is no "reactivate" endpoint in
v1 and v2 doesn't add one either — reactivation is an admin action via
`docs/api/users.md`'s `PATCH /v2/users/:userId/status`.

---

## Endpoints — Verification (`/v2/account/verifications`)

| Method | Path                              | Purpose                               |
| ------ | --------------------------------- | ------------------------------------- |
| POST   | `/v2/account/verifications/email` | Create email verification token       |
| PUT    | `/v2/account/verifications/email` | Confirm email verification            |
| POST   | `/v2/account/verifications/phone` | Create phone verification token (OTP) |
| PUT    | `/v2/account/verifications/phone` | Confirm phone verification            |

**Path note**: both the singular legacy form and the plural form exist as
aliases in v2 — `POST|PUT /account/verification[/phone]` and
`POST|PUT /account/verifications/email[/phone]` hit the same handlers.

Create requires SMTP configured for the email channel
(`503 general_smtp_disabled` — checked before any state change) and the
channel not already verified (`409 user_email_already_verified` /
`user_phone_already_verified`); phone verification additionally requires a
phone already set (`400 user_phone_not_found`) — there is no SMS-provider
gate on the phone path. **v2 now actually sends the
verification email** (localized inner template + redirect URL carrying
`userId`/`secret`/`expire`; `url` falls back to the request origin per v1's
`url ??= protocol://host`). v1 rendered `email-verification.tpl`, which does
not exist in assets — a latent crash — so v2 renders the generic
`email-inner-base.tpl`, whose variables match exactly. Confirm body:
`{ userId, secret }`; verifies the secret hash, consumes the token
(one-time use — deleted after success, v1 parity), sets the flag `true`.
Invalid/expired/reused secret → `401 user_invalid_token`.

---

## Endpoints — Identities (`/v2/account/identities`)

| Method | Path                                 | Purpose                                       |
| ------ | ------------------------------------ | --------------------------------------------- |
| GET    | `/v2/account/identities`             | List OAuth2 identities linked to current user |
| DELETE | `/v2/account/identities/:identityId` | Unlink an identity                            |

**v2 improvement**: v1's delete has no ownership check against the caller
(any authenticated user could pass any `identityId` — confirmed by reading
`IdentityController`/`IdentityService`, there is no `userId` comparison
before delete). v2 adds one: deleting an identity that doesn't belong to
the caller → `404 user_identity_not_found` (same code as "doesn't exist" —
deliberately not `403`, to avoid confirming existence of someone else's
identity).

---

## Endpoints — MFA (`/v2/account/mfa`)

| Method | Path                                   | Purpose                                                         |
| ------ | -------------------------------------- | --------------------------------------------------------------- |
| PATCH  | `/v2/account/mfa`                      | Enable/disable MFA                                              |
| GET    | `/v2/account/mfa/factors`              | List available factors (totp/email/phone/recoveryCode booleans) |
| POST   | `/v2/account/mfa/authenticators/:type` | Enroll authenticator (secret + provisioning URI)                |
| PUT    | `/v2/account/mfa/authenticators/:type` | Verify/confirm authenticator via OTP                            |
| DELETE | `/v2/account/mfa/authenticators/:type` | Delete authenticator                                            |
| POST   | `/v2/account/mfa/recovery-codes`       | Generate recovery codes (overwrites any existing set)           |
| PATCH  | `/v2/account/mfa/recovery-codes`       | Regenerate recovery codes (same effect as POST)                 |
| GET    | `/v2/account/mfa/recovery-codes`       | View remaining recovery codes                                   |
| POST   | `/v2/account/mfa/challenge`            | Create MFA challenge (totp/recovery-code/email/phone)           |
| PUT    | `/v2/account/mfa/challenge`            | Confirm MFA challenge, adds the factor to the current session   |

`:type` is a validated parameter — only `totp` is accepted; anything else
→ `400 mfa_type_unsupported`.

Recovery codes: exactly 6 single-use 10-char codes per batch. `POST`
generates (overwriting any existing set — no conflict error),
`PATCH` regenerates (identical behavior), `GET` returns
`404 user_recovery_codes_not_found` when none exist.

TOTP: one authenticator per account. Enrolling while one exists (verified
or not) **resets** it (new secret, `verified: false`); there is no
already-verified conflict error. Verification adds the `totp` factor to
the current session; wrong OTP → `400 user_invalid_token`.

Challenges: creation persists a challenge row for the requested `factor`
and returns `{ challengeId, factor }` — **no OTP is dispatched** for
email/phone factors and no channel state is checked (see Known gaps).
Confirm body: `{ challengeId, otp }`; unknown challenge →
`404 challenge_not_found`. `totp` and `recoveryCode` challenges verify the
OTP/codes (`400 user_invalid_token` on mismatch, recovery codes are
consumed on use); email/phone challenges currently accept the OTP as-is
and add the factor. On success the factor is appended to the current
session's `factors` and the challenge is deleted (one-time use).

**Minimum-factors gate:** v2 has no global minimum-factors gate on this
module (v1's `ApiInterceptor` gate was not ported), so the v1
chicken-and-egg bug — the gate blocking the challenge endpoints themselves
— does not exist here by construction. No exemption carve-out is needed.

---

## Endpoints — Recovery (`/v2/account/recovery`)

| Method | Path                   | Purpose                                  |
| ------ | ---------------------- | ---------------------------------------- |
| POST   | `/v2/account/recovery` | Create password-recovery token, email it |
| PUT    | `/v2/account/recovery` | Confirm recovery (reset password)        |

Guest-accessible (v1 parity). Create body: `{ email, url }` (`url` is
**required** — v1 `CreateRecoveryDTO` marks it `@IsNotEmpty @IsUrl`; v2's
earlier optional shape was contract drift — and is validated against the
project's allowed redirect hostnames/schemes). Blocked account →
`401 user_blocked`. Confirm body: `{ userId, secret, password }`.

**Mail pipeline (v2 slice)**: the create flow mints the token, appends
`userId`/`secret`/`expire` to `url` and enqueues the recovery email
(localized `email-inner-base.tpl` content wrapped in
`email-base-styled.tpl`). Missing/off SMTP → `503 general_smtp_disabled`
(v1 parity, checked before any state change on the v1 flow; v2 checks after
minting but before responding — the token materializes only on a 200).

**v2 fix**: v1 runs the password-history check on recovery-reset but _not_
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

| Method | Path                                             | Purpose                                                                             | Auth                        |
| ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------- |
| GET    | `/v2/account/sessions`                           | List current user's sessions                                                        | SESSION\|JWT                |
| DELETE | `/v2/account/sessions`                           | Delete all sessions (logout everywhere)                                             | SESSION\|JWT                |
| GET    | `/v2/account/sessions/:sessionId`                | Get a session (`current` keyword supported)                                         | SESSION\|JWT                |
| DELETE | `/v2/account/sessions/:sessionId`                | Delete one session                                                                  | SESSION\|JWT                |
| PATCH  | `/v2/account/sessions/:sessionId`                | Refresh session (extend expiry; rotate OAuth2 token)                                | SESSION\|JWT                |
| POST   | `/v2/account/sessions/email`                     | Create session via email + password                                                 | guest, gate `emailPassword` |
| POST   | `/v2/account/sessions`                           | Alias of `/sessions/email` (v1 parity)                                              | guest                       |
| POST   | `/v2/account/sessions/anonymous`                 | Create anonymous session                                                            | guest, gate `anonymous`     |
| POST   | `/v2/account/sessions/token`                     | Exchange a secret (magic-url/email-otp/phone-otp/oauth2/generic) for a session      | guest                       |
| PUT    | `/v2/account/sessions/magic-url`                 | Complete magic-URL login (v1 parity alias of `/sessions/token`)                     | guest                       |
| PUT    | `/v2/account/sessions/phone`                     | Complete phone-OTP login (v1 parity alias of `/sessions/token`)                     | guest                       |
| POST   | `/v2/account/sessions/phone`                     | Create phone-OTP login token (v1 parity alias of `/tokens/phone`)                   | guest, gate `phone`         |
| GET    | `/v2/account/sessions/oauth2/:provider`          | Begin OAuth2 login (302 to provider)                                                | guest                       |
| GET    | `/v2/account/sessions/oauth2/:provider/callback` | OAuth2 token exchange + session/account creation                                    | guest                       |
| POST   | `/v2/account/sessions/oauth2/:provider/callback` | OAuth2 callback, form-encoded variant (Apple `response_mode=form_post`)             | guest                       |
| GET    | `/v2/account/tokens/oauth2/:provider`            | Begin OAuth2 login for a **token** (non-cookie) flow                                | guest                       |
| POST   | `/v2/account/tokens/magic-url`                   | Create magic-URL login token, email it (optional `phrase` security phrase)          | guest, gate `magicUrl`      |
| POST   | `/v2/account/tokens/email`                       | Create email-OTP login token, email the 6-digit code                                | guest, gate `emailOtp`      |
| POST   | `/v2/account/tokens/phone`                       | Create phone-OTP login token, send SMS                                              | guest, gate `phone`         |
| POST   | `/v2/account/tokens/jwts`                        | **Mint a short-lived access token from the current session** (alias: `/tokens/jwt`) | SESSION\|JWT                |

**v2 simplification**: v1's OAuth2 flow has a callback endpoint that does
nothing but 302-redirect to a second "redirect" endpoint with the same
params, because v1's per-project routing needed the extra hop. v2's routing
is publishable-key-based, not path/subdomain-per-project, so the second hop
serves no purpose — v2 collapses `callback` and `redirect` into one
endpoint. No functional OAuth2 behavior changes; this is routing plumbing,
not protocol behavior. The contract anticipated re-adding `POST` on the
callback path "if a real provider integration needs it" — **it did**: Apple
uses `response_mode=form_post`, so `POST /sessions/oauth2/:provider/callback`
is implemented (query params and form body are merged, body wins).

**v2 fix (v1 bug — default relay URLs failed validation)**: v1 validated the
`state.success` URL against registered client platforms on the callback even
when that URL was its own hosted relay page (`/auth/oauth2/success`) — which
fails whenever the API host itself is not a registered _client_ platform.
v2 exempts its own relay pages from the platform allow-list (custom
success/failure URLs are still strictly validated against the project's
platforms, as in v1).

**Cookie + relay pages (v2 implementation note — supersedes the "no cookie
mechanism" note below)**: the OAuth2 session flow sets the httpOnly session
cookie (`nx_<NUVIX_COOKIE_NAME>`, domain/same-site/secure from
`NUVIX_COOKIE_*` env) on the success redirect — the tenant context chain
already parsed `nx_session`/`nc_session` cookies, so browser flows work
without ever reading the JSON body. When no custom success URL is given, the
browser lands on v2's own relay pages (unversioned, v1 parity):
`GET /auth/oauth2/success` (postMessage `oauth-success` + auto-close) and
`GET /auth/oauth2/failure` (renders the provider error). On the default
success page v2 also appends `domain`/`key`/`secret` query params (v1
parity) so the opener window can relay the credential cross-origin. The
one-time JSON `secret` return (documented below) remains for non-browser
clients.

**v2 rename**: `POST /account/jwts` → `POST /v2/account/tokens/jwts`
(alias `/tokens/jwt`), grouped with the other `tokens/*` endpoints. Fixed
900s (15 min) validity; `400 jwt_disabled` when no JWT secret is
configured.

### Magic-URL / email-OTP tokens — mail pipeline (v2 slice)

Both flows now send their emails through the mails worker (v1
`MailsQueue` parity): localized `email-magic-url.tpl` /
`email-otp.tpl` layouts, wrapper variables `{direction, user, project,
redirect|otp}`. Redirects validate against project platforms; the magic-URL
`url` falls back to `${origin}/auth/magic-url` (v1's
`magicAuthDefaultPath`).

- **`phrase` (v1 parity, restored)**: `POST /tokens/magic-url` accepts
  `phrase: true`; the response then carries `phrase` (word-combo +
  4-char suffix) and the email renders the `securityPhrase` block.
  Ported from v1 `PhraseGenerator` (`@nuvix/utils/phrase`).
- **v2 fix (v1 bug — empty links)**: v1 rendered inner templates with only
  `withData`, but inner layouts reference `{{redirect}}`/`{{user}}`, which
  live in `withVariables` — recovery/verification/magic emails shipped with
  empty `<a href>`. v2 merges variables into the inner render (data wins).

Tokens of type `1` no longer appear: v2's profile service used raw `type: 1`
literals for verification tokens; the legacy enum defines
`VERIFICATION = 2` — v2 now uses `TokenType.VERIFICATION` everywhere.

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

**Field visibility rule (as implemented — v2 uses explicit response views,
not v1's `class-transformer` `groups: ['admin']` mechanism):**

- `secret` — **always masked (`''`) in v2 session views**, on creation and
  on every read alike (v1's privilege-gated `groups: ['admin']` exposure
  was not ported, and no session-create response delivers the plaintext
  secret — see Known gaps). Token creation responses (verification/
  recovery/magic-url/email-otp/phone-otp) are the one-time delivery
  channel for their own plaintext secrets — those are returned on the
  token view (`formatted.secret`), not on sessions. Browser-facing OAuth2
  flows do set the httpOnly session cookie on the success redirect (see
  the OAuth2 section above).
- **OAuth2 provider token fields** (`providerAccessToken`,
  `providerAccessTokenExpiry`, `providerRefreshToken`) — visible to every
  caller, including the session/identity owner via self-service
  `GET /account/sessions`/`GET /account/identities` (v1 parity — useful
  for apps that call the upstream provider's API directly with the same
  token).

### `POST /v2/account/sessions/email`

Body: `{ email, password }`. Wrong credentials →
`401 user_invalid_credentials`. Blocked account → `401 user_blocked`
(checked after password verification). Transparently re-hashes the stored
password to the current default algo on successful login if it was stored
under a legacy scheme (n/a for new v2 installs per D29, but the
re-hash-on-login mechanism itself stays since a project's users can still
be created via `docs/api/users.md`, which may hash with a different
algorithm than the project's current default). The failed-attempt lockout
(5 failures / 10 min → 15 min lock, `general_rate_limit_exceeded`)
described in earlier drafts is **not** implemented — see Known gaps.

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

Creates a fresh anonymous user + session (`provider: 'anonymous'`) on every
call. The guest-only requirement proposed in earlier drafts (rejecting an
already-authenticated caller with `400 general_bad_request`) is **not**
implemented — see Known gaps.

### `GET/PATCH/DELETE /v2/account/sessions/:sessionId`

`:sessionId` accepts the literal `current` (v1 parity). `PATCH` (refresh)
extends `expire` and, for OAuth2-provider sessions, refreshes the
provider's access token. **v2 fix**: v1 has a bug here — it
overwrites _both_ `providerAccessToken` and `providerRefreshToken` with the
new access token (the real refresh token is silently dropped and never
updated). v2 fixes this to update only the access token field and rotate
the refresh token correctly when the provider returns one. The concurrent
session cap / LRU eviction proposed for v2 is **not** implemented (see
Known gaps).

---

## Endpoints — Targets (`/v2/account/targets`)

| Method | Path                                 | Purpose                                        |
| ------ | ------------------------------------ | ---------------------------------------------- |
| POST   | `/v2/account/targets/push`           | Register a push target for the current session |
| PUT    | `/v2/account/targets/:targetId/push` | Update a push target's identifier/name         |
| DELETE | `/v2/account/targets/:targetId/push` | Delete a push target                           |

Any authenticated caller (`requireAuth`); the target is bound to the
calling session's id when one is resolved. Body (create):
`{ targetId?, identifier, providerId?, name? }` — `name` is optional and
defaults to `''` (no device-brand derivation). Update body:
`{ identifier?, name? }`; updating `identifier` also clears the `expired`
flag. Duplicate target id → `409 user_target_already_exists`; unknown or
not-owned target → `404 user_target_not_found`.

---

## Error codes

All errors are `AppError` subclasses per `_conventions.md` §3. Every code
below is verified against the v2 services (not assumed):

| Status | Code                                                          | Trigger                                                                                                                  |
| ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 400    | `general_bad_request`                                         | anti-enumeration conflicts: create/update-email colliding with an OAuth identity, invalid redirect URLs                  |
| 422    | (validation)                                                  | malformed body/query — framework-native                                                                                  |
| 503    | `general_smtp_disabled`                                       | SMTP not configured for email verification/recovery/magic-url/email-OTP                                                  |
| 404    | `user_not_found`                                              | account/session/recovery/verification target missing                                                                     |
| 409    | `user_already_exists`                                         | duplicate account email/userId at create, or OAuth2 identity/email tied to a different account during linking            |
| 409    | `user_email_already_exists`                                   | duplicate email on update                                                                                                |
| 409    | `user_phone_already_exists`                                   | duplicate phone on update                                                                                                |
| 401    | `user_blocked`                                                | blocked account used for login, recovery, or self-delete                                                                 |
| 401    | `user_invalid_credentials`                                    | wrong password / missing oldPassword when required                                                                       |
| 401    | `user_invalid_token`                                          | expired/invalid/reused verification, recovery, magic-url, email-otp, phone-otp, or generic token; bad TOTP/recovery-code |
| 400    | `user_password_recently_used`                                 | password matches `passwordHistory`                                                                                       |
| 400    | `user_password_personal_data`                                 | password contains id/email/name/phone                                                                                    |
| 404    | `user_session_not_found`                                      | unknown session id, or `current` with no session                                                                         |
| 404    | `user_identity_not_found`                                     | unknown identity, or one not owned by the caller                                                                         |
| 401    | `user_unauthorized`                                           | no authenticated user resolved by the auth chain (route-level `requireAuth`)                                             |
| 400    | `user_missing_id`                                             | OAuth2 provider returned no user ID on the callback                                                                      |
| 400    | `user_phone_not_found`                                        | phone verification with no phone set                                                                                     |
| 409    | `user_phone_already_verified`                                 | re-verifying an already-verified phone                                                                                   |
| 409    | `user_email_already_verified`                                 | re-verifying an already-verified email                                                                                   |
| 404    | `user_authenticator_not_found`                                | verifying a TOTP authenticator when none is enrolled                                                                     |
| 404    | `user_recovery_codes_not_found`                               | reading recovery codes when none exist                                                                                   |
| 404    | `challenge_not_found`                                         | unknown/mismatched MFA challenge                                                                                         |
| 400    | `mfa_type_unsupported`                                        | authenticator `:type` other than `totp`                                                                                  |
| 400    | `user_target_already_exists`                                  | duplicate target identifier                                                                                              |
| 404    | `user_target_not_found`                                       | target missing or not owned by caller                                                                                    |
| 424    | `user_oauth2_provider_error`                                  | provider error, missing code, or token exchange failure                                                                  |
| 400    | `user_count_exceeded`                                         | OAuth2-flow signup would exceed the project user limit                                                                   |
| 400    | `project_provider_unsupported`                                | provider not in the project's configured list                                                                            |
| 412    | `project_provider_disabled`                                   | OAuth2 provider disabled/misconfigured at the project level                                                              |
| 400    | `project_invalid_success_url` / `project_invalid_failure_url` | OAuth2 redirect URL fails the allow-list                                                                                 |
| 400    | `jwt_disabled`                                                | JWT minting with no JWT secret configured                                                                                |

---

## v1 → v2 deviations (summary)

See inline call-outs above for full detail; summarized here:

1. **D23 resolved**: session (long-lived, DB) + JWT access token (minted
   via `tokens/jwts`) are formalized as refresh/access-token pair.
2. **Session header simplified**: raw secret + hash-index lookup, no
   AES-GCM cookie encoding.
3. **Self-service account deletion added** (new — v1's `DELETE /account`
   is admin-only); deletes the user document only (see Known gaps).
4. **Identity delete ownership check added** (v1 has none).
5. **Recovery now also runs the personal-data check** (v1 only runs
   password-history on recovery).
6. **OAuth2 callback/redirect collapsed to one hop** (routing simplification).
7. **Token secrets are one-time on creation**: token-creation responses
   (verification/recovery/magic-url/email-otp/phone-otp) return the
   plaintext secret once; session views always mask `secret` (v1's
   privilege-gated exposure was not ported). OAuth2 provider token fields
   stay visible to the resource owner, same as v1.
8. **OAuth2 refresh-token rotation bug fixed** (v1 overwrites the wrong
   field on session refresh).
9. **Legacy-hash creation paths dropped entirely** (D29 — account creation
   shares the password path with `docs/api/users.md`).

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
  _shape_ of the flow (begin/callback, linking rules, anti-hijack rule
  below) independent of which providers ship first.
- **Anti-hijack rule preserved (v1 parity)**: if an OAuth2 email matches an
  `identities.providerEmail` already tied to a _different_ provider,
  linking is refused with a generic `400 general_bad_request` (not
  `user_already_exists`) — deliberately non-specific to avoid confirming
  which case applies to an unauthenticated caller.
- Smoke cases without a live DB: guest 403/401s on session-protected
  routes, 422 validation shapes, guest-accessible routes reachable without
  credentials.

## Known gaps

Documented in earlier drafts, **not implemented** in v2 (no code emits the
related codes):

- Per-project gate/limit enforcement (D42): `auths.*` method gates
  (`user_auth_method_unsupported`), user-count limit, session-alerts email,
  mock-number OTP bypass, `limits.userSessionsMax` cap with LRU eviction.
- Login lockout / rate limiting (`general_rate_limit_exceeded`).
- SMS configuration gating and dispatch (`general_phone_disabled`); phone
  tokens are minted but nothing sends the SMS.
- MFA challenge OTP dispatch and channel checks for email/phone factors
  (`user_email_not_verified`/`user_phone_not_verified`/`user_*_not_found`);
  email/phone challenge confirmation currently accepts the OTP as-is.
- Password-change session revocation.
- Guest-only guard on `POST /v2/account/sessions/anonymous`.
- Cascade on self-service `DELETE /v2/account` (only the user document is
  deleted today).
- Session-create responses never deliver the plaintext session secret:
  `POST /account/sessions/*` compute it server-side but return the masked
  view only (v1 returned it once + httpOnly cookie). Token endpoints do
  return their secret.
