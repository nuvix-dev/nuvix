import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CurrentSchemaType } from '../../decorators'
import { Exception } from '../../extend/exception'

@Injectable()
export class SchemaGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<NuvixRequest>()
    const schema = req.context.currentSchema

    if (!schema) {
      throw new Exception(
        Exception.GENERAL_BAD_REQUEST,
        'No schema found in request context', // This should never happen, as the schema should be set by the resolver before reaching this guard
      )
    }

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
