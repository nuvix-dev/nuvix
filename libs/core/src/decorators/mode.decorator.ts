import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AppMode } from '@nuvix/utils'
import ParamsHelper from '../helpers/params.helper'

export const Mode = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest<NuvixRequest>()

    const params = new ParamsHelper(request)

    const mode =
      params.getFromHeaders('x-nuvix-mode') ||
      params.getFromQuery('mode', AppMode.DEFAULT)

    return mode
  },
)
