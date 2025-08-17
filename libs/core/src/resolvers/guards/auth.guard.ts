import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Exception } from '@nuvix/core/extend/exception';
import { Reflector } from '@nestjs/core';
import { Context, IS_PUBLIC_KEY } from '@nuvix/utils';
import { UsersDoc } from '@nuvix/utils/types';

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
    const user: UsersDoc = request[Context.User];
    const err = request.err;

    if (err) throw err;

    if (user.empty()) {
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
