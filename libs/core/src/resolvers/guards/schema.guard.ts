import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CurrentSchemaType } from '../../decorators'
import { Exception } from '../../extend/exception'
import { Context, Schema } from '@nuvix/utils'

@Injectable()
export class SchemaGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const schema = req[Context.CurrentSchema] as Schema

    const requestSchemaType = this.reflector.getAllAndOverride(
      CurrentSchemaType,
      [context.getHandler(), context.getClass()],
    )

    if (requestSchemaType) {
      const types = Array.isArray(requestSchemaType)
        ? requestSchemaType
        : [requestSchemaType]
      if (!types.includes(schema.type)) {
        throw new Exception(
          Exception.GENERAL_BAD_REQUEST,
          `Invalid schema type, expected ${types.join(
            ' or ',
          )} but received ${schema.type}`,
        )
      }
    }

    return true
  }
}
