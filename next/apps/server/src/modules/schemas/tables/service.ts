import type { SQL } from 'bun'
import { BadRequestError, NotFoundError } from '../../../shared/errors'

export interface TableSelectOptions {
  schema: string
  table: string
  select?: string | string[]
  filter?: string | Record<string, unknown>
  order?: string
  limit?: number
  offset?: number
}

export interface TableCountOptions {
  schema: string
  table: string
  filter?: string | Record<string, unknown>
}

export interface TableRowOptions {
  schema: string
  table: string
  rowId: string | number
}

export interface TableInsertOptions {
  schema: string
  table: string
  input: Record<string, unknown> | Record<string, unknown>[]
  columns?: string[]
  onConflict?: string
  ignoreDuplicates?: boolean
  select?: string | string[]
}

export interface TableUpsertOptions {
  schema: string
  table: string
  input: Record<string, unknown> | Record<string, unknown>[]
  onConflict: string
  select?: string | string[]
}

export interface TableUpdateOptions {
  schema: string
  table: string
  input: Record<string, unknown>
  filter?: string | Record<string, unknown>
}

export interface TableUpdateRowOptions {
  schema: string
  table: string
  rowId: string | number
  input: Record<string, unknown>
}

export interface TableDeleteOptions {
  schema: string
  table: string
  filter?: string | Record<string, unknown>
}

export interface TableDeleteRowOptions {
  schema: string
  table: string
  rowId: string | number
}

export interface TableFunctionOptions {
  schema: string
  functionName: string
  args?: Record<string, unknown> | unknown[]
}

export function sanitizeIdentifier(identifier: string, label = 'identifier'): string {
  if (!identifier || typeof identifier !== 'string') {
    throw new BadRequestError(`Invalid ${label}: must be a non-empty string`, {
      code: 'table_invalid_identifier',
    })
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new BadRequestError(
      `Invalid ${label}: "${identifier}" contains disallowed characters. Only alphanumeric characters and underscores are allowed.`,
      { code: 'table_invalid_identifier' },
    )
  }
  return identifier
}

interface ParsedWhere {
  sql: string
  params: unknown[]
}

export function parseFilter(
  filter: string | Record<string, unknown> | undefined,
  startParamIndex = 1,
): ParsedWhere {
  if (!filter) return { sql: '', params: [] }

  const clauses: string[] = []
  const params: unknown[] = []
  let paramIdx = startParamIndex

  if (typeof filter === 'object' && filter !== null) {
    for (const [key, val] of Object.entries(filter)) {
      if (val === undefined) continue
      const col = sanitizeIdentifier(key, 'column')
      if (val === null) {
        clauses.push(`"${col}" IS NULL`)
      } else {
        clauses.push(`"${col}" = $${paramIdx++}`)
        params.push(val)
      }
    }
  } else if (typeof filter === 'string') {
    const rawClauses = filter
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    for (const raw of rawClauses) {
      // Support patterns: col.op(val), col.op.val, col.eq(val), col=eq.val
      const funcMatch = raw.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_]+)\((.*)\)$/)
      const dotMatch = raw.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_]+)\.(.*)$/)
      const eqMatch = raw.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=([a-zA-Z_]+)\.(.*)$/)

      if (funcMatch || dotMatch || eqMatch) {
        const match = funcMatch || dotMatch || eqMatch
        if (match?.[1] && match[2] && match[3] !== undefined) {
          const col = sanitizeIdentifier(match[1], 'column')
          const op = match[2].toLowerCase()
          const rawVal = match[3]

          switch (op) {
            case 'eq':
              clauses.push(`"${col}" = $${paramIdx++}`)
              params.push(rawVal)
              break
            case 'neq':
              clauses.push(`"${col}" <> $${paramIdx++}`)
              params.push(rawVal)
              break
            case 'gt':
              clauses.push(`"${col}" > $${paramIdx++}`)
              params.push(Number.isNaN(Number(rawVal)) ? rawVal : Number(rawVal))
              break
            case 'gte':
              clauses.push(`"${col}" >= $${paramIdx++}`)
              params.push(Number.isNaN(Number(rawVal)) ? rawVal : Number(rawVal))
              break
            case 'lt':
              clauses.push(`"${col}" < $${paramIdx++}`)
              params.push(Number.isNaN(Number(rawVal)) ? rawVal : Number(rawVal))
              break
            case 'lte':
              clauses.push(`"${col}" <= $${paramIdx++}`)
              params.push(Number.isNaN(Number(rawVal)) ? rawVal : Number(rawVal))
              break
            case 'like':
              clauses.push(`"${col}" LIKE $${paramIdx++}`)
              params.push(rawVal.replace(/\*/g, '%'))
              break
            case 'ilike':
              clauses.push(`"${col}" ILIKE $${paramIdx++}`)
              params.push(rawVal.replace(/\*/g, '%'))
              break
            case 'is':
              if (rawVal.toLowerCase() === 'null') {
                clauses.push(`"${col}" IS NULL`)
              } else {
                clauses.push(`"${col}" IS $${paramIdx++}`)
                params.push(rawVal)
              }
              break
            default:
              clauses.push(`"${col}" = $${paramIdx++}`)
              params.push(rawVal)
              break
          }
        }
      }
    }
  }

  if (clauses.length === 0) return { sql: '', params: [] }
  return {
    sql: `WHERE ${clauses.join(' AND ')}`,
    params,
  }
}

export class TablesService {
  constructor(private readonly getSql: () => SQL) {}

  async select(options: TableSelectOptions): Promise<unknown[]> {
    const schema = sanitizeIdentifier(options.schema, 'schema')
    const table = sanitizeIdentifier(options.table, 'table')

    let selectCols = '*'
    if (options.select) {
      const cols = Array.isArray(options.select)
        ? options.select
        : options.select
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
      if (cols.length > 0 && cols[0] !== '*') {
        selectCols = cols.map((c) => `"${sanitizeIdentifier(c, 'select column')}"`).join(', ')
      }
    }

    const { sql: whereClause, params } = parseFilter(options.filter, 1)

    let orderClause = ''
    if (options.order) {
      const parts = options.order
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      const orderItems: string[] = []
      for (const part of parts) {
        const [colName, dir = 'asc'] = part.split('.')
        if (!colName) continue
        const sanitizedCol = sanitizeIdentifier(colName, 'order column')
        const direction = dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC'
        orderItems.push(`"${sanitizedCol}" ${direction}`)
      }
      if (orderItems.length > 0) {
        orderClause = `ORDER BY ${orderItems.join(', ')}`
      }
    }

    const limit = Math.max(1, Math.min(500, Number(options.limit ?? 100)))
    const offset = Math.max(0, Number(options.offset ?? 0))

    const limitIdx = params.length + 1
    const offsetIdx = params.length + 2
    params.push(limit, offset)

    const query =
      `SELECT ${selectCols} FROM "${schema}"."${table}" ${whereClause} ${orderClause} LIMIT $${limitIdx} OFFSET $${offsetIdx}`.trim()
    const sql = this.getSql()
    return sql.unsafe(query, params)
  }

  async count(options: TableCountOptions): Promise<{ count: number }> {
    const schema = sanitizeIdentifier(options.schema, 'schema')
    const table = sanitizeIdentifier(options.table, 'table')

    const { sql: whereClause, params } = parseFilter(options.filter, 1)
    const query = `SELECT COUNT(*)::int AS count FROM "${schema}"."${table}" ${whereClause}`.trim()
    const sql = this.getSql()
    const rows = (await sql.unsafe(query, params)) as Array<{ count: number }>
    return { count: rows[0]?.count ?? 0 }
  }

  async getRow(options: TableRowOptions): Promise<unknown> {
    const schema = sanitizeIdentifier(options.schema, 'schema')
    const table = sanitizeIdentifier(options.table, 'table')

    const sql = this.getSql()
    const query = `SELECT * FROM "${schema}"."${table}" WHERE id::text = $1 OR _id::text = $1 LIMIT 1`
    const rows = (await sql.unsafe(query, [String(options.rowId)])) as unknown[]
    if (rows.length === 0) {
      throw new NotFoundError('Row', { code: 'table_row_not_found' })
    }
    return rows[0]
  }

  async insert(options: TableInsertOptions): Promise<unknown> {
    const schema = sanitizeIdentifier(options.schema, 'schema')
    const table = sanitizeIdentifier(options.table, 'table')

    const rawInput = options.input
    const isSingle = !Array.isArray(rawInput)
    const records = Array.isArray(rawInput) ? rawInput : [rawInput]
    const firstRecord = records[0]

    if (!firstRecord || Object.keys(firstRecord).length === 0) {
      throw new BadRequestError('Input data is required for insert operation', {
        code: 'table_input_required',
      })
    }

    const cols =
      options.columns && options.columns.length > 0
        ? options.columns.map((c) => sanitizeIdentifier(c, 'column'))
        : Object.keys(firstRecord).map((c) => sanitizeIdentifier(c, 'column'))

    const params: unknown[] = []
    const rowPlaceholders: string[] = []
    let pIdx = 1

    for (const record of records) {
      const placeholders: string[] = []
      for (const col of cols) {
        placeholders.push(`$${pIdx++}`)
        params.push(record[col] ?? null)
      }
      rowPlaceholders.push(`(${placeholders.join(', ')})`)
    }

    let onConflictClause = ''
    if (options.onConflict) {
      const conflictCol = sanitizeIdentifier(options.onConflict, 'onConflict column')
      if (options.ignoreDuplicates) {
        onConflictClause = `ON CONFLICT ("${conflictCol}") DO NOTHING`
      } else {
        const updateSets = cols
          .filter((c) => c !== conflictCol)
          .map((c) => `"${c}" = EXCLUDED."${c}"`)
        if (updateSets.length > 0) {
          onConflictClause = `ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateSets.join(', ')}`
        } else {
          onConflictClause = `ON CONFLICT ("${conflictCol}") DO NOTHING`
        }
      }
    }

    const query = `
      INSERT INTO "${schema}"."${table}" (${cols.map((c) => `"${c}"`).join(', ')})
      VALUES ${rowPlaceholders.join(', ')}
      ${onConflictClause}
      RETURNING *
    `
      .replace(/\s+/g, ' ')
      .trim()

    const sql = this.getSql()
    const result = (await sql.unsafe(query, params)) as unknown[]
    return isSingle ? result[0] : result
  }

  async upsert(options: TableUpsertOptions): Promise<unknown> {
    return this.insert({
      schema: options.schema,
      table: options.table,
      input: options.input,
      onConflict: options.onConflict,
      select: options.select,
    })
  }

  async update(options: TableUpdateOptions): Promise<unknown[]> {
    const schema = sanitizeIdentifier(options.schema, 'schema')
    const table = sanitizeIdentifier(options.table, 'table')

    const input = options.input
    const entries = Object.entries(input)
    if (entries.length === 0) {
      throw new BadRequestError('Input data is required for update operation', {
        code: 'table_input_required',
      })
    }

    const setClauses: string[] = []
    const params: unknown[] = []
    let pIdx = 1

    for (const [key, val] of entries) {
      const col = sanitizeIdentifier(key, 'column')
      setClauses.push(`"${col}" = $${pIdx++}`)
      params.push(val)
    }

    const { sql: whereClause, params: whereParams } = parseFilter(options.filter, pIdx)
    params.push(...whereParams)

    const query = `
      UPDATE "${schema}"."${table}"
      SET ${setClauses.join(', ')}
      ${whereClause}
      RETURNING *
    `
      .replace(/\s+/g, ' ')
      .trim()

    const sql = this.getSql()
    return (await sql.unsafe(query, params)) as unknown[]
  }

  async updateRow(options: TableUpdateRowOptions): Promise<unknown> {
    const schema = sanitizeIdentifier(options.schema, 'schema')
    const table = sanitizeIdentifier(options.table, 'table')

    const input = options.input
    const entries = Object.entries(input)
    if (entries.length === 0) {
      throw new BadRequestError('Input data is required for update operation', {
        code: 'table_input_required',
      })
    }

    const setClauses: string[] = []
    const params: unknown[] = []
    let pIdx = 1

    for (const [key, val] of entries) {
      const col = sanitizeIdentifier(key, 'column')
      setClauses.push(`"${col}" = $${pIdx++}`)
      params.push(val)
    }

    const rowIdParamIdx = pIdx
    params.push(String(options.rowId))

    const query = `
      UPDATE "${schema}"."${table}"
      SET ${setClauses.join(', ')}
      WHERE id::text = $${rowIdParamIdx} OR _id::text = $${rowIdParamIdx}
      RETURNING *
    `.trim()

    const sql = this.getSql()
    const rows = (await sql.unsafe(query, params)) as unknown[]
    if (rows.length === 0) {
      throw new NotFoundError('Row', { code: 'table_row_not_found' })
    }
    return rows[0]
  }

  async delete(options: TableDeleteOptions): Promise<{ deleted: number }> {
    const schema = sanitizeIdentifier(options.schema, 'schema')
    const table = sanitizeIdentifier(options.table, 'table')

    const { sql: whereClause, params } = parseFilter(options.filter, 1)
    const query = `DELETE FROM "${schema}"."${table}" ${whereClause} RETURNING *`.trim()

    const sql = this.getSql()
    const rows = (await sql.unsafe(query, params)) as unknown[]
    return { deleted: rows.length }
  }

  async deleteRow(options: TableDeleteRowOptions): Promise<{ success: boolean }> {
    const schema = sanitizeIdentifier(options.schema, 'schema')
    const table = sanitizeIdentifier(options.table, 'table')

    const query =
      `DELETE FROM "${schema}"."${table}" WHERE id::text = $1 OR _id::text = $1 RETURNING *`.trim()
    const sql = this.getSql()
    const rows = (await sql.unsafe(query, [String(options.rowId)])) as unknown[]
    if (rows.length === 0) {
      throw new NotFoundError('Row', { code: 'table_row_not_found' })
    }
    return { success: true }
  }

  async callFunction(options: TableFunctionOptions): Promise<unknown> {
    const schema = sanitizeIdentifier(options.schema, 'schema')
    const func = sanitizeIdentifier(options.functionName, 'function')

    const args = options.args
    const params: unknown[] = []
    let argsPlaceholders = ''

    if (Array.isArray(args)) {
      argsPlaceholders = args.map((_, i) => `$${i + 1}`).join(', ')
      params.push(...args)
    } else if (args && typeof args === 'object') {
      const entries = Object.entries(args)
      argsPlaceholders = entries
        .map(([k], i) => `${sanitizeIdentifier(k, 'argument')} := $${i + 1}`)
        .join(', ')
      params.push(...entries.map(([, v]) => v))
    }

    const query = `SELECT * FROM "${schema}"."${func}"(${argsPlaceholders})`.trim()
    const sql = this.getSql()
    try {
      return await sql.unsafe(query, params)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new BadRequestError(`Function execution failed: ${msg}`, {
        code: 'function_failed',
      })
    }
  }
}
