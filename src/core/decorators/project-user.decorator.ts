import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { PROJECT, USER } from 'src/Utils/constants';

export const User = createParamDecorator<any, Document | null>(
  (data: unknown, ctx: ExecutionContext): Document => {
    const request: Request = ctx.switchToHttp().getRequest();

    const project: Document = request[PROJECT];
    const user: Document = request[USER];

    if (project.isEmpty() || project.getId() === 'console' || user.isEmpty()) {
      return new Document();
    }

    return user;
  },
);
