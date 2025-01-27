import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Exception } from 'src/core/extend/exception';
import { Reflector } from '@nestjs/core';
import { Document } from '@nuvix/database';
import { PROJECT } from 'src/Utils/constants';
import { ClsService } from 'nestjs-cls';

@Injectable()
/**
 *  ProjectGuard, check if the project exists.
 */
export class ProjectGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly store: ClsService,
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

    if (!project.isEmpty()) {
      this.store.set(PROJECT, project);
      return true;
    }

    throw new Exception(Exception.PROJECT_NOT_FOUND);
  }
}
