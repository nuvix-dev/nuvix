import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Exception } from '@nuvix/core/extend/exception';
import { Reflector } from '@nestjs/core';
import { Context } from '@nuvix/utils';
import { ProjectsDoc } from '@nuvix/utils/types';

@Injectable()
/**
 *  ProjectGuard, check if the project exists.
 */
export class ProjectGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const project = request[Context.Project] as ProjectsDoc;

    if (!project.empty() && project.getId() !== 'console') {
      return true;
    }

    throw new Exception(Exception.PROJECT_NOT_FOUND);
  }
}
