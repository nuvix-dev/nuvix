import { describe, expect, it } from 'bun:test'
import type { SQL } from 'bun'
import { BadRequestError, NotFoundError } from '../../../shared/errors'
import { parseFilter, sanitizeIdentifier, TablesService } from './service'

describe('TablesService - sanitizeIdentifier', () => {
  it('accepts valid SQL identifiers', () => {
    expect(sanitizeIdentifier('users')).toBe('users')
    expect(sanitizeIdentifier('_id')).toBe('_id')
    expect(sanitizeIdentifier('order_items_123')).toBe('order_items_123')
  })

  it('rejects identifiers with invalid characters or leading digits', () => {
    expect(() => sanitizeIdentifier('')).toThrow(BadRequestError)
    expect(() => sanitizeIdentifier('123users')).toThrow(BadRequestError)
    expect(() => sanitizeIdentifier('users; DROP TABLE users;')).toThrow(BadRequestError)
    expect(() => sanitizeIdentifier('users.name')).toThrow(BadRequestError)
    expect(() => sanitizeIdentifier('user-table')).toThrow(BadRequestError)
  })
})

describe('TablesService - parseFilter', () => {
  it('parses object filter into parameterized WHERE clause', () => {
    const { sql, params } = parseFilter({ status: 'active', age: 25 })
    expect(sql).toBe('WHERE "status" = $1 AND "age" = $2')
    expect(params).toEqual(['active', 25])
  })

  it('parses null in object filter as IS NULL', () => {
    const { sql, params } = parseFilter({ deleted_at: null })
    expect(sql).toBe('WHERE "deleted_at" IS NULL')
    expect(params).toEqual([])
  })

  it('parses string filter operators (eq, gte, like, is.null)', () => {
    const { sql, params } = parseFilter(
      'status.eq.active,age.gte.18,name.like.*smith*,archived.is.null',
    )
    expect(sql).toBe(
      'WHERE "status" = $1 AND "age" >= $2 AND "name" LIKE $3 AND "archived" IS NULL',
    )
    expect(params).toEqual(['active', 18, '%smith%'])
  })

  it('parses function-style filter (e.g. status.eq(active))', () => {
    const { sql, params } = parseFilter('status.eq(active),age.gt(21)')
    expect(sql).toBe('WHERE "status" = $1 AND "age" > $2')
    expect(params).toEqual(['active', 21])
  })

  it('returns empty string and params for undefined filter', () => {
    const { sql, params } = parseFilter(undefined)
    expect(sql).toBe('')
    expect(params).toEqual([])
  })
})

describe('TablesService - SQL Operations', () => {
  it('select builds parameterized query with order, limit, offset, and filter', async () => {
    let capturedQuery = ''
    let capturedParams: unknown[] = []

    const mockSql = {
      unsafe: async (q: string, p: unknown[]) => {
        capturedQuery = q
        capturedParams = p
        return [{ id: 1, name: 'Alice' }]
      },
    } as unknown as SQL

    const service = new TablesService(() => mockSql)

    const rows = await service.select({
      schema: 'public',
      table: 'users',
      select: 'id, name',
      filter: 'status.eq.active',
      order: 'id.desc',
      limit: 10,
      offset: 20,
    })

    expect(capturedQuery).toBe(
      'SELECT "id", "name" FROM "public"."users" WHERE "status" = $1 ORDER BY "id" DESC LIMIT $2 OFFSET $3',
    )
    expect(capturedParams).toEqual(['active', 10, 20])
    expect(rows).toEqual([{ id: 1, name: 'Alice' }])
  })

  it('count executes COUNT(*) query', async () => {
    let capturedQuery = ''

    const mockSql = {
      unsafe: async (q: string) => {
        capturedQuery = q
        return [{ count: 42 }]
      },
    } as unknown as SQL

    const service = new TablesService(() => mockSql)
    const result = await service.count({ schema: 'public', table: 'users' })

    expect(capturedQuery).toBe('SELECT COUNT(*)::int AS count FROM "public"."users"')
    expect(result).toEqual({ count: 42 })
  })

  it('getRow returns single row or throws NotFoundError', async () => {
    const mockSql = {
      unsafe: async (_q: string, p: unknown[]) => {
        if (p[0] === '1') return [{ id: 1, name: 'Alice' }]
        return []
      },
    } as unknown as SQL

    const service = new TablesService(() => mockSql)

    const row = await service.getRow({ schema: 'public', table: 'users', rowId: 1 })
    expect(row).toEqual({ id: 1, name: 'Alice' })

    await expect(service.getRow({ schema: 'public', table: 'users', rowId: 999 })).rejects.toThrow(
      NotFoundError,
    )
  })

  it('insert adds rows and returns result', async () => {
    let capturedQuery = ''
    let capturedParams: unknown[] = []

    const mockSql = {
      unsafe: async (q: string, p: unknown[]) => {
        capturedQuery = q
        capturedParams = p
        return [{ id: 1, name: 'Alice', age: 30 }]
      },
    } as unknown as SQL

    const service = new TablesService(() => mockSql)

    const inserted = await service.insert({
      schema: 'public',
      table: 'users',
      input: { name: 'Alice', age: 30 },
    })

    expect(capturedQuery).toContain(
      'INSERT INTO "public"."users" ("name", "age") VALUES ($1, $2) RETURNING *',
    )
    expect(capturedParams).toEqual(['Alice', 30])
    expect(inserted).toEqual({ id: 1, name: 'Alice', age: 30 })
  })

  it('insert with onConflict and ignoreDuplicates adds ON CONFLICT DO NOTHING', async () => {
    let capturedQuery = ''

    const mockSql = {
      unsafe: async (q: string) => {
        capturedQuery = q
        return [{ id: 1, email: 'a@example.com' }]
      },
    } as unknown as SQL

    const service = new TablesService(() => mockSql)

    await service.insert({
      schema: 'public',
      table: 'users',
      input: { email: 'a@example.com' },
      onConflict: 'email',
      ignoreDuplicates: true,
    })

    expect(capturedQuery).toContain('ON CONFLICT ("email") DO NOTHING')
  })

  it('update modifies rows matching filter', async () => {
    let capturedQuery = ''
    let capturedParams: unknown[] = []

    const mockSql = {
      unsafe: async (q: string, p: unknown[]) => {
        capturedQuery = q
        capturedParams = p
        return [{ id: 1, status: 'inactive' }]
      },
    } as unknown as SQL

    const service = new TablesService(() => mockSql)

    const updated = await service.update({
      schema: 'public',
      table: 'users',
      input: { status: 'inactive' },
      filter: 'id.eq.1',
    })

    expect(capturedQuery).toContain(
      'UPDATE "public"."users" SET "status" = $1 WHERE "id" = $2 RETURNING *',
    )
    expect(capturedParams).toEqual(['inactive', '1'])
    expect(updated).toEqual([{ id: 1, status: 'inactive' }])
  })

  it('delete removes rows matching filter', async () => {
    let capturedQuery = ''

    const mockSql = {
      unsafe: async (q: string) => {
        capturedQuery = q
        return [{ id: 1 }, { id: 2 }]
      },
    } as unknown as SQL

    const service = new TablesService(() => mockSql)

    const res = await service.delete({
      schema: 'public',
      table: 'users',
      filter: 'status.eq.deleted',
    })

    expect(capturedQuery).toBe('DELETE FROM "public"."users" WHERE "status" = $1 RETURNING *')
    expect(res).toEqual({ deleted: 2 })
  })

  it('callFunction executes stored procedure', async () => {
    let capturedQuery = ''
    let capturedParams: unknown[] = []

    const mockSql = {
      unsafe: async (q: string, p: unknown[]) => {
        capturedQuery = q
        capturedParams = p
        return [{ sum: 42 }]
      },
    } as unknown as SQL

    const service = new TablesService(() => mockSql)

    const result = await service.callFunction({
      schema: 'public',
      functionName: 'calculate_total',
      args: [10, 32],
    })

    expect(capturedQuery).toBe('SELECT * FROM "public"."calculate_total"($1, $2)')
    expect(capturedParams).toEqual([10, 32])
    expect(result).toEqual([{ sum: 42 }])
  })
})
