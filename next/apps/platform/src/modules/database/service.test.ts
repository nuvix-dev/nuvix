process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { FakeTenantProvisioner, TenantResourcePool } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import type { PgMeta, PgSchema, PgTable, PgVersion } from '@nuvix/pg-meta'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from '../projects/service'
import { DatabaseService } from './service'

let db: Database
let projectService: ProjectService
let databaseService: DatabaseService
let mockMeta: PgMeta

beforeAll(async () => {
  db = await createPlatformDatabase()
  projectService = new ProjectService(db, new FakeTenantProvisioner(), async () => {})

  mockMeta = {
    query: async (sql: string) => [{ result: 'ok', query: sql }],
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
      createSql: () => ({ close: async () => {} }) as unknown as import('bun').SQL,
      createDatabase: () => ({}) as unknown as Database,
      createPgMeta: () => mockMeta,
    },
  })

  databaseService = new DatabaseService(db, pool)
})

describe('DatabaseService', () => {
  test('executes raw query on tenant database', async () => {
    const project = await projectService.create({ name: 'DB Test Project' })
    const rows = await databaseService.query(project.$id, 'SELECT 1;')
    expect(rows).toEqual([{ result: 'ok', query: 'SELECT 1;' }])
  })

  test('throws BadRequestError when query is empty', async () => {
    const project = await projectService.create({ name: 'DB Empty Query Test' })
    await expect(databaseService.query(project.$id, '   ')).rejects.toThrow(
      'Query must not be empty',
    )
  })

  test('lists schemas and retrieves single schema', async () => {
    const project = await projectService.create({ name: 'DB Schemas Test' })
    const schemas = await databaseService.listSchemas(project.$id)
    expect(schemas).toHaveLength(1)
    expect(schemas[0]?.name).toBe('public')

    const schemaByName = await databaseService.getSchema(project.$id, 'public')
    expect(schemaByName.id).toBe(1)

    const schemaById = await databaseService.getSchema(project.$id, 1)
    expect(schemaById.name).toBe('public')
  })

  test('lists tables and retrieves single table', async () => {
    const project = await projectService.create({ name: 'DB Tables Test' })
    const tables = await databaseService.listTables(project.$id)
    expect(tables).toHaveLength(1)
    expect(tables[0]?.name).toBe('users')

    const table = await databaseService.getTable(project.$id, 10)
    expect(table.name).toBe('users')
  })

  test('gets postgres version info', async () => {
    const project = await projectService.create({ name: 'DB Version Test' })
    const ver = await databaseService.getVersion(project.$id)
    expect(ver.version).toBe('PostgreSQL 18.1')
    expect(ver.version_number).toBe(180001)
  })

  test('throws NotFoundError for non-existent project', async () => {
    await expect(databaseService.query('unknown-id', 'SELECT 1;')).rejects.toThrow(
      'Project not found',
    )
  })
})
