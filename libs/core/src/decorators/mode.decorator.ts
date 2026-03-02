import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const Mode = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest<NuvixRequest>()
    return request.context.mode
  },
)
