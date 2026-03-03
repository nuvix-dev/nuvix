import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Database } from '@nuvix/db'

/**
 * Get the current database instance from the request, (the one that corresponds to the requested schema)
 */
export const CurrentDatabase = createParamDecorator<any, Database>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const db = request.context.currentSchemaDB
    if (!db) {
      throw new Error(
        'CurrentDatabase not found in request context. Make sure that SchemaHook is properly configured and the schema exists.',
      )
    }
    return db
  },
)
