/** Live coverage for project provisioning and tenant schema bootstrap against `nuvix/postgres:18.1`. */
process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { describe, expect, test } from 'bun:test'
import { DockerTenantProvisioner } from '@nuvix/core/tenants'
import { SQL } from 'bun'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from './service'

/** Detects whether the required PostgreSQL image is available without masking a missing Docker runtime. */
async function dockerAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['docker', 'image', 'inspect', 'nuvix/postgres:18.1'], {
      stdout: 'ignore',
      stderr: 'ignore',
    })
    return (await proc.exited) === 0
  } catch {
    return false
  }
}

const hasDocker = await dockerAvailable()

describe.skipIf(!hasDocker)('ProjectService.create (live nuvix/postgres:18.1)', () => {
  test("bootstraps the tenant's auth schema synchronously during creation, not lazily later", async () => {
    const db = await createPlatformDatabase()
    const provisioner = new DockerTenantProvisioner()
    const service = new ProjectService(db, provisioner)

    const project = await service.create({ name: 'Live Bootstrap' })
    expect(project.status).toBe('active')

    // Inspect the private registry target only to verify the auth schema on the actual container;
    // these connection coordinates never leave the platform service's public project view.
    const stored = await db.system().getDocument('projects', project.$id)
    const target = stored.get('target') as unknown as {
      host: string
      port: number
      database: string
      user: string
      password: string
    }

    const sql = new SQL({
      hostname: target.host,
      port: target.port,
      database: target.database,
      username: target.user,
      password: target.password,
    })
    try {
      const rows =
        await sql`select table_name from information_schema.tables where table_schema = 'auth' and table_name = 'auth_users'`
      expect(rows.length).toBe(1)
    } finally {
      await sql.close()
      await provisioner.deprovision(
        {
          projectId: project.$id,
          containerName: project.containerName,
          volumeName: project.volumeName,
        },
        { purge: true },
      )
    }
  }, 60_000)
})
