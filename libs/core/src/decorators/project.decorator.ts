import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Database } from '@nuvix/db'
import { DataSource } from '@nuvix/pg'
import { CURRENT_SCHEMA_DB } from '@nuvix/utils'
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
