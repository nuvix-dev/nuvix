# v2 Contract — API Logs

> Status: IMPLEMENTED — `apps/server/src/request-logs/route.ts` (read),
> `apps/server/src/request-logs/source.ts` (source), `apps/server/src/workers/logs.processor.ts`
> (worker)
> Depends on: `_conventions.md` (D19), `docs/api/console.md` (console JWT leg)
> Old code (reference only): root `libs/core/src/resolvers/{hooks,queues}/logs.*`,
> root `apps/platform/src/projects/project.controller.ts` (`getLogs`)

Per-request API logs, stored in EACH project's tenant database (`api_logs`
collection, `auth` schema). v1 stored them in the platform main pool's
`system` schema because v1 was not truly multi-tenant; v2's logs are
project-scoped data and live with the project.

## Pipeline

| Stage   | Where                        | Notes                                                                                   |
| ------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| Emit    | `logsRequestSource` (server) | `afterResponse` — method/path/status/latency/IP/UA + metadata (headers, query)          |
| Enqueue | `LOGS` queue                 | Job payloads carry `projectId`; workers resolve the tenant                              |
| Persist | `logs.processor` (worker)    | Batched (5000/3s), **deep recursive redaction at buffer time** (v1 redacted at persist) |
| Read    | `GET /v2/logs` (server)      | Admin-only; newest first, paginated                                                     |

Skips (v1 `isAdminUser`/`skipLogging` parity): API-key callers, `/health`,
the OpenAPI spec surface. Logging never breaks the request path; flush
failures drop the batch (logs are lossy by design).

## Log row shape

| Field        | Type            | Notes                                |
| ------------ | --------------- | ------------------------------------ |
| `request_id` | string          | UUID generated at emit time          |
| `method`     | string          | HTTP method                          |
| `path`       | string          | Path without query                   |
| `status`     | integer         | Response status                      |
| `timestamp`  | ISO-8601 UTC    | Emit time                            |
| `client_ip`  | string \| null  | `x-forwarded-for` aware              |
| `user_agent` | string \| null  |                                      |
| `resource`   | string \| null  | `"unknown"` (v1 namespace parity)    |
| `latency_ms` | integer \| null | Response wall time                   |
| `region`     | string \| null  | `"default"`                          |
| `error`      | string \| null  | Set for `status >= 400`              |
| `metadata`   | object \| null  | `{ headers, query }` — deep-redacted |

Redaction: keys containing/named `authorization`, `cookie`, `token`,
`secret`, `key`, `password`, `auth` (and v1's full `SENSITIVE_KEYS` list)
are replaced with `"[REDACTED]"` at ANY nesting level.

---

## Endpoints

| Method | Path       | Purpose                          | Auth                                   |
| ------ | ---------- | -------------------------------- | -------------------------------------- |
| GET    | `/v2/logs` | List this project's request logs | API key (`x-nuvix-key`) or console JWT |

### `GET /v2/logs`

Two admin auth legs:

1. **Tenant-local API key** — `x-nuvix-key` header (the server's secret
   API-key credential; `auth.type === 'apiKey'`).
2. **Console operator JWT** — `Authorization: Bearer` with `aud: 'console'`.
   Lets the console UI read project logs directly from the server API.
   Tenant-style JWTs (no console audience) are rejected.

Query params (v1's AST filter DSL replaced with simple params — the DSL was
console-internal machinery):

| Param      | Type    | Default | Notes                     |
| ---------- | ------- | ------- | ------------------------- |
| `limit`    | integer | 25      | 1–100                     |
| `offset`   | integer | 0       |                           |
| `method`   | string  | —       | exact match (upper-cased) |
| `status`   | integer | —       | exact match               |
| `path`     | string  | —       | contains match            |
| `resource` | string  | —       | exact match               |
| `since`    | string  | —       | ISO timestamp lower bound |
| `until`    | string  | —       | ISO timestamp upper bound |

Response `200` (server list convention — `{ total, <resources> }`):

```json
{
  "total": 2,
  "logs": [
    {
      "$id": "…",
      "request_id": "7c9e…",
      "method": "POST",
      "path": "/v2/account",
      "status": 500,
      "timestamp": "2026-10-26T11:00:00.000Z",
      "client_ip": "203.0.113.7",
      "user_agent": "bun-test",
      "resource": "unknown",
      "latency_ms": 42,
      "region": "default",
      "error": "Error response (500)",
      "metadata": { "headers": { "Authorization": "[REDACTED]" }, "query": {} }
    }
  ]
}
```

## Errors

| Status | `type`                 | `code`              | When                      |
| ------ | ---------------------- | ------------------- | ------------------------- |
| 401    | `/errors/unauthorized` | `logs_unauthorized` | Neither admin leg present |
