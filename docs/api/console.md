# v2 Contract — Console Auth

> Status: IMPLEMENTED — `apps/platform/src/modules/auth/{service,routes}.ts`,
> enforcement in `apps/platform/src/plugins/auth.ts`
> Depends on: `_conventions.md` (D19), `docs/api/platform.md` (auth posture)
> Old code (reference only): root `apps/platform/src/account/` (console
> sessions were long-lived opaque cookies — replaced wholesale)

Session-based operator authentication for the platform app (control plane),
designed for BOTH the console UI and the CLI:

- The CLI logs in with credentials, stores the refresh token in its config
  file, and mints access tokens on demand (`GET /console/me` is its `whoami`).
- The console UI uses the same body contract; the refresh token is also set
  as an `httpOnly` cookie so the UI can adopt cookie-based refresh without a
  protocol change.

No API keys on the platform surface — the only credential is the operator
password, exchanged for a token pair.

## Token model

| Token   | Shape                                               | TTL                                         | Storage                                     |
| ------- | --------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| Access  | JWT (HS256, `aud: "console"`, claims `sub`/`email`) | 15 min (`NUVIX_CONSOLE_ACCESS_TTL` seconds) | Stateless — verified per request            |
| Refresh | Opaque 32-byte random (base64url, 43 chars)         | 90 days (`NUVIX_CONSOLE_REFRESH_TTL_DAYS`)  | **sha256 hash only**, in `console_sessions` |

Security properties:

- **Rotation** — every refresh mints a new refresh token; the presented
  token's hash moves to `previousHash` and is no longer valid.
- **Reuse detection** — presenting a rotated-away token revokes the whole
  session immediately (evidence of theft).
- **Revocation** — logout deletes the session row; refresh then fails.
  Access JWTs simply expire on their short TTL.
- **No enumeration** — unknown email and wrong password return the same
  `401` (`console_invalid_credentials`); failed logins create no session.
- **Audience separation** — tenant-server JWTs (`aud` ≠ `console`) are
  rejected on platform routes, and vice versa.

## Bootstrap (first operator)

At startup the platform app seeds an operator idempotently from env when
`NUVIX_CONSOLE_EMAIL` + `NUVIX_CONSOLE_PASSWORD` are set and the email does
not exist yet (password stored as an Argon2id hash). There is no public
registration endpoint.

---

## Endpoints

| Method | Path                    | Purpose                     | Auth   |
| ------ | ----------------------- | --------------------------- | ------ |
| POST   | `/console/auth`         | Login → token pair          | none   |
| POST   | `/console/auth/refresh` | Rotate → fresh pair         | none   |
| POST   | `/console/auth/logout`  | Revoke the session          | none   |
| GET    | `/console/me`           | Operator bound to the token | Bearer |

Every OTHER platform route (projects, keys, platforms, webhooks, templates,
auth-settings, database, metadata) requires a valid Bearer access token.

### `POST /console/auth`

```json
{ "email": "op@example.com", "password": "…" }
```

Response `200`:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "expiresIn": 900,
  "user": { "$id": "u1", "email": "op@example.com", "name": "Operator" }
}
```

`Set-Cookie: nx_console_refresh=<token>; HttpOnly; SameSite=Strict` (+
`Secure` in production). Failures → `401` problem+json
(`console_invalid_credentials`).

### `POST /console/auth/refresh`

Body (optional when using the cookie): `{ "refreshToken": "…" }`.

Response `200` — same shape as login, with a NEW refresh token. Errors:

- `401` `console_invalid_refresh_token` — unknown, expired, or
  **rotated-away** token (the latter also revokes the session).

### `POST /console/auth/logout`

Body (optional when using the cookie): `{ "refreshToken": "…" }`.

Response `200` `{ "status": "ok" }` — idempotent; the refresh cookie is
cleared.

### `GET /console/me`

`Authorization: Bearer <accessToken>` required.

Response `200`:

```json
{ "$id": "u1", "email": "op@example.com", "name": "Operator" }
```

`401` `console_unauthorized` — missing/invalid/expired token (also used for
platform routes without a token).

---

## Error codes

| Status | `type`                 | `code`                          | When                                   |
| ------ | ---------------------- | ------------------------------- | -------------------------------------- |
| 401    | `/errors/unauthorized` | `console_invalid_credentials`   | Login: unknown email or wrong password |
| 401    | `/errors/unauthorized` | `console_invalid_refresh_token` | Refresh: unknown/expired/rotated token |
| 401    | `/errors/unauthorized` | `console_unauthorized`          | Missing/invalid access token anywhere  |

## CLI integration sketch

```sh
# login once
PAIR=$(curl -s -X POST https://platform:4100/console/auth \
  -d '{"email":"op@example.com","password":"…"}' -H 'content-type: application/json')
# store PAIR.refreshToken in ~/.nuvix/credentials; use PAIR.accessToken per call

# before each call (or on 401): rotate
curl -s -X POST https://platform:4100/console/auth/refresh \
  -d "{\"refreshToken\":\"$REFRESH\"}" -H 'content-type: application/json'
```

The access token's short TTL keeps stolen bearer tokens nearly worthless;
the refresh token never leaves the operator's config file (httpOnly cookie
for browsers) and is dead the moment it is reused.
