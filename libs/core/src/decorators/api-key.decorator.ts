import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Context } from '@nuvix/utils'
import { Key } from '../helpers'

export const ApiKey = createParamDecorator<any, Key>(
  (data: unknown, ctx: ExecutionContext): any => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    return request[Context.ApiKey]
  },
)
