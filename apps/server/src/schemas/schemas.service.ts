import { Injectable, Logger } from '@nestjs/common'
import {
  CallFunction,
  Delete,
  GetPermissions,
  Insert,
  Select,
  Update,
  UpdatePermissions,
} from './schemas.types'
import {
  Expression,
  ParsedOrdering,
  ParserResult,
  SelectNode,
} from '@nuvix/utils/query'
import { Parser } from '@nuvix/utils/query'
import { SelectParser } from '@nuvix/utils/query'
import { OrderParser } from '@nuvix/utils/query'
import { ASTToQueryBuilder } from '@nuvix/utils/query'
import { Exception } from '@nuvix/core/extend/exception'
import { transformPgError } from '@nuvix/utils/database'
import { DataSource, Raw } from '@nuvix/pg'
import {
  Doc,
  Permission,
  PermissionsValidator,
  PermissionType,
} from '@nuvix/db'
import { Database } from '@nuvix/db'
import { setupDatabaseMeta } from '@nuvix/core/helpers'
import { ProjectsDoc } from '@nuvix/utils/types'

@Injectable()
export class SchemasService {
  private readonly logger = new Logger(SchemasService.name)

  async select({
    pg,
    table,
    url,
    limit,
    offset,
    schema,
    project,
    context,
  }: Select) {
    const qb = pg.qb(table).withSchema(schema)
    const allowedSchemas = project.get('metadata')?.['allowedSchemas'] || []
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg, {
      allowedSchemas,
    })

    const { filter, select, order } = this.getParamsFromUrl(url, table)

    astToQueryBuilder.applySelect(select)
    astToQueryBuilder.applyFilters(filter, {
      applyExtra: true,
      tableName: table,
    })
    astToQueryBuilder.applyOrder(order, table)
    astToQueryBuilder.applyLimitOffset({
      limit: limit ?? filter?.limit ?? 500,
      offset,
    })

    return this.withMetaTransaction(pg, project, context, async () => {
      return qb.catch(e => this.processError(e))
    })
  }

  private async withMetaTransaction(
    pg: DataSource,
    project: ProjectsDoc,
    context: Record<string, any>,
    callback: () => Promise<any>,
  ) {
    return pg.transaction(async () => {
      const { role, request, ...extra } = context as any
      await pg.execute(`SET LOCAL ROLE ${pg.escapeIdentifier(role)};`)
      await setupDatabaseMeta({
        request,
        extra,
        project,
        client: pg,
        extraPrefix: 'request.auth',
      })
      return callback()
    })
  }

  async insert({
    pg,
    table,
    input,
    columns,
    schema,
    url,
    context,
    project,
  }: Insert) {
    if (!input) {
      throw new Exception(
        Exception.INVALID_PARAMS,
        'Input data is required for insert operation',
      )
    }
    const isArrayData = Array.isArray(input)

    let data: Record<string, any> | Record<string, any>[]

    if (columns?.length) {
      if (isArrayData) {
        data = input.map(record =>
          columns.reduce(
            (acc, column) => {
              acc[column] = record[column]
              return acc
            },
            {} as Record<string, any>,
          ),
        )
      } else {
        data = columns.reduce(
          (acc, column) => {
            acc[column] = input[column]
            return acc
          },
          {} as Record<string, any>,
        )
      }
    } else {
      data = input
    }

    const qb = pg.qb(table).withSchema(schema)
    const { select } = this.getParamsFromUrl(url, table)
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg)

    astToQueryBuilder.applyReturning(select)
    qb.insert(data)

    return this.withMetaTransaction(pg, project, context, async () =>
      qb.catch(e => this.processError(e)),
    )
  }

  async update({
    pg,
    table,
    project,
    input,
    columns,
    schema,
    url,
    limit,
    offset,
    context,
    force = false,
  }: Update) {
    if (!input) {
      throw new Exception(
        Exception.INVALID_PARAMS,
        'Input data is required for update operation',
      )
    }
    let data: Record<string, any> | Record<string, any>[]

    if (columns?.length) {
      data = columns.reduce(
        (acc, column) => {
          acc[column] = input[column]
          return acc
        },
        {} as Record<string, any>,
      )
    } else {
      data = input
    }

    const qb = pg.qb(table).withSchema(schema)
    const { select, filter, order } = this.getParamsFromUrl(url, table)
    const allowedSchemas = project.get('metadata')?.['allowedSchemas'] || []
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg, {
      allowedSchemas,
    })

    astToQueryBuilder.applyReturning(select)
    astToQueryBuilder.applyFilters(filter, {
      applyExtra: true,
      tableName: table,
      throwOnEmpty: !force,
      throwOnEmptyError: new Exception(
        Exception.GENERAL_BAD_REQUEST,
        'you must provide a filter to update data or use &force=true',
      ),
    })
    astToQueryBuilder.applyOrder(order, table)
    astToQueryBuilder.applyLimitOffset({
      limit,
      offset,
    })
    qb.update(data)

    return this.withMetaTransaction(pg, project, context, async () =>
      qb.catch(e => this.processError(e)),
    )
  }

  async delete({
    pg,
    table,
    project,
    schema,
    url,
    limit,
    offset,
    force,
    context,
  }: Delete) {
    const qb = pg.table(table).withSchema(schema)
    const { select, filter, order } = this.getParamsFromUrl(url, table)
    const allowedSchemas = project.get('metadata')?.['allowedSchemas'] || []
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg, {
      allowedSchemas,
    })

    astToQueryBuilder.applyReturning(select)
    astToQueryBuilder.applyFilters(filter, {
      applyExtra: true,
      tableName: table,
      throwOnEmpty: !force,
      throwOnEmptyError: new Exception(
        Exception.GENERAL_BAD_REQUEST,
        'you must provide a filter to delete data or use &force=true',
      ),
    })
    astToQueryBuilder.applyOrder(order, table)
    astToQueryBuilder.applyLimitOffset({
      limit,
      offset,
    })
    qb.delete()

    return this.withMetaTransaction(pg, project, context, async () =>
      qb.catch(e => this.processError(e)),
    )
  }

  async callFunction({
    pg,
    functionName,
    schema,
    url,
    limit,
    offset,
    args,
    context,
    project,
  }: CallFunction) {
    let placeholder: string
    let values: any[]

    if (Array.isArray(args)) {
      // Handle array args (unnamed parameters)
      placeholder = args.map(() => '?').join(', ')
      values = [schema, functionName, ...args]
    } else {
      // Handle object args (named parameters)
      const _argNames = Object.keys(args || {})
      const _values = Object.values(args || {})
      placeholder = _argNames.map(n => `${n}:= ?`).join(', ')
      values = [schema, functionName, ..._values]
    }

    const raw = new Raw(pg)
    raw.set(`??.??(${placeholder})`, values)

    const qb = pg.queryBuilder().table(raw as any)
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg)

    const { select, filter, order } = this.getParamsFromUrl(url, functionName)

    astToQueryBuilder.applySelect(select)
    astToQueryBuilder.applyFilters(filter)
    astToQueryBuilder.applyOrder(order, functionName)
    astToQueryBuilder.applyLimitOffset({
      limit,
      offset,
    })
    const result = await this.withMetaTransaction(
      pg,
      project,
      context,
      async () => {
        return qb.catch(e => this.processError(e))
      },
    )

    if (
      Array.isArray(result) &&
      result.length === 1 &&
      functionName in result[0] &&
      Object.keys(result[0]).length === 1
    ) {
      return result[0][functionName]
    }
    return result
  }

  private processError(e: unknown) {
    const error = transformPgError(e)
    if (!error || error.status >= 500) {
      throw new Exception(
        error?.type ?? Exception.GENERAL_SERVER_ERROR,
        error?.message ?? 'Database error',
        error?.status,
      )
    }
    throw new Exception(error.type, error.message, error.status).addDetails({
      hint: error.details.hint,
      detail: error.details.detail,
    })
  }

  private getParamsFromUrl(
    url: string,
    tableName: string,
  ): {
    filter?: Expression & ParserResult
    select?: SelectNode[]
    order?: ParsedOrdering[]
  } {
    const queryString = url.includes('?') ? url.split('?')[1] : ''
    const urlParams = new URLSearchParams(queryString)

    const _filter = urlParams.get('filter') || ''
    const filter = _filter
      ? Parser.create({ tableName }).parse(_filter)
      : undefined

    const _select = urlParams.get('select') || ''
    const select = _select
      ? new SelectParser({ tableName }).parse(_select)
      : undefined

    const _order = urlParams.get('order') || ''
    const order = _order ? OrderParser.parse(_order, tableName) : undefined

    return { filter, select, order }
  }

  async updatePermissions({
    pg,
    tableId,
    schema,
    permissions,
    rowId,
  }: UpdatePermissions) {
    const allowed = [
      PermissionType.Read,
      PermissionType.Update,
      PermissionType.Delete,
    ]
    if (rowId === undefined || rowId === null) {
      allowed.push(PermissionType.Create)
    }

    const validator = new PermissionsValidator(undefined, allowed)
    if (!validator.$valid(permissions)) {
      throw new Exception(Exception.GENERAL_BAD_REQUEST, validator.$description)
    }

    const doc = new Doc({
      $permissions: permissions,
    })

    // Get current permissions from DB
    const query = pg
      .table(`${tableId}_perms`)
      .withSchema(schema)
      .select(['permission', 'roles'])

    if (rowId !== undefined && rowId !== null) {
      query.andWhere('row_id', rowId)
    } else {
      query.whereNull('row_id')
    }

    const rows = (await query) as unknown as Array<{
      permission: string
      roles: string[]
    }>

    const existingPermissions: Record<string, string[]> = {}
    for (const row of rows) {
      existingPermissions[row['permission']] = Array.isArray(row.roles)
        ? row.roles
        : []
    }

    // Build operations for each permission type
    for (const type of Database.PERMISSIONS) {
      const newPermissions = doc.getPermissionsByType(type)
      const currentPermissions = existingPermissions[type] || []

      const hasChanged =
        JSON.stringify(newPermissions.sort()) !==
        JSON.stringify(currentPermissions.sort())

      if (!hasChanged) {
        continue
      }

      if (newPermissions.length === 0) {
        // Delete existing row
        if (currentPermissions.length > 0) {
          const delQuery = pg
            .table(`${tableId}_perms`)
            .withSchema(schema)
            .andWhere('permission', type)

          if (rowId !== undefined && rowId !== null) {
            delQuery.andWhere('row_id', rowId)
          } else {
            delQuery.whereNull('row_id')
          }

          await delQuery.delete()
        }
      } else {
        if (currentPermissions.length > 0) {
          // Update existing row
          const updQuery = pg
            .table(`${tableId}_perms`)
            .withSchema(schema)
            .andWhere('permission', type)

          if (rowId !== undefined && rowId !== null) {
            updQuery.andWhere('row_id', rowId)
          } else {
            updQuery.whereNull('row_id')
          }

          await updQuery.update({
            roles: newPermissions,
          })
        } else {
          // Insert new row
          await pg
            .table(`${tableId}_perms`)
            .withSchema(schema)
            .insert({
              permission: type,
              roles: newPermissions,
              row_id: rowId ?? null,
            })
        }
      }
    }

    return permissions
  }

  async getPermissions({
    pg,
    tableId,
    rowId,
    schema,
  }: GetPermissions): Promise<string[]> {
    const query = pg
      .table(`${tableId}_perms`)
      .withSchema(schema)
      .select(['roles', 'permission'])

    if (rowId !== undefined && rowId !== null) {
      query.andWhere('row_id', rowId)
    } else {
      query.whereNull('row_id')
    }

    const rows = (await query) as unknown as Array<{
      permission: string
      roles: string[]
    }>

    const result: string[] = []

    for (const row of rows) {
      const type = row.permission // e.g. "read" | "update" | "delete"
      const perms: string[] = Array.isArray(row.roles) ? row.roles : []

      for (const p of perms) {
        result.push(`${type}("${p}")`)
      }
    }

    return result
  }
}
