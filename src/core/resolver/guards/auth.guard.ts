import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Exception } from 'src/core/extend/exception';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, USER } from 'src/Utils/constants';
import { Document } from '@nuvix/database';

@Injectable()
/**
 * Guard to check if the user is authenticated
 */
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return this.validateRequest(context);
  }

  validateRequest(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user: Document = request[USER];
    const err = request.err;

    if (err) throw err;

    if (user.isEmpty()) {
      throw new Exception(
        Exception.USER_UNAUTHORIZED,
        undefined,
        undefined,
        err,
      );
    }
    return true;
  }
}

/**
 * Decorator to set metadata for public routes
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
