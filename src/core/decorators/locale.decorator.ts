import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { LOCALE } from 'src/Utils/constants';
import { LocaleTranslator } from '../helper/locale.helper';

export const Locale = createParamDecorator<any, any>(
  (data: unknown, ctx: ExecutionContext): any => {
    const request: Request = ctx.switchToHttp().getRequest();

    // TODO: Implement the logic to get the locale from the request object
    //  request[LOCALE];

    return new LocaleTranslator();
  },
);
