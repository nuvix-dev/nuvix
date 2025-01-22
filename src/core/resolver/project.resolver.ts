import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { ClsService } from 'nestjs-cls';
import { PROJECT } from 'src/Utils/constants';

export const Project = createParamDecorator<Document>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const cls: ClsService = ctx.switchToHttp().getRequest().cls;
    return cls.get(PROJECT);
  },
);
