import type {
  DeprovisionOptions,
  ProvisionRequest,
  ProvisionResult,
  TenantHandle,
  TenantProvisioner,
  TenantTarget,
  WaitUntilReadyOptions,
} from './types'

/**
 * In-memory `TenantProvisioner` for tests and offline development — never
 * touches Docker. Tracks provisioned handles so tests can assert on
 * provision/deprovision behavior without a real container runtime.
 */
/** In-memory provisioner for tests and offline development; always immediately ready. */
export class FakeTenantProvisioner implements TenantProvisioner {
  readonly provisioned = new Map<string, TenantHandle>()
  private nextPort = 40000

  /** Allocate a deterministic fake handle/target; never performs I/O. */
  async provision({ projectId }: ProvisionRequest): Promise<ProvisionResult> {
    const handle: TenantHandle = {
      projectId,
      containerName: `fake-tenant-${projectId}`,
      volumeName: `fake-tenant-${projectId}-data`,
    }
    const target: TenantTarget = {
      host: '127.0.0.1',
      port: this.nextPort++,
      database: 'postgres',
      user: 'nuvix_admin',
      password: 'fake-password',
    }
    this.provisioned.set(projectId, handle)
    return { handle, target }
  }

  async waitUntilReady(_target: TenantTarget, _options?: WaitUntilReadyOptions): Promise<void> {
    // Nothing real is running — always "ready" immediately.
  }

  /** Forget the handle; no special purge handling without real volumes. */
  async deprovision(handle: TenantHandle, _options?: DeprovisionOptions): Promise<void> {
    this.provisioned.delete(handle.projectId)
  }
}
