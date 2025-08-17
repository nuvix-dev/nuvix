import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Context } from '@nuvix/utils';
import { ProjectsDoc, UsersDoc } from '@nuvix/utils/types';
import { Doc } from '@nuvix-tech/db';

export const User = createParamDecorator<any, UsersDoc | null>(
  (data: unknown, ctx: ExecutionContext): UsersDoc => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest();

    const project: ProjectsDoc = request[Context.Project];
    const user: UsersDoc = request[Context.User];

    if (project.empty() || project.getId() === 'console' || user.empty()) {
      return new Doc();
    }

    return user;
  },
);
