import { describe, expect, it } from 'bun:test'
import type { SQL } from 'bun'
import { PgMeta } from './pg-meta'

describe('PgMeta unit tests', () => {
  it('instantiates all resource properties and routes query to sql.unsafe', async () => {
    let capturedQuery = ''
    const mockSql = {
      unsafe: async (q: string) => {
        capturedQuery = q
        return [{ id: 1, name: 'public' }]
      },
    } as unknown as SQL

    const meta = new PgMeta(mockSql)

    expect(meta.schemas).toBeDefined()
    expect(meta.tables).toBeDefined()
    expect(meta.columns).toBeDefined()
    expect(meta.indexes).toBeDefined()
    expect(meta.functions).toBeDefined()
    expect(meta.roles).toBeDefined()
    expect(meta.extensions).toBeDefined()
    expect(meta.views).toBeDefined()
    expect(meta.triggers).toBeDefined()
    expect(meta.types).toBeDefined()
    expect(meta.policies).toBeDefined()
    expect(meta.version).toBeDefined()
    expect(meta.config).toBeDefined()

    const raw = await meta.query('SELECT 1')
    expect(capturedQuery).toBe('SELECT 1')
    expect(raw).toEqual([{ id: 1, name: 'public' }])
  })

  it('generates schemas list queries with inclusion/exclusion filters', async () => {
    let capturedQuery = ''
    const mockSql = {
      unsafe: async (q: string) => {
        capturedQuery = q
        return [{ id: 1, name: 'appdata', owner: 'postgres' }]
      },
    } as unknown as SQL

    const meta = new PgMeta(mockSql)
    const res = await meta.schemas.list({
      includeSystemSchemas: false,
      limit: 10,
      offset: 5,
    })

    expect(res).toHaveLength(1)
    expect(capturedQuery).toContain('WITH schemas AS')
    expect(capturedQuery).toContain("NOT IN ('information_schema', 'pg_catalog', 'pg_toast')")
    expect(capturedQuery).toContain('LIMIT 10')
    expect(capturedQuery).toContain('OFFSET 5')
  })

  it('generates schemas retrieve query by id and name', async () => {
    let capturedQuery = ''
    const mockSql = {
      unsafe: async (q: string) => {
        capturedQuery = q
        return [{ id: 42, name: 'public', owner: 'postgres' }]
      },
    } as unknown as SQL

    const meta = new PgMeta(mockSql)
    const byId = await meta.schemas.retrieve({ id: 42 })
    expect(byId).toEqual({ id: 42, name: 'public', owner: 'postgres' })
    expect(capturedQuery).toContain('id = 42')

    const byName = await meta.schemas.retrieve({ name: 'public' })
    expect(byName).toEqual({ id: 42, name: 'public', owner: 'postgres' })
    expect(capturedQuery).toContain("name = 'public'")
  })

  it('generates tables query with and without columns enrichment', async () => {
    let capturedQuery = ''
    const mockSql = {
      unsafe: async (q: string) => {
        capturedQuery = q
        return [{ id: 100, name: 'users', schema: 'public' }]
      },
    } as unknown as SQL

    const meta = new PgMeta(mockSql)

    await meta.tables.list({ includeColumns: false })
    expect(capturedQuery).not.toContain('columns AS')

    await meta.tables.list({ includeColumns: true, includedSchemas: ['public'] })
    expect(capturedQuery).toContain('columns AS')
    expect(capturedQuery).toContain('coalesce')
    expect(capturedQuery).toContain("schema IN ('public')")

    await meta.tables.retrieve({ id: 100, includeColumns: true })
    expect(capturedQuery).toContain('tables.id = 100')
  })

  it('generates columns query with tableId and pagination', async () => {
    let capturedQuery = ''
    const mockSql = {
      unsafe: async (q: string) => {
        capturedQuery = q
        return []
      },
    } as unknown as SQL

    const meta = new PgMeta(mockSql)
    await meta.columns.list({ tableId: 200, limit: 20 })
    expect(capturedQuery).toContain('table_id = 200')
    expect(capturedQuery).toContain('LIMIT 20')
  })

  it('parses version fields into numbers', async () => {
    const mockSql = {
      unsafe: async () => [
        {
          version: 'PostgreSQL 18.1',
          version_number: '180001',
          active_connections: '5',
          max_connections: '100',
        },
      ],
    } as unknown as SQL

    const meta = new PgMeta(mockSql)
    const ver = await meta.version.get()
    expect(ver.version).toBe('PostgreSQL 18.1')
    expect(ver.version_number).toBe(180001)
    expect(ver.active_connections).toBe(5)
    expect(ver.max_connections).toBe(100)
  })
})
