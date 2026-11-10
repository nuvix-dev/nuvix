# Deployment — Nuvix v2 (Bun Runtime)

Nuvix v2 runs on a pure Bun runtime. There is no Node.js dependency, no NestJS runtime, and no Turbo build step. Deployable apps are **ahead-of-time (AOT) compiled**: route handlers and schemas are compiled at the build step instead of the first request (see `build.ts` and the [Elysia AOT docs](https://next.elysiajs.com/patterns/aot/)) — faster startup, lower peak memory, and no runtime compiler allocations.

## Architecture

Nuvix v2 separates concerns into two cooperating runtime containers:
1. **Control Plane (`apps/platform`)**
   - HTTP port: `4100` (`NUVIX_PLATFORM_PORT`)
   - Manages tenant lifecycle (provisioning dedicated `nuvix/postgres:18.1` containers per project via `/var/run/docker.sock`).
   - Owns the project registry, keys, platforms, auth settings, templates, webhooks, and database introspection (`@nuvix/pg-meta`).
   - Persistence: SQLite (default zero-infra) or PostgreSQL (`NUVIX_PLATFORM_DB_DRIVER=postgres`).

2. **Data & API Engine (`apps/server`)**
   - HTTP port: `4000` (`NUVIX_PORT`)
   - Project-facing API (`/v2/*`).
   - Resolves tenant connections through `x-nuvix-publishable-key` using the shared control-plane registry and `TenantResourcePool` (bounded LRU, one Bun `SQL` client per tenant).
   - Coordinates queues, background workers, storage, messaging, and real-time events.

## Docker Deployment

### 1. Requirements

- Docker Engine 24+ with Compose v2
- Access to Docker daemon (`/var/run/docker.sock`) for the platform container
- Base PostgreSQL image: `nuvix/postgres:18.1`

### 2. Environment Configuration

Create a `.env` file based on `docs/ENV.md`:

```bash
NUVIX_ENV=production
NUVIX_PORT=4000
NUVIX_PLATFORM_PORT=4100
NUVIX_JWT_SECRET=$(openssl rand -hex 32)
NUVIX_TENANT_ENCRYPTION_KEY=$(openssl rand -base64 32)
NUVIX_DATABASE_PASSWORD=strong-postgres-password
```

### 3. Running with Docker Compose

To start the full Nuvix v2 stack:

```bash
docker compose up -d
```

### 4. Health Checks

- Server API: `GET http://localhost:4000/v2/health`
- Platform API: `GET http://localhost:4100/health`
- PostgreSQL: `pg_isready -U postgres`
- Redis: `redis-cli ping`

## AOT Bundle

Both apps compile to a self-contained bundle via one build script:

```bash
bun run build:bundle                 # APP_NAME=server (default)
APP_NAME=platform bun run build:bundle
bun apps/server/dist/index.js        # run the compiled server
```

`build.ts` dry-runs the app entry (guarded by `inAotBuild()` — no HTTP server,
no queue workers, no platform persistence) and emits `apps/<app>/dist/`.
Runtime assets resolve relative to the bundle through `apps/server/src/assets.ts`;
`dist/` sits beside `src/`, so source and bundle resolve identically. The
Dockerfile runs this build in its build stage and executes
`apps/${APP_NAME}/dist/index.js` in the runtime stage.

Queue workers load lazily (dynamic import inside the runtime guard) and BullMQ
processors run as in-process handler functions — the build and the bundle never
touch bullmq unless a Redis connection is actually configured.

## Redis — BullMQ over Bun's built-in client

Queue connections are Bun's native `RedisClient` (RESP3, part of the runtime):
`useBunRedisClients()` (in `@nuvix/core/queues`) sets BullMQ's global
`RedisConnection.clientFactory` once at startup, so every connection BullMQ
creates — Queue, Worker, QueueEvents, blocking duplicates — is a Bun client
wrapped in BullMQ's own `createBunRedisClient` adapter. ioredis is never
installed or loaded. `NUVIX_REDIS_URL` keeps its documented form
(`redis://[:password@]host[:port][/db]`); credentials are applied by the
factory when building the client URL.

> Note: only plaintext `redis://` URLs are supported today — `parseRedisUrl`
> discards the URL scheme, so a `rediss://` (TLS) endpoint would silently
> downgrade to plaintext. Until TLS support is added, keep Redis on a
> trusted network.
