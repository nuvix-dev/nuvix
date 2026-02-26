import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Database } from '@nuvix/db'
import { DataSource } from '@nuvix/pg'
import { CURRENT_SCHEMA_DB, CURRENT_SCHEMA_PG } from '@nuvix/utils'
import { Exception } from '../extend/exception'

/**
 * Get the current database instance from the request, (the one that corresponds to the requested schema)
 */
export const CurrentDatabase = createParamDecorator<any, Database>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const database = request[CURRENT_SCHEMA_DB] as Database
    return database
  },
)

/**
 * Get the current pg DataSource instance from the request, (the one that corresponds to the requested schema)
 */
export const CurrentSchema = createParamDecorator<any, DataSource | undefined>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const database = request[CURRENT_SCHEMA_PG] as DataSource
    if (!database) {
      throw new Exception(Exception.SCHEMA_NOT_FOUND)
    }
    return database
  },
)
