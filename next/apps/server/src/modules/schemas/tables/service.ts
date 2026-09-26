import type { TenantResource } from '@nuvix/core/tenants'
import { Database, Doc, PermissionsValidator, PermissionType } from '@nuvix/db'
import { createDatabase as createPgDatabase, type DatabaseFacade } from '@nuvix/pg'
import { transformPgError } from '@nuvix/utils/database'
import {
  ASTToQueryBuilder,
  type Expression,
  OrderParser,
  type ParsedOrdering,
  Parser,
  type SelectNode,
  SelectParser,
} from '@nuvix/utils/query'
import type { SQL } from 'bun'
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../shared/errors'

export interface RequestContext {
  method?: string
  url?: string
  id?: string
  headers?: Record<string, string | undefined>
  ip?: string
  user?: any
  session?: any
  roles?: string[]
  allowedSchemas?: string[]
}

export interface TableSelectOptions {
  schema: string
  table: string
  select?: string | SelectNode[]
  filter?: string | Expression
  order?: string | ParsedOrdering[]
  limit?: number
  offset?: number
  context?: RequestContext
}

export interface TableCountOptions {
  schema: string
  table: string
  filter?: string | Expression
  context?: RequestContext
}

export interface TableRowOptions {
  schema: string
  table: string
  rowId: string | number
  select?: string | SelectNode[]
  filter?: string | Expression
  context?: RequestContext
}

export interface TableInsertOptions {
  schema: string
  table: string
  input: Record<string, unknown> | Record<string, unknown>[]
  columns?: string[]
  onConflict?: string | string[]
  ignoreDuplicates?: boolean
  select?: string | SelectNode[]
  context?: RequestContext
}

export interface TableUpsertOptions {
  schema: string
  table: string
  input: Record<string, unknown> | Record<string, unknown>[]
  columns?: string[]
  onConflict?: string | string[]
  select?: string | SelectNode[]
  context?: RequestContext
}

export interface TableUpdateOptions {
  schema: string
  table: string
  input: Record<string, unknown>
  filter?: string | Expression
  columns?: string[]
  select?: string | SelectNode[]
  order?: string | ParsedOrdering[]
  limit?: number
  offset?: number
  force?: boolean
  context?: RequestContext
}

export interface TableUpdateRowOptions {
  schema: string
  table: string
  rowId: string | number
  input: Record<string, unknown>
  filter?: string | Expression
  select?: string | SelectNode[]
  context?: RequestContext
}

export interface TableDeleteOptions {
  schema: string
  table: string
  filter?: string | Expression
  select?: string | SelectNode[]
  order?: string | ParsedOrdering[]
  limit?: number
  offset?: number
  force?: boolean
  context?: RequestContext
}

export interface TableDeleteRowOptions {
  schema: string
  table: string
  rowId: string | number
  filter?: string | Expression
  select?: string | SelectNode[]
  context?: RequestContext
}

export interface TableFunctionOptions {
  schema: string
  functionName: string
  args?: Record<string, unknown> | unknown[]
  select?: string | SelectNode[]
  filter?: string | Expression
  order?: string | ParsedOrdering[]
  limit?: number
  offset?: number
  context?: RequestContext
}

export interface TablePermissionsOptions {
  schema: string
  tableId: string
  rowId?: string | number
}

export interface TableUpdatePermissionsOptions {
  schema: string
  tableId: string
  rowId?: string | number
  permissions: string[]
}

export type SqlProvider =
  | SQL
  | (() => SQL | undefined)
  | TenantResource
  | (() => TenantResource | undefined)

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

export interface ParsedWhere {
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
              params.push(rawVal.replaceAll('*', '%'))
              break
            case 'ilike':
              clauses.push(`"${col}" ILIKE $${paramIdx++}`)
              params.push(rawVal.replaceAll('*', '%'))
              break
            case 'is':
              if (rawVal.toLowerCase() === 'null') {
                clauses.push(`"${col}" IS NULL`)
              } else if (rawVal.toLowerCase() === 'not_null') {
                clauses.push(`"${col}" IS NOT NULL`)
              }
              break
          }
        }
      }
    }
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  }
}

export class TablesService {
  private static readonly DEFAULT_LIMIT = 500

  constructor(private readonly resourceOrGetter?: SqlProvider) {}

  private getDb(): DatabaseFacade {
    if (!this.resourceOrGetter) {
      throw new BadRequestError('Tenant database connection is not available', {
        code: 'tenant_database_unavailable',
      })
    }
    const res =
      typeof this.resourceOrGetter === 'function' && !('unsafe' in this.resourceOrGetter)
        ? (this.resourceOrGetter as () => SQL | TenantResource | undefined)()
        : this.resourceOrGetter

    if (!res) {
      throw new BadRequestError('Tenant database connection is not available', {
        code: 'tenant_database_unavailable',
      })
    }

    if (typeof (res as any).pg === 'function') {
      return (res as any).pg()
    }

    if (typeof (res as any).getSql === 'function') {
      return createPgDatabase((res as any).getSql())
    }

    return createPgDatabase(res as any)
  }

  private async applyRlsContext(txDb: DatabaseFacade, context: RequestContext): Promise<void> {
    const roles = context.roles ?? []
    const user = context.user
    const session = context.session

    const userEmpty = !user || (typeof user.empty === 'function' && user.empty())
    const role = userEmpty ? 'anon' : 'authenticated'

    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(context.headers ?? {})) {
      if (v != null) headers[k.toLowerCase()] = String(v)
    }

    const userPayload =
      !userEmpty && user
        ? JSON.stringify({
            id: typeof user.getId === 'function' ? user.getId() : user.id,
            name: typeof user.get === 'function' ? user.get('name') : user.name,
            email: typeof user.get === 'function' ? user.get('email') : user.email,
          })
        : ''

    const sessionPayload = session
      ? JSON.stringify({
          id: typeof session.getId === 'function' ? session.getId() : session.id,
          userId: typeof session.get === 'function' ? session.get('userId') : session.userId,
          provider: typeof session.get === 'function' ? session.get('provider') : session.provider,
          ip: typeof session.get === 'function' ? session.get('ip') : session.ip,
          userAgent:
            typeof session.get === 'function' ? session.get('userAgent') : session.userAgent,
        })
      : ''

    const roleLiteral =
      roles.length > 0 ? `{${roles.map((r) => `"${r.replace(/"/g, '\\"')}"`).join(',')}}` : '{}'

    await txDb
      .raw(
        `SELECT
          set_config('role', ?, true),
          set_config('request.method', ?, true),
          set_config('request.path', ?, true),
          set_config('request.id', ?, true),
          set_config('request.headers', ?, true),
          set_config('request.ip', ?, true),
          set_config('request.auth.user', ?, true),
          set_config('request.auth.session', ?, true),
          set_config('request.auth.roles', ?, true)`,
        [
          role,
          (context.method ?? 'GET').toUpperCase(),
          context.url ?? '',
          context.id ?? '',
          JSON.stringify(headers),
          context.ip ?? '',
          userPayload,
          sessionPayload,
          roleLiteral,
        ],
      )
      .execute()
  }

  private handlePgError(err: unknown): never {
    const error = transformPgError(err)
    if (error) {
      if (error.status === 404) {
        throw new NotFoundError(error.message, { code: error.type })
      }
      if (error.status === 403) {
        throw new ForbiddenError(error.message, { code: error.type })
      }
      if (error.status === 400 || error.status === 409 || error.status === 422) {
        throw new BadRequestError(error.message, { code: error.type })
      }
    }
    if (err instanceof Error) {
      throw err
    }
    throw new BadRequestError(String(err), { code: 'database_error' })
  }

  private async handleQuery<T>(
    db: DatabaseFacade,
    callback: (txDb: DatabaseFacade) => Promise<T>,
    context?: RequestContext,
  ): Promise<T> {
    const run = async (txDb: DatabaseFacade): Promise<T> => {
      if (context) {
        await this.applyRlsContext(txDb, context)
      }
      return callback(txDb)
    }

    try {
      if (
        typeof (db as any).sql?.begin === 'function' ||
        (db as any).transactionOwner !== undefined
      ) {
        return await (db as any).transaction(run as any)
      }
      return await run(db)
    } catch (err: unknown) {
      this.handlePgError(err)
    }
  }

  async select({
    schema,
    table,
    select,
    filter,
    order,
    limit,
    offset,
    context,
  }: TableSelectOptions) {
    sanitizeIdentifier(table, 'table')
    sanitizeIdentifier(schema, 'schema')
    const db = this.getDb()
    const allowedSchemas = context?.allowedSchemas

    return this.handleQuery(
      db,
      async (txDb) => {
        let qb = txDb.table(table).withSchema(schema)
        const ast = new ASTToQueryBuilder(qb, txDb, {
          allowedSchemas,
          tableName: table,
        })

        if (select) {
          const selectNodes =
            typeof select === 'string'
              ? new SelectParser({ tableName: table }).parse(select)
              : select
          qb = ast.applySelect(selectNodes)
        }

        if (filter) {
          const parsedFilter =
            typeof filter === 'string' ? Parser.create({ tableName: table }).parse(filter) : filter
          qb = ast.applyFilters(parsedFilter as any, {
            applyExtra: true,
            tableName: table,
          })
        }

        if (order) {
          const parsedOrder = typeof order === 'string' ? OrderParser.parse(order, table) : order
          qb = ast.applyOrder(parsedOrder, table)
        }

        qb = ast.applyLimitOffset({
          limit: limit ?? (filter as any)?.limit ?? TablesService.DEFAULT_LIMIT,
          offset: offset ?? (filter as any)?.offset ?? 0,
        })

        return qb.execute()
      },
      context,
    )
  }

  async count({ schema, table, filter, context }: TableCountOptions): Promise<{ count: number }> {
    sanitizeIdentifier(table, 'table')
    sanitizeIdentifier(schema, 'schema')
    const db = this.getDb()
    const allowedSchemas = context?.allowedSchemas

    return this.handleQuery(
      db,
      async (txDb) => {
        let qb = txDb.table(table).withSchema(schema)
        const ast = new ASTToQueryBuilder(qb, txDb, {
          allowedSchemas,
          tableName: table,
        })

        if (filter) {
          const parsedFilter =
            typeof filter === 'string' ? Parser.create({ tableName: table }).parse(filter) : filter
          qb = ast.applyFilters(parsedFilter as any, {
            applyExtra: false,
            tableName: table,
          })
        }

        qb = qb.count('*', 'count')
        const result = (await qb.execute()) as Array<{ count: string | number }>
        return { count: Number(result?.[0]?.count ?? 0) }
      },
      context,
    )
  }

  async getRow({ schema, table, rowId, select, filter, context }: TableRowOptions) {
    sanitizeIdentifier(table, 'table')
    sanitizeIdentifier(schema, 'schema')
    const db = this.getDb()
    const allowedSchemas = context?.allowedSchemas

    return this.handleQuery(
      db,
      async (txDb) => {
        let qb = txDb.table(table).withSchema(schema)
        const ast = new ASTToQueryBuilder(qb, txDb, {
          allowedSchemas,
          tableName: table,
        })

        if (select) {
          const selectNodes =
            typeof select === 'string'
              ? new SelectParser({ tableName: table }).parse(select)
              : select
          qb = ast.applySelect(selectNodes)
        }

        if (filter) {
          const parsedFilter =
            typeof filter === 'string' ? Parser.create({ tableName: table }).parse(filter) : filter
          qb = ast.applyFilters(parsedFilter as any, {
            applyExtra: false,
            tableName: table,
          })
        }

        qb = qb.whereRaw('("id"::text = ? OR "_id"::text = ?)', [String(rowId), String(rowId)])
        qb = qb.limit(1)

        const rows = (await qb.execute()) as unknown[]
        if (!rows || rows.length === 0) {
          throw new NotFoundError('Row', { code: 'table_row_not_found' })
        }
        return rows[0]
      },
      context,
    )
  }

  async insert({
    schema,
    table,
    input,
    columns,
    onConflict,
    ignoreDuplicates,
    select,
    context,
  }: TableInsertOptions) {
    sanitizeIdentifier(table, 'table')
    sanitizeIdentifier(schema, 'schema')
    if (!input || (Array.isArray(input) && input.length === 0)) {
      throw new BadRequestError('Input data is required for insert operation', {
        code: 'table_invalid_input',
      })
    }
    const db = this.getDb()
    const allowedSchemas = context?.allowedSchemas

    let data: Record<string, unknown> | Record<string, unknown>[]
    if (columns?.length) {
      if (Array.isArray(input)) {
        data = input.map((record) =>
          columns.reduce(
            (acc, col) => {
              acc[col] = record[col]
              return acc
            },
            {} as Record<string, unknown>,
          ),
        )
      } else {
        data = columns.reduce(
          (acc, col) => {
            acc[col] = input[col]
            return acc
          },
          {} as Record<string, unknown>,
        )
      }
    } else {
      data = input
    }

    return this.handleQuery(
      db,
      async (txDb) => {
        let qb: any = txDb.table(table).withSchema(schema)
        qb = qb.insert(data as any)

        if (onConflict) {
          const conflictCols = Array.isArray(onConflict) ? onConflict : [onConflict]
          if (ignoreDuplicates) {
            qb = qb.onConflict(conflictCols as any).ignore()
          } else {
            qb = qb.onConflict(conflictCols as any).merge()
          }
        }

        const ast = new ASTToQueryBuilder(qb, txDb, {
          allowedSchemas,
          tableName: table,
        })
        const selectNodes = select
          ? typeof select === 'string'
            ? new SelectParser({ tableName: table }).parse(select)
            : select
          : []
        qb = ast.applyReturning(selectNodes, qb)

        const result = await qb.execute()
        if (Array.isArray(input)) {
          return result
        }
        return Array.isArray(result) ? result[0] : result
      },
      context,
    )
  }

  async upsert({ schema, table, input, columns, onConflict, select, context }: TableUpsertOptions) {
    return this.insert({
      schema,
      table,
      input,
      columns,
      onConflict,
      ignoreDuplicates: !onConflict || onConflict.length === 0,
      select,
      context,
    })
  }

  async update({
    schema,
    table,
    input,
    filter,
    columns,
    select,
    order,
    limit,
    offset,
    force,
    context,
  }: TableUpdateOptions) {
    sanitizeIdentifier(table, 'table')
    sanitizeIdentifier(schema, 'schema')
    if (!input || Object.keys(input).length === 0) {
      throw new BadRequestError('Input data is required for update operation', {
        code: 'table_invalid_input',
      })
    }
    const db = this.getDb()
    const allowedSchemas = context?.allowedSchemas

    let data = input
    if (columns?.length) {
      data = columns.reduce(
        (acc, col) => {
          acc[col] = input[col]
          return acc
        },
        {} as Record<string, unknown>,
      )
    }

    return this.handleQuery(
      db,
      async (txDb) => {
        let qb: any = txDb.table(table).withSchema(schema)
        const ast = new ASTToQueryBuilder(qb, txDb, {
          allowedSchemas,
          tableName: table,
        })

        const parsedFilter = filter
          ? typeof filter === 'string'
            ? Parser.create({ tableName: table }).parse(filter)
            : filter
          : undefined

        qb = ast.applyFilters(parsedFilter as any, {
          applyExtra: true,
          tableName: table,
          throwOnEmpty: !force,
          throwOnEmptyError: new BadRequestError(
            'you must provide a filter to update data or use &force=true',
            { code: 'table_filter_required' },
          ),
        })

        if (order) {
          const parsedOrder = typeof order === 'string' ? OrderParser.parse(order, table) : order
          qb = ast.applyOrder(parsedOrder, table)
        }

        qb = ast.applyLimitOffset({ limit, offset })
        qb = qb.update(data as any)

        const selectNodes = select
          ? typeof select === 'string'
            ? new SelectParser({ tableName: table }).parse(select)
            : select
          : []
        qb = ast.applyReturning(selectNodes, qb)

        return qb.execute()
      },
      context,
    )
  }

  async updateRow({ schema, table, rowId, input, filter, select, context }: TableUpdateRowOptions) {
    sanitizeIdentifier(table, 'table')
    sanitizeIdentifier(schema, 'schema')
    if (!input || Object.keys(input).length === 0) {
      throw new BadRequestError('Input data is required for update operation', {
        code: 'table_invalid_input',
      })
    }
    const db = this.getDb()
    const allowedSchemas = context?.allowedSchemas

    return this.handleQuery(
      db,
      async (txDb) => {
        let qb: any = txDb.table(table).withSchema(schema)
        const ast = new ASTToQueryBuilder(qb, txDb, {
          allowedSchemas,
          tableName: table,
        })

        if (filter) {
          const parsedFilter =
            typeof filter === 'string' ? Parser.create({ tableName: table }).parse(filter) : filter
          qb = ast.applyFilters(parsedFilter as any, {
            applyExtra: false,
            tableName: table,
          })
        }

        qb = qb.whereRaw('("id"::text = ? OR "_id"::text = ?)', [String(rowId), String(rowId)])
        qb = qb.update(input as any)

        const selectNodes = select
          ? typeof select === 'string'
            ? new SelectParser({ tableName: table }).parse(select)
            : select
          : []
        qb = ast.applyReturning(selectNodes, qb)

        const rows = (await qb.execute()) as unknown[]
        if (!rows || rows.length === 0) {
          throw new NotFoundError('Row', { code: 'table_row_not_found' })
        }
        return rows[0]
      },
      context,
    )
  }

  async delete({
    schema,
    table,
    filter,
    select,
    order,
    limit,
    offset,
    force,
    context,
  }: TableDeleteOptions) {
    sanitizeIdentifier(table, 'table')
    sanitizeIdentifier(schema, 'schema')
    const db = this.getDb()
    const allowedSchemas = context?.allowedSchemas

    return this.handleQuery(
      db,
      async (txDb) => {
        let qb: any = txDb.table(table).withSchema(schema)
        const ast = new ASTToQueryBuilder(qb, txDb, {
          allowedSchemas,
          tableName: table,
        })

        const parsedFilter = filter
          ? typeof filter === 'string'
            ? Parser.create({ tableName: table }).parse(filter)
            : filter
          : undefined

        qb = ast.applyFilters(parsedFilter as any, {
          applyExtra: true,
          tableName: table,
          throwOnEmpty: !force,
          throwOnEmptyError: new BadRequestError(
            'you must provide a filter to delete data or use &force=true',
            { code: 'table_filter_required' },
          ),
        })

        if (order) {
          const parsedOrder = typeof order === 'string' ? OrderParser.parse(order, table) : order
          qb = ast.applyOrder(parsedOrder, table)
        }

        qb = ast.applyLimitOffset({ limit, offset })
        qb = qb.delete()

        const selectNodes = select
          ? typeof select === 'string'
            ? new SelectParser({ tableName: table }).parse(select)
            : select
          : []
        qb = ast.applyReturning(selectNodes, qb)

        const result = (await qb.execute()) as unknown[]
        return { deleted: Array.isArray(result) ? result.length : 1 }
      },
      context,
    )
  }

  async deleteRow({ schema, table, rowId, filter, select, context }: TableDeleteRowOptions) {
    sanitizeIdentifier(table, 'table')
    sanitizeIdentifier(schema, 'schema')
    const db = this.getDb()
    const allowedSchemas = context?.allowedSchemas

    return this.handleQuery(
      db,
      async (txDb) => {
        let qb: any = txDb.table(table).withSchema(schema)
        const ast = new ASTToQueryBuilder(qb, txDb, {
          allowedSchemas,
          tableName: table,
        })

        if (filter) {
          const parsedFilter =
            typeof filter === 'string' ? Parser.create({ tableName: table }).parse(filter) : filter
          qb = ast.applyFilters(parsedFilter as any, {
            applyExtra: false,
            tableName: table,
          })
        }

        qb = qb.whereRaw('("id"::text = ? OR "_id"::text = ?)', [String(rowId), String(rowId)])
        qb = qb.delete()

        const selectNodes = select
          ? typeof select === 'string'
            ? new SelectParser({ tableName: table }).parse(select)
            : select
          : []
        qb = ast.applyReturning(selectNodes, qb)

        const rows = (await qb.execute()) as unknown[]
        if (!rows || rows.length === 0) {
          throw new NotFoundError('Row', { code: 'table_row_not_found' })
        }
        return { deleted: rows.length }
      },
      context,
    )
  }

  async callFunction({
    schema,
    functionName,
    args,
    select,
    filter,
    order,
    limit,
    offset,
    context,
  }: TableFunctionOptions) {
    sanitizeIdentifier(functionName, 'functionName')
    sanitizeIdentifier(schema, 'schema')
    const db = this.getDb()

    return this.handleQuery(
      db,
      async (txDb) => {
        let callSql: string
        const bindings: unknown[] = []

        if (Array.isArray(args)) {
          const placeholders = args.map((arg) => {
            bindings.push(arg)
            return '?'
          })
          callSql = `"${schema}"."${functionName}"(${placeholders.join(', ')})`
        } else if (args && typeof args === 'object') {
          const parts: string[] = []
          for (const [k, v] of Object.entries(args)) {
            const safeKey = sanitizeIdentifier(k, 'parameter')
            parts.push(`"${safeKey}" := ?`)
            bindings.push(v)
          }
          callSql = `"${schema}"."${functionName}"(${parts.join(', ')})`
        } else {
          callSql = `"${schema}"."${functionName}"()`
        }

        let qb: any = (txDb as any).table(txDb.raw(callSql, bindings))
        const ast = new ASTToQueryBuilder(qb, txDb, { tableName: functionName })

        if (select) {
          const selectNodes =
            typeof select === 'string'
              ? new SelectParser({ tableName: functionName }).parse(select)
              : select
          qb = ast.applySelect(selectNodes)
        }

        if (filter) {
          const parsedFilter =
            typeof filter === 'string'
              ? Parser.create({ tableName: functionName }).parse(filter)
              : filter
          qb = ast.applyFilters(parsedFilter as any, {
            applyExtra: true,
            tableName: functionName,
          })
        }

        if (order) {
          const parsedOrder =
            typeof order === 'string' ? OrderParser.parse(order, functionName) : order
          qb = ast.applyOrder(parsedOrder, functionName)
        }

        qb = ast.applyLimitOffset({ limit, offset })
        const result = (await qb.execute()) as unknown[]

        if (
          Array.isArray(result) &&
          result.length === 1 &&
          typeof result[0] === 'object' &&
          result[0] !== null &&
          functionName in result[0] &&
          Object.keys(result[0]).length === 1
        ) {
          return (result[0] as Record<string, unknown>)[functionName]
        }
        return result
      },
      context,
    )
  }

  async getPermissions({ schema, tableId, rowId }: TablePermissionsOptions): Promise<string[]> {
    sanitizeIdentifier(tableId, 'tableId')
    sanitizeIdentifier(schema, 'schema')
    const db = this.getDb()
    const permsTable = `${tableId}_perms`

    let qb = db.table(permsTable).withSchema(schema).select('permission', 'roles')
    if (rowId !== undefined && rowId !== null) {
      qb = qb.where('row_id', '=', rowId)
    } else {
      qb = qb.whereNull('row_id')
    }

    const rows = (await qb.execute()) as Array<{
      permission: string
      roles: string[]
    }>
    const result: string[] = []

    for (const row of rows) {
      const type = row.permission
      const perms = Array.isArray(row.roles) ? row.roles : []
      for (const p of perms) {
        result.push(`${type}("${p}")`)
      }
    }
    return result
  }

  async updatePermissions({
    schema,
    tableId,
    rowId,
    permissions,
  }: TableUpdatePermissionsOptions): Promise<string[]> {
    sanitizeIdentifier(tableId, 'tableId')
    sanitizeIdentifier(schema, 'schema')

    const allowed = [PermissionType.Read, PermissionType.Update, PermissionType.Delete]
    if (rowId === undefined || rowId === null) {
      allowed.push(PermissionType.Create)
    }

    const validator = new PermissionsValidator(undefined, allowed)
    if (!validator.$valid(permissions)) {
      throw new BadRequestError(validator.$description, {
        code: 'permissions_invalid',
      })
    }

    const doc = new Doc({
      $permissions: permissions,
    })

    const db = this.getDb()
    const permsTable = `${tableId}_perms`

    const run = async (txDb: DatabaseFacade) => {
      let query = txDb.table(permsTable).withSchema(schema).select('permission', 'roles')
      if (rowId !== undefined && rowId !== null) {
        query = query.where('row_id', '=', rowId)
      } else {
        query = query.whereNull('row_id')
      }

      const rows = (await query.execute()) as Array<{
        permission: string
        roles: string[]
      }>
      const existingPermissions: Record<string, string[]> = {}
      for (const row of rows) {
        existingPermissions[row.permission] = Array.isArray(row.roles) ? row.roles : []
      }

      for (const type of Database.PERMISSIONS) {
        const newPermissions = doc.getPermissionsByType(type)
        const currentPermissions = existingPermissions[type] || []

        const hasChanged =
          JSON.stringify([...newPermissions].sort()) !==
          JSON.stringify([...currentPermissions].sort())

        if (!hasChanged) continue

        if (newPermissions.length === 0) {
          if (currentPermissions.length > 0) {
            let delQuery = txDb.table(permsTable).withSchema(schema).where('permission', '=', type)
            if (rowId !== undefined && rowId !== null) {
              delQuery = delQuery.where('row_id', '=', rowId)
            } else {
              delQuery = delQuery.whereNull('row_id')
            }
            await delQuery.delete().execute()
          }
        } else if (currentPermissions.length > 0) {
          let updQuery = txDb.table(permsTable).withSchema(schema).where('permission', '=', type)
          if (rowId !== undefined && rowId !== null) {
            updQuery = updQuery.where('row_id', '=', rowId)
          } else {
            updQuery = updQuery.whereNull('row_id')
          }
          await updQuery.update({ roles: newPermissions } as any).execute()
        } else {
          await txDb
            .table(permsTable)
            .withSchema(schema)
            .insert({
              permission: type,
              roles: newPermissions,
              row_id: rowId ?? null,
            } as any)
            .execute()
        }
      }

      return permissions
    }

    if (typeof (db as any).sql?.begin === 'function') {
      return await (db as any).transaction(run as any)
    }
    return await run(db)
  }
}
