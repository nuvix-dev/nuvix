import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { USER } from 'src/Utils/constants';

export const User = createParamDecorator<any, Document | null>(
  (data: unknown, ctx: ExecutionContext): Document => {
    const request: Request = ctx.switchToHttp().getRequest();

    if (data === 'project') {
      return null;
    }

    if (!request[USER]) {
      return null;
    }
    return request[USER];
  },
);
