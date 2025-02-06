import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import ParamsHelper from '../helper/params.helper';
import { APP_MODE_DEFAULT } from 'src/Utils/constants';

export const Mode = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();

    const params = new ParamsHelper(request);

    const mode =
      params.getFromHeaders('x-nuvix-mode') ||
      params.getFromQuery('mode', APP_MODE_DEFAULT);

    return mode;
  },
);
