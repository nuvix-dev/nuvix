# Environment Variables — Nuvix v2

> Copy these into a local `.env` file (never committed). Generate secrets with
> `openssl rand -hex 32`.

## App

| Variable     | Required | Default       | Description                             |
| ------------ | -------- | ------------- | --------------------------------------- |
| `NUVIX_ENV`  | yes      | `development` | `development` \| `production` \| `test` |
| `NUVIX_PORT` | yes      | `4000`        | HTTP listen port                        |
| `NUVIX_HOST` | yes      | `0.0.0.0`     | HTTP bind address                       |

## Internal (platform) database

| Variable                      | Required | Description                                         |
| ----------------------------- | -------- | ---------------------------------------------------- |
| `NUVIX_INTERNAL_DATABASE_URL` | yes      | PostgreSQL 18 connection string for platform tables |

## Platform app

The platform app owns the project registry and tenant provisioning (D20,
D37/D38). Its own persistence is pluggable via `@nuvix/db` — SQLite by
default (zero infra for local dev), PostgreSQL for real deployments.

| Variable                       | Required | Default                    | Description                                                          |
| ------------------------------- | -------- | --------------------------- | --------------------------------------------------------------------- |
| `NUVIX_PLATFORM_HOST`           | yes      | `0.0.0.0`                   | Platform app HTTP bind address                                        |
| `NUVIX_PLATFORM_PORT`           | yes      | `4100`                      | Platform app HTTP port                                                |
| `NUVIX_PLATFORM_DB_DRIVER`      | no       | `sqlite`                    | `sqlite` \| `postgres` — registry persistence driver                  |
| `NUVIX_PLATFORM_DB_URL`         | no       | `./data/platform.sqlite`    | SQLite file path, or a PostgreSQL connection string when driver is `postgres` |
| `NUVIX_TENANT_ENCRYPTION_KEY`   | yes      |                              | Base64-encoded 32-byte AES-256-GCM key encrypting tenant DB passwords at rest. Generate with `openssl rand -base64 32` |
| `NUVIX_TENANT_POSTGRES_IMAGE`   | no       | `nuvix/postgres:18.1`       | Exact tenant Postgres image (D24) — override only for local dev         |

## Redis

| Variable          | Required | Description                            |
| ----------------- | -------- | -------------------------------------- |
| `NUVIX_REDIS_URL` | yes      | Redis connection string (queues/cache) |

## Security

| Variable           | Required | Description                                                          |
| ------------------ | -------- | -------------------------------------------------------------------- |
| `NUVIX_JWT_SECRET` | yes      | Secret used to sign JWTs/tokens. **Set a real value in production.** |

## Storage

| Variable                | Required | Default             | Description        |
| ----------------------- | -------- | ------------------- | ------------------ |
| `NUVIX_STORAGE_UPLOADS` | no       | `./storage/uploads` | Local uploads root |
