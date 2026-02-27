import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { RequestContext } from '../helpers'

export const Ctx = createParamDecorator<any, RequestContext>(
  (_data: unknown, ctx: ExecutionContext): any => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    return request.context
  },
)
