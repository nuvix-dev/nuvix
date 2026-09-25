process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import { FakeTenantProvisioner, TenantResourcePool } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import type { PgMeta, PgSchema, PgTable, PgVersion } from '@nuvix/pg-meta'
import type { SQL } from 'bun'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from '../projects/service'
import { databaseRoutes } from './routes'
import { DatabaseService } from './service'

let projectService: ProjectService

async function buildApp() {
  const db = await createPlatformDatabase()
  projectService = new ProjectService(db, new FakeTenantProvisioner(), async () => {})

  const mockMeta = {
    query: async (sql: string) => [{ count: 42, query: sql }],
    schemas: {
      list: async () => [{ id: 1, name: 'public', owner: 'postgres' }] as PgSchema[],
      retrieve: async ({ name, id }: { name?: string; id?: number }) => {
        if (name === 'public' || id === 1) {
          return { id: 1, name: 'public', owner: 'postgres' } as PgSchema
        }
        return null
      },
    },
    tables: {
      list: async () =>
        [
          {
            id: 10,
            schema: 'public',
            name: 'users',
            rls_enabled: false,
            rls_forced: false,
            replica_identity: 'DEFAULT',
            bytes: 1024,
            size: '1 kB',
            live_rows_estimate: 0,
            dead_rows_estimate: 0,
            comment: null,
            primary_keys: [],
            relationships: [],
          },
        ] as PgTable[],
      retrieve: async ({ id }: { id?: number }) => {
        if (id === 10) {
          return {
            id: 10,
            schema: 'public',
            name: 'users',
            rls_enabled: false,
            rls_forced: false,
            replica_identity: 'DEFAULT',
            bytes: 1024,
            size: '1 kB',
            live_rows_estimate: 0,
            dead_rows_estimate: 0,
            comment: null,
            primary_keys: [],
            relationships: [],
          } as PgTable
        }
        return null
      },
    },
    columns: {
      list: async () => [],
      retrieve: async () => null,
    },
    indexes: {
      list: async () => [],
      retrieve: async () => null,
    },
    functions: {
      list: async () => [],
      retrieve: async () => null,
    },
    roles: {
      list: async () => [],
      retrieve: async () => null,
    },
    extensions: {
      list: async () => [],
      retrieve: async () => null,
    },
    views: {
      list: async () => [],
      retrieve: async () => null,
    },
    triggers: {
      list: async () => [],
      retrieve: async () => null,
    },
    types: {
      list: async () => [],
      retrieve: async () => null,
    },
    policies: {
      list: async () => [],
      retrieve: async () => null,
    },
    version: {
      get: async () =>
        ({
          version: 'PostgreSQL 18.1',
          version_number: 180001,
          active_connections: 5,
          max_connections: 100,
        }) as PgVersion,
    },
    config: {
      list: async () => [],
    },
  } as unknown as PgMeta

  const pool = new TenantResourcePool({
    dependencies: {
      createSql: () => ({ close: async () => {} }) as unknown as SQL,
      createDatabase: () => ({}) as unknown as Database,
      createPgMeta: () => mockMeta,
    },
  })

  const service = new DatabaseService(db, pool)
  const app = new Elysia().use(problemErrors()).use(databaseRoutes(service))
  return treaty(app)
}

let client: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  client = await buildApp()
})

describe('database routes (treaty)', () => {
  test('POST /projects/:projectId/database/query executes query', async () => {
    const project = await projectService.create({ name: 'Eden Query Test' })

    const res = await client
      .projects({ projectId: project.$id })
      .database.query.post({ query: 'SELECT count(*) FROM test;' })

    expect(res.status).toBe(200)
    expect(res.data).toEqual([{ count: 42, query: 'SELECT count(*) FROM test;' }])
  })

  test('GET /projects/:projectId/database/schemas lists schemas', async () => {
    const project = await projectService.create({ name: 'Eden Schemas Test' })

    const res = await client.projects({ projectId: project.$id }).database.schemas.get()

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    expect((res.data as PgSchema[])[0]?.name).toBe('public')
  })

  test('GET /projects/:projectId/database/schemas/:nameOrId gets schema', async () => {
    const project = await projectService.create({ name: 'Eden Schema Get Test' })

    const res = await client
      .projects({ projectId: project.$id })
      .database.schemas({ nameOrId: 'public' })
      .get()

    expect(res.status).toBe(200)
    expect((res.data as PgSchema).id).toBe(1)
  })

  test('GET /projects/:projectId/database/tables lists tables', async () => {
    const project = await projectService.create({ name: 'Eden Tables Test' })

    const res = await client.projects({ projectId: project.$id }).database.tables.get()

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    expect((res.data as PgTable[])[0]?.name).toBe('users')
  })

  test('GET /projects/:projectId/database/version gets postgres version', async () => {
    const project = await projectService.create({ name: 'Eden Version Test' })

    const res = await client.projects({ projectId: project.$id }).database.version.get()

    expect(res.status).toBe(200)
    expect((res.data as PgVersion).version).toBe('PostgreSQL 18.1')
  })

  test('returns 404 for unknown project', async () => {
    const res = await client
      .projects({ projectId: 'non-existent-proj' })
      .database.query.post({ query: 'SELECT 1;' })

    expect(res.status).toBe(404)
  })
})
