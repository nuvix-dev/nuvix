/**
 * Tenant provisioning primitives (D20, D37 — see MIGRATION.md §6b/§2).
 *
 * v2 makes multi-tenancy structural: one dedicated PostgreSQL container per
 * project. The `TenantProvisioner` interface is the only boundary the
 * platform app's project service depends on — today it's backed by
 * `DockerTenantProvisioner` (a single Docker host), and a Kubernetes-backed
 * implementation can drop in later without touching call sites.
 */

/** Connection coordinates for one tenant's dedicated PostgreSQL instance. */
export interface TenantTarget {
  host: string
  port: number
  database: string
  /** Bootstrap/admin role baked into the image (`nuvix_admin`). */
  user: string
  /** Plaintext password — callers are responsible for encrypting at rest. */
  password: string
}

/** Everything needed to locate and operate on a project's tenant container later. */
export interface TenantHandle {
  projectId: string
  containerName: string
  volumeName: string
}

export interface ProvisionRequest {
  projectId: string
}

export interface ProvisionResult {
  handle: TenantHandle
  target: TenantTarget
}

export interface DeprovisionOptions {
  /**
   * When true, also destroys the tenant's data volume. Default false: the
   * container is stopped/removed but the volume is kept as a safety window,
   * matching D37's "keep volumes by default, explicit purge to destroy data".
   */
  purge?: boolean
}

export interface WaitUntilReadyOptions {
  timeoutMs?: number
  pollIntervalMs?: number
}

/**
 * Provisions and tears down per-tenant PostgreSQL instances. Route handlers
 * never see this directly (AGENTS.md: routes never receive registry/lifecycle
 * controls) — only the platform app's project service is injected with one.
 */
export interface TenantProvisioner {
  provision(request: ProvisionRequest): Promise<ProvisionResult>
  /**
   * Blocks until the tenant instance accepts real connections. Readiness is
   * determined by actually connecting via `Bun.sql`, never by trusting the
   * container image's built-in `HEALTHCHECK` (one readiness mechanism, not two).
   */
  waitUntilReady(target: TenantTarget, options?: WaitUntilReadyOptions): Promise<void>
  deprovision(handle: TenantHandle, options?: DeprovisionOptions): Promise<void>
}
