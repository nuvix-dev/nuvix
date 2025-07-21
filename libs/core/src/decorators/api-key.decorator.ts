import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKey as ApiKeyEnum } from '@nuvix/utils/constants';
import { Key } from 'readline';

export const ApiKey = createParamDecorator<any, Key>(
  (data: unknown, ctx: ExecutionContext): any => {
    const request: Request = ctx.switchToHttp().getRequest();
    return request[ApiKeyEnum._REQUEST];
  },
);
