import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Exception } from 'src/core/extend/exception';
import { Reflector } from '@nestjs/core';
import { Document } from '@nuvix/database';
import { PROJECT } from 'src/Utils/constants';

@Injectable()
/**
 *  ProjectGuard, check if the project exists.
 */
export class ProjectGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext) {
    // const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    //   context.getHandler(),
    //   context.getClass(),
    // ]);
    // if (isPublic) {
    //   return true;
    // }

    const request = context.switchToHttp().getRequest();
    const project = request[PROJECT] as Document;

    if (!project.isEmpty() && project.getId() !== 'console') {
      return true;
    }

    throw new Exception(Exception.PROJECT_NOT_FOUND);
  }
}
