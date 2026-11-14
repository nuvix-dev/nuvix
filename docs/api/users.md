# v2 Contract — Users

> Status: IMPLEMENTED — `apps/server/src/users/route.ts` (+ `routes.ts`,
> `service.ts`, `formatter.ts`, `logs-view.ts`),
> `apps/server/src/users/sessions/**`, `apps/server/src/users/targets/**`,
> `apps/server/src/stats/usage.ts`
> Depends on: `_conventions.md` (D19, D26–D28), D29 (password hashing), D42,
> `@nuvix/db`, `docs/api/account.md` (shared session/identity primitives)
> Old code (reference only): root `apps/server/src/users/`

User administration: lifecycle, profile fields, prefs/labels/status,
identities, tokens/JWTs, sessions, push targets, activity logs, and usage
stats. Admin-facing surface (the end-user "account" surface is
`docs/api/account.md`).

All routes require a project (`x-nuvix-publishable-key`) and an
authenticated caller resolved by the shared tenant context chain; responses
use the server list convention `{ total, <resources> }`.

---

## Endpoints — Core

| Method | Path                                   | Purpose                                            |
| ------ | -------------------------------------- | -------------------------------------------------- |
| POST   | `/v2/users`                            | Create user (Argon2id hashing)                     |
| POST   | `/v2/users/argon2`                     | Create user with explicit Argon2id                 |
| POST   | `/v2/users/bcrypt`                     | Create user with explicit bcrypt                   |
| GET    | `/v2/users`                            | List users (`search`, `limit`, `offset`, `cursor`) |
| GET    | `/v2/users/usage`                      | Usage stats from recorded metric rows              |
| GET    | `/v2/users/:userId`                    | Get user (embeds targets)                          |
| DELETE | `/v2/users/:userId`                    | Delete user (cascades targets/sessions/tokens)     |
| PATCH  | `/v2/users/:userId/name`               | Update name                                        |
| PATCH  | `/v2/users/:userId/password`           | Update password (re-hashes, appends history)       |
| PATCH  | `/v2/users/:userId/email`              | Update email (resets `emailVerification`)          |
| PATCH  | `/v2/users/:userId/phone`              | Update phone (resets `phoneVerification`)          |
| PATCH  | `/v2/users/:userId/verification`       | Set `emailVerification` flag directly              |
| PATCH  | `/v2/users/:userId/verification/phone` | Set `phoneVerification` flag directly              |
| GET    | `/v2/users/:userId/prefs`              | Get prefs                                          |
| PATCH  | `/v2/users/:userId/prefs`              | **Replace** prefs (whole object)                   |
| PUT    | `/v2/users/:userId/labels`             | Replace labels                                     |
| PATCH  | `/v2/users/:userId/status`             | Activate/block                                     |
| GET    | `/v2/users/:userId/memberships`        | Teams the user belongs to (`limit`, `offset`)      |
| GET    | `/v2/users/:userId/logs`               | Activity logs (audit collection)                   |

### User object

```json
{
  "$id": "user_001",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "phone": "+15550001234",
  "status": true,
  "labels": ["vip"],
  "emailVerification": true,
  "phoneVerification": false,
  "mfa": false,
  "prefs": { "theme": "dark" },
  "passwordUpdate": "2026-08-26T10:00:00.000Z",
  "registration": "2026-08-26T10:00:00.000Z",
  "accessedAt": "2026-08-26T10:00:00.000Z",
  "targets": [
    {
      "$id": "target_1",
      "userId": "user_001",
      "providerType": "push",
      "providerId": "",
      "identifier": "expo-token-…",
      "name": "Ada's iPhone",
      "expired": false
    }
  ],
  "$createdAt": "2026-08-26T10:00:00.000Z",
  "$updatedAt": "2026-08-26T10:00:00.000Z"
}
```

The response is an explicit view — no `hash`, `hashOptions`, `password`, or
`passwordHistory` are ever exposed (earlier drafts proposing their
inclusion were not implemented). `targets` is embedded on single-resource
reads; list responses embed each user's stored `targets` value.

### Create user

Body (all variants): `{ userId?, email?, phone?, password?, name? }` —
`userId` follows D28 (`'unique()'` default). Duplicate email →
`409 user_email_already_exists`; duplicate phone →
`409 user_phone_already_exists`. When email/phone are set, matching
email/sms `targets` documents are created automatically. `password` is
hashed server-side with the variant's algorithm (`argon2id` default).

**Legacy hash variants removed (D29):** v1's
`POST /users/md5 | sha | phpass | scrypt | scrypt-modified` have no v2
equivalent; only `argon2` (Argon2id) and `bcrypt` exist, and both accept
plaintext (there are no pre-hashed import endpoints).

### `PATCH /v2/users/:userId/password`

Body: `{ password }` (min 8). Re-hashes with Argon2id, updates
`passwordUpdate`, appends the new hash to `passwordHistory`. No
personal-data or history _validation_, and no session revocation (see
Known gaps).

### `GET /v2/users/usage`

Reads the recorded `stats` rows (INF totals + period-bucketed series,
zero-filled across the window — v1 parity). Query: `range` ∈
`24h | 7d | 30d | 90d` (default `30d`); invalid → `400 invalid_usage_range`.

```json
{
  "range": "30d",
  "usersTotal": 1234,
  "sessionsTotal": 5678,
  "users": [{ "date": "2026-10-26T00:00:00Z", "value": 12 }],
  "sessions": [{ "date": "2026-10-26T00:00:00Z", "value": 34 }]
}
```

### `GET /v2/users/:userId/logs`

Reads the tenant `audit` collection by the user's internal sequence.
Query: `limit`, `offset`. Each log row is decorated with detected
client/OS/device fields and GeoIP country (localized name):

```json
{
  "total": 2,
  "logs": [
    {
      "event": "user.create",
      "userId": "user_001",
      "userEmail": "ada@example.com",
      "userName": "Ada Lovelace",
      "ip": "203.0.113.7",
      "time": "2026-10-26T11:00:00.000Z",
      "osCode": "MAC",
      "osName": "macOS",
      "osVersion": "14",
      "clientType": "browser",
      "clientCode": "CH",
      "clientName": "Chrome",
      "clientVersion": "128",
      "clientEngine": "Blink",
      "clientEngineVersion": "128",
      "deviceName": "Desktop",
      "deviceBrand": "Apple",
      "deviceModel": "",
      "countryCode": "US",
      "countryName": "United States"
    }
  ]
}
```

## Endpoints — Identities & Tokens & JWTs

| Method | Path                               | Purpose                                                                               |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/v2/users/identities`             | List OAuth2 identities (admin view, all users; `search`, `limit`, `offset`, `cursor`) |
| DELETE | `/v2/users/identities/:identityId` | Delete identity (`200 { status: 'success' }`)                                         |
| POST   | `/v2/users/:userId/tokens`         | Create a generic token for this user                                                  |
| POST   | `/v2/users/:userId/jwts`           | Issue JWT for user                                                                    |

Identity objects expose `userId`, `provider`, `providerUid`,
`providerEmail`, `providerAccessToken`, `providerAccessTokenExpiry`,
`providerRefreshToken`.

**`POST …/tokens`** body: `{ type?, expireInSeconds?, phrase? }` —
`type` is the numeric-or-string token type (default `1`),
`expireInSeconds` default `3600`, `phrase` optional. The token document is
created **without a secret**; the response is the token view
(`{ $id, userId, type, expire, phrase }`) — no plaintext secret is
returned or emailed (earlier drafts claiming a returned `secret` were not
implemented).

**`POST …/jwts`** body: `{ sessionId?, duration? }` (`duration` seconds,
default `900`). Response: `{ jwt }` signed with `sub: userId` and
`sid: sessionId`. `sessionId` is **not validated** against the user's
sessions (no `user_session_not_found` rejection — see Known gaps).

## Endpoints — Sessions (`/v2/users/:userId/sessions`)

| Method | Path                    | Purpose                                                                                |
| ------ | ----------------------- | -------------------------------------------------------------------------------------- |
| GET    | `…/sessions`            | List user sessions (`limit`, `offset`)                                                 |
| POST   | `…/sessions`            | Create session — body `{ provider?, expireInSeconds? }` (defaults `email`, `31536000`) |
| DELETE | `…/sessions`            | Delete all sessions                                                                    |
| DELETE | `…/sessions/:sessionId` | Delete one session                                                                     |

Session objects use the shared session view (`docs/api/account.md`) with
`secret` always empty-string masked and `current` always `false`.
Unknown session on delete → `404 user_session_not_found`.

## Endpoints — Targets (`/v2/users/:userId/targets`)

| Method | Path                  | Purpose                          |
| ------ | --------------------- | -------------------------------- |
| GET    | `…/targets`           | List targets (`limit`, `offset`) |
| POST   | `…/targets`           | Create target                    |
| GET    | `…/targets/:targetId` | Get target                       |
| PATCH  | `…/targets/:targetId` | Update target                    |
| DELETE | `…/targets/:targetId` | Delete target                    |

Create body: `{ providerType, identifier, providerId?, name? }` — `name` is
**optional** (earlier drafts marking it required were not implemented).
PATCH accepts `{ identifier?, providerId?, name? }`. `providerType` ∈
`email | sms | push`.

---

## Errors

| Status | Type                  | Code                        | When                             |
| ------ | --------------------- | --------------------------- | -------------------------------- |
| 404    | `/errors/not-found`   | `user_not_found`            | unknown user                     |
| 404    | `/errors/not-found`   | `user_identity_not_found`   | unknown identity                 |
| 404    | `/errors/not-found`   | `user_session_not_found`    | unknown session id on delete     |
| 404    | `/errors/not-found`   | `user_target_not_found`     | unknown target                   |
| 409    | `/errors/conflict`    | `user_email_already_exists` | duplicate email on create/update |
| 409    | `/errors/conflict`    | `user_phone_already_exists` | duplicate phone on create/update |
| 400    | `/errors/bad-request` | `invalid_usage_range`       | bad `?range=` on `/usage`        |

## Known gaps

Described in earlier drafts, **not implemented**:

- Admin MFA management (`PATCH …/mfa`, factors, recovery-codes,
  authenticators under `/v2/users/:userId/mfa`) — no MFA routes exist in
  this module; MFA enrollment is self-service via `docs/api/account.md`.
- Password-update session revocation and personal-data/history validation.
- JWT `sessionId` validation (`user_session_not_found`).
- Label validation rules (`^[a-zA-Z0-9]{1,36}$`,
  `limits.arrayParamsSize` cap, dedup) — labels are stored as given.
- Attribute allow-lists per list endpoint with
  `400 general_query_invalid` fallback — lists accept only the generic
  `search`/`limit`/`offset`/`cursor` params shown above.
