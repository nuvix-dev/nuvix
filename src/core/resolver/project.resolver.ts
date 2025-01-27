import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { PROJECT } from 'src/Utils/constants';

export const Project = createParamDecorator<Document>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();

    if (!request[PROJECT]) {
      return null;
    }
    return request[PROJECT];
  },
);
