import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { PROJECT_USER } from 'src/Utils/constants';

export const User = createParamDecorator<any, any, Document | null>(
  (data: unknown, ctx: ExecutionContext): Document => {
    const request: Request = ctx.switchToHttp().getRequest();
    if (!request[PROJECT_USER]) {
      return null;
    }
    return request[PROJECT_USER];
  },
);
