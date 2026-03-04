import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const Locale = createParamDecorator<any, any>(
  (_data: unknown, ctx: ExecutionContext): any => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    return request.context.translator()
  },
)
