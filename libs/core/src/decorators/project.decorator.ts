import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Database } from '@nuvix/db'

/**
 * Get the current database instance from the request, (the one that corresponds to the requested schema)
 */
export const CurrentDatabase = createParamDecorator<any, Database>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    return request.context.currentSchemaDB as Database
  },
)
