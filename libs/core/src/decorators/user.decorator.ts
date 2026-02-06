import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Context } from '@nuvix/utils'
import { UsersDoc } from '@nuvix/utils/types'

export const User = createParamDecorator<any, UsersDoc | null>(
  (_data: unknown, ctx: ExecutionContext): UsersDoc => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()

    return request[Context.User]
  },
)
