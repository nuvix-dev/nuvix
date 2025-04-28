import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CLIENT } from '../constants';

export const Client = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const client = request[CLIENT];
    return client;
  },
);
