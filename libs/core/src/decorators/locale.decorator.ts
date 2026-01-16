import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { LocaleTranslator } from '../helpers/locale.helper'
import ParamsHelper from '../helpers/params.helper'

export const Locale = createParamDecorator<any, any>(
  (data: unknown, ctx: ExecutionContext): any => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const params = new ParamsHelper(request)

    const locale =
      params.getFromHeaders('x-nuvix-locale') ||
      params.getFromQuery('locale') ||
      'en'

    // TODO: validate locale against supported locales

    return new LocaleTranslator(locale)
  },
)
