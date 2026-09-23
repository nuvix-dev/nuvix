import { describe, expect, it } from 'bun:test'
import { DockerTenantProvisioner } from '@nuvix/core/tenants'
import { SQL } from 'bun'
import { DatabaseService } from './service'

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

describe.skipIf(!hasDocker)('DatabaseService live integration (nuvix/postgres:18.1)', () => {
  it('executes full schema CRUD lifecycle against a real PostgreSQL 18 tenant', async () => {
    const provisioner = new DockerTenantProvisioner()
    const projectId = `it-db-service-${crypto.randomUUID().slice(0, 8)}`
    const { handle, target } = await provisioner.provision({
      projectId,
    })

    await provisioner.waitUntilReady(target, { timeoutMs: 30_000 })

    const sql = new SQL({
      hostname: target.host,
      port: target.port,
      database: target.database,
      username: target.user,
      password: target.password,
    })

    const service = new DatabaseService(sql)

    try {
      // 1. Create a managed schema
      const managed = await service.create({
        name: 'tenant_managed',
        type: 'managed',
        description: 'Managed schema for testing',
      })
      expect(managed.name).toBe('tenant_managed')
      expect(managed.type).toBe('managed')
      expect(managed.description).toBe('Managed schema for testing')

      // 2. Get the schema
      const fetched = await service.get('tenant_managed')
      expect(fetched).toEqual(managed)

      // 3. List schemas
      const list = await service.list()
      expect(list.data.some((s) => s.name === 'tenant_managed')).toBe(true)

      // 4. Update schema
      const updated = await service.update('tenant_managed', {
        description: 'Updated description',
      })
      expect(updated.description).toBe('Updated description')

      // 5. Create a document schema (seeds @nuvix/db metadata)
      const docSchema = await service.create({
        name: 'tenant_documents',
        type: 'document',
      })
      expect(docSchema.name).toBe('tenant_documents')
      expect(docSchema.type).toBe('document')

      // Verify metadata table created in PostgreSQL
      const metaTables = await sql`
          select table_name from information_schema.tables
          where table_schema = 'tenant_documents' and table_name = 'tenant_documents__metadata'
        `
      expect(metaTables.length).toBe(1)

      // 6. Delete both schemas
      await service.delete('tenant_managed')
      await service.delete('tenant_documents')

      // Verify schemas dropped from PostgreSQL
      const schemasRemaining = await sql`
          select schema_name from information_schema.schemata
          where schema_name in ('tenant_managed', 'tenant_documents')
        `
      expect(schemasRemaining.length).toBe(0)
    } finally {
      await sql.close()
      await provisioner.deprovision(handle, { purge: true })
    }
  }, 60_000)
})
