process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { describe, expect, test } from 'bun:test'
import { DockerTenantProvisioner } from '@nuvix/core/tenants'
import { SQL } from 'bun'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from './service'

/**
 * Live integration coverage against a REAL `nuvix/postgres:18.1` container
 * (AGENTS.md) — proves the full "schema init happens once, at project
 * creation" flow this slice was built for, not just each piece in
 * isolation. Skipped (not faked) when Docker isn't available.
 */
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

    // Read the tenant's real connection coordinates straight from the
    // registry (never exposed on the public ProjectView) to verify the
    // auth schema really exists on the actual container, proving
    // bootstrapTenantAuth ran for real, not just that create() resolved.
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
