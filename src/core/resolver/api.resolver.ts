import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import {
  APP_MODE_ADMIN,
  APP_MODE_DEFAULT,
  PROJECT,
  SCOPES,
  SESSION,
  USER,
} from 'src/Utils/constants';
import ParamsHelper from '../helper/params.helper';
import { Authorization, Document } from '@nuvix/database';
import { Reflector } from '@nestjs/core';
import { LableKey, LableValue } from './lable.resolver';
import { Auth } from '../helper/auth.helper';
import { Exception } from '../extend/exception';
import { roles } from '../config/roles';
import { TOTP } from '../validators/MFA.validator';

@Injectable()
export class ApiInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const params = new ParamsHelper(request);
    const project = request[PROJECT] as Document;
    let user = request[USER] as Document;
    const scopes: string[] = request[SCOPES];
    const mode =
      params.getFromHeaders('x-nuvix-mode') ||
      params.getFromQuery('mode', APP_MODE_DEFAULT);

    const scope = this.reflector.get<LableValue['scope']>(
      'scope',
      context.getHandler(),
    );
    const namespace = this.reflector.get<LableValue['namespace']>(
      'namespace',
      context.getHandler(),
    );

    if (APP_MODE_ADMIN === mode) {
      if (
        user.find(
          'teamInternalId',
          project.getAttribute('teamInternalId'),
          'memberships',
        )
      ) {
        Authorization.setDefaultStatus(false);
      } else {
        user = new Document();
      }
    }

    if (namespace) {
      if (
        namespace in project.getAttribute('services', {}) &&
        !project.getAttribute('services', {})[namespace] &&
        !(
          Auth.isPrivilegedUser(Authorization.getRoles()) ||
          Auth.isAppUser(Authorization.getRoles())
        )
      ) {
        throw new Exception(Exception.GENERAL_SERVICE_DISABLED);
      }
    }

    if (scope && !scopes.includes(scope)) {
      if (project.isEmpty()) {
        // Check if permission is denied because project is missing
        throw new Exception(Exception.PROJECT_NOT_FOUND);
      }

      throw new Exception(
        Exception.GENERAL_UNAUTHORIZED_SCOPE,
        `${user.getAttribute('email', 'User')} (role: #) missing scope (${scope})`,
      );
    }

    if (user.getAttribute('status') === false) {
      // Account is blocked
      throw new Exception(Exception.USER_BLOCKED);
    }

    if (user.getAttribute('reset')) {
      throw new Exception(Exception.USER_PASSWORD_RESET_REQUIRED);
    }

    const mfaEnabled = user.getAttribute('mfa', false);
    const hasVerifiedEmail = user.getAttribute('emailVerification', false);
    const hasVerifiedPhone = user.getAttribute('phoneVerification', false);
    const hasVerifiedAuthenticator =
      TOTP.getAuthenticatorFromUser(user)?.getAttribute('verified') ?? false;
    const hasMoreFactors =
      hasVerifiedEmail || hasVerifiedPhone || hasVerifiedAuthenticator;
    const minimumFactors = mfaEnabled && hasMoreFactors ? 2 : 1;

    if (!scopes.includes('mfa')) {
      const session = request[SESSION];
      if (
        session &&
        session.getAttribute('factors', []).length < minimumFactors
      ) {
        throw new Exception(Exception.USER_MORE_FACTORS_REQUIRED);
      }
    }

    request[USER] = user;

    return next.handle();
  }
}
