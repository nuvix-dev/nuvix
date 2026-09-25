# Deployment — Nuvix v2 (Bun Runtime)

Nuvix v2 runs on a pure Bun runtime. There is no Node.js dependency, no NestJS runtime, no Turbo build step, and no compilation step required.

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
