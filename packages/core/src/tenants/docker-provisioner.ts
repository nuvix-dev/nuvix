import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { waitUntilPostgresReady } from './readiness'
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
 * Provisions one dedicated `nuvix/postgres:18.1` container per project on a
 * single Docker host. Talks to the Docker CLI via `Bun.spawn` rather than
 * the HTTP/socket API — no extra dependencies, and the binary is already a
 * runtime requirement for self-hosted deployments.
 *
 * Networking: host-mapped random port bound to loopback only
 * (`-p 127.0.0.1:0:5432`) — tenant databases are never reachable from the
 * network; a shared-host internal-network mode is a possible future pass.
 *
 * Credentials: the generated password reaches the container through a
 * 0600 secret file mounted at `/run/secrets/tenant_password`
 * (`POSTGRES_PASSWORD_FILE`), never through argv or `-e` — the process
 * list and `docker inspect` never see it. The file is removed with the
 * tenant's volume on `deprovision`.
 *
 * Volumes: named per project, so `docker rm -f` (no `-v`) never touches tenant
 * data — that's what makes "keep the volume by default" fall out for free.
 * A `purge` deprovision additionally removes the volume.
 */
export interface DockerTenantProvisionerOptions {
  /** Exact tenant image; defaults to the pinned `nuvix/postgres:18.1`. */
  image?: string
  /** Prefix for container/volume names, so multiple environments can share a host. */
  namePrefix?: string
  /** Postgres superuser role baked into the image. */
  adminUser?: string
  /** Database created by the image's own first-boot init. */
  adminDatabase?: string
}

const DEFAULT_IMAGE = 'nuvix/postgres:18.1'
const DEFAULT_NAME_PREFIX = 'nuvix-tenant'
const DEFAULT_ADMIN_USER = 'nuvix_admin'
const DEFAULT_ADMIN_DATABASE = 'postgres'

/** Run a `docker` CLI command, failing with its stderr on non-zero exit. */
async function runDocker(args: string[]): Promise<string> {
  const proc = Bun.spawn(['docker', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout.text(),
    proc.stderr.text(),
    proc.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`docker ${args.join(' ')} failed (exit ${exitCode}): ${stderr.trim()}`)
  }
  return stdout.trim()
}

/** Generates a Postgres-safe random password (no shell-hostile characters). */
function generatePassword(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url')
}

/** `TenantProvisioner` backed by one local Docker host. */
export class DockerTenantProvisioner implements TenantProvisioner {
  private readonly image: string
  private readonly namePrefix: string
  private readonly adminUser: string
  private readonly adminDatabase: string

  constructor(options: DockerTenantProvisionerOptions = {}) {
    this.image = options.image ?? DEFAULT_IMAGE
    this.namePrefix = options.namePrefix ?? DEFAULT_NAME_PREFIX
    this.adminUser = options.adminUser ?? DEFAULT_ADMIN_USER
    this.adminDatabase = options.adminDatabase ?? DEFAULT_ADMIN_DATABASE
  }

  private containerName(projectId: string): string {
    return `${this.namePrefix}-${projectId}`
  }

  private volumeName(projectId: string): string {
    return `${this.namePrefix}-${projectId}-data`
  }

  /**
   * Host-side 0600 file carrying the tenant password — mounted read-only
   * into the container. Lives until the tenant is deprovisioned so the
   * image's entrypoint can re-read it on container restarts.
   */
  private secretFilePath(projectId: string): string {
    const dir = join(tmpdir(), `${this.namePrefix}-secrets`)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    return join(dir, `${projectId}.secret`)
  }

  private writeSecretFile(projectId: string, password: string): string {
    const path = this.secretFilePath(projectId)
    writeFileSync(path, password, { encoding: 'utf8', mode: 0o600 })
    // Defensive: guarantee 0600 even where umask is unusually permissive.
    chmodSync(path, 0o600)
    return path
  }

  private removeSecretFile(projectId: string): void {
    const path = this.secretFilePath(projectId)
    try {
      if (existsSync(path)) rmSync(path)
    } catch {
      // Best-effort hygiene; a leftover 0600 file is harmless.
    }
  }

  /**
   * Create the data volume, start the container on a random host port,
   * and return its connection target with a freshly generated password.
   */
  async provision({ projectId }: ProvisionRequest): Promise<ProvisionResult> {
    const containerName = this.containerName(projectId)
    const volumeName = this.volumeName(projectId)
    const password = generatePassword()
    const secretFile = this.writeSecretFile(projectId, password)

    await runDocker(['volume', 'create', volumeName])

    try {
      await runDocker([
        'run',
        '-d',
        '--name',
        containerName,
        '--label',
        'nuvix.tenant=true',
        '--label',
        `nuvix.project-id=${projectId}`,
        // Password enters through a mounted 0600 secret file — never argv/env.
        '-e',
        'POSTGRES_PASSWORD_FILE=/run/secrets/tenant_password',
        '-v',
        `${secretFile}:/run/secrets/tenant_password:ro`,
        '-v',
        `${volumeName}:/var/lib/postgresql/data`,
        // Loopback-only: the tenant database is never network-reachable.
        '-p',
        '127.0.0.1:0:5432',
        this.image,
      ])
    } catch (error) {
      this.removeSecretFile(projectId)
      throw error
    }

    const port = await this.resolveHostPort(containerName)

    const handle: TenantHandle = { projectId, containerName, volumeName }
    const target: TenantTarget = {
      host: '127.0.0.1',
      port,
      database: this.adminDatabase,
      user: this.adminUser,
      password,
    }
    return { handle, target }
  }

  /** Read the container's mapped 5432 port from `docker port`. */
  private async resolveHostPort(containerName: string): Promise<number> {
    // `docker port <name> 5432/tcp` prints one "host:port" line per bound
    // address family (e.g. 0.0.0.0:32768 and [::]:32768) — take the first.
    const output = await runDocker(['port', containerName, '5432/tcp'])
    const firstLine = output.split('\n')[0]?.trim()
    const port = Number(firstLine?.split(':').pop())
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`Could not resolve host port for container ${containerName}: ${output}`)
    }
    return port
  }

  /** Block until the new instance accepts queries (delegates to `waitUntilPostgresReady`). */
  async waitUntilReady(target: TenantTarget, options?: WaitUntilReadyOptions): Promise<void> {
    return waitUntilPostgresReady(target, options)
  }

  /** Remove the container, and the data volume too when `purge` is set. */
  async deprovision(handle: TenantHandle, options: DeprovisionOptions = {}): Promise<void> {
    await runDocker(['rm', '-f', handle.containerName]).catch((error) => {
      // Already gone is fine; anything else surfaces.
      if (!String(error).includes('No such container')) throw error
    })
    if (options.purge) {
      await runDocker(['volume', 'rm', handle.volumeName]).catch((error) => {
        if (!String(error).includes('No such volume')) throw error
      })
    }
    this.removeSecretFile(handle.projectId)
  }
}
