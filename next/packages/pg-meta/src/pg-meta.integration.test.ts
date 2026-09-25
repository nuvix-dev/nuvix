import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { SQL } from 'bun'
import { PgMeta } from './pg-meta'

describe('PgMeta live integration tests', () => {
  let sql: SQL
  let meta: PgMeta
  let isDbAvailable = false

  beforeAll(async () => {
    try {
      sql = new SQL('postgres://postgres:postgres@localhost:5432/postgres')
      await sql.unsafe('SELECT 1')
      isDbAvailable = true
      meta = new PgMeta(sql)
    } catch {
      isDbAvailable = false
    }
  })

  afterAll(async () => {
    if (sql) {
      await sql.close()
    }
  })

  it('retrieves live version info', async () => {
    if (!isDbAvailable) return
    const version = await meta.version.get()
    expect(version.version).toContain('PostgreSQL')
    expect(typeof version.version_number).toBe('number')
    expect(version.version_number).toBeGreaterThan(0)
    expect(typeof version.active_connections).toBe('number')
    expect(typeof version.max_connections).toBe('number')
  })

  it('lists live schemas including and excluding system schemas', async () => {
    if (!isDbAvailable) return
    const allSchemas = await meta.schemas.list({ includeSystemSchemas: true })
    expect(allSchemas.length).toBeGreaterThan(0)
    const schemaNames = allSchemas.map((s) => s.name)
    expect(schemaNames).toContain('public')
    expect(schemaNames).toContain('pg_catalog')

    const userSchemas = await meta.schemas.list({ includeSystemSchemas: false })
    const userNames = userSchemas.map((s) => s.name)
    expect(userNames).toContain('public')
    expect(userNames).not.toContain('pg_catalog')
  })

  it('retrieves a live schema by name and id', async () => {
    if (!isDbAvailable) return
    const pub = await meta.schemas.retrieve({ name: 'public' })
    expect(pub).not.toBeNull()
    expect(pub?.name).toBe('public')

    if (pub) {
      const byId = await meta.schemas.retrieve({ id: pub.id })
      expect(byId?.name).toBe('public')
    }
  })

  it('lists live tables and columns', async () => {
    if (!isDbAvailable) return
    const tables = await meta.tables.list({
      includeSystemSchemas: true,
      includeColumns: true,
      limit: 5,
    })
    expect(tables.length).toBeGreaterThan(0)
    expect(tables[0]?.columns).toBeDefined()
    expect(Array.isArray(tables[0]?.columns)).toBe(true)
  })

  it('lists live indexes, functions, roles, extensions, views, and config', async () => {
    if (!isDbAvailable) return
    const [indexes, functions, roles, extensions, views, config] = await Promise.all([
      meta.indexes.list({ includeSystemSchemas: true, limit: 5 }),
      meta.functions.list({ includeSystemSchemas: true, limit: 5 }),
      meta.roles.list({ limit: 5 }),
      meta.extensions.list({ limit: 5 }),
      meta.views.list({ includeSystemSchemas: true, limit: 5 }),
      meta.config.list(),
    ])

    expect(indexes.length).toBeGreaterThan(0)
    expect(functions.length).toBeGreaterThan(0)
    expect(roles.length).toBeGreaterThan(0)
    expect(extensions.length).toBeGreaterThan(0)
    expect(views.length).toBeGreaterThan(0)
    expect(config.length).toBeGreaterThan(0)
  })
})
