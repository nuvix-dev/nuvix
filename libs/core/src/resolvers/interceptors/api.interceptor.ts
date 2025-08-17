import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Context, CORE_SCHEMA_DB } from '@nuvix/utils';
import { Authorization, Database } from '@nuvix-tech/db';
import { Reflector } from '@nestjs/core';
import { Auth } from '../../helper/auth.helper';
import { Exception } from '../../extend/exception';
import { TOTP } from '../../validators/MFA.validator';
import { Namespace, Scope } from '@nuvix/core/decorators';
import { Scopes } from '@nuvix/core/config/roles';
import type { ProjectsDoc, SessionsDoc, UsersDoc } from '@nuvix/utils/types';

@Injectable()
export class ApiInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<NuvixRequest>();
    const project = request[Context.Project] as ProjectsDoc;
    let user = request[Context.User] as UsersDoc;
    const scopes: Scopes[] = request[Context.Scopes] || [];

    const scope = this.reflector.getAllAndOverride(Scope, [
      context.getHandler(),
      context.getClass(),
    ]);
    const namespace = this.reflector.getAllAndOverride(Namespace, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (namespace) {
      if (
        namespace in project.get('services', {}) &&
        !project.get('services', {})[namespace] &&
        !(
          Auth.isPrivilegedUser(Authorization.getRoles()) ||
          Auth.isAppUser(Authorization.getRoles())
        )
      ) {
        throw new Exception(Exception.GENERAL_SERVICE_DISABLED);
      }
    }

    if (scope) {
      const requiredScopes = Array.isArray(scope) ? scope : [scope];
      const missingScopes = requiredScopes.filter(s => !scopes.includes(s));

      if (missingScopes.length > 0) {
        if (project.empty()) {
          // Check if permission is denied because project is missing
          throw new Exception(Exception.PROJECT_NOT_FOUND);
        }

        throw new Exception(
          Exception.GENERAL_UNAUTHORIZED_SCOPE,
          `${user.get('email', 'User')} (role: ${request['role'] ?? '#'}) missing scopes (${missingScopes.join(', ')})`,
        );
      }
    }

    if (user.get('status') === false) {
      // Account is blocked
      throw new Exception(Exception.USER_BLOCKED);
    }

    if (user.get('reset')) {
      throw new Exception(Exception.USER_PASSWORD_RESET_REQUIRED);
    }

    const mfaEnabled = user.get('mfa', false);
    const hasVerifiedEmail = user.get('emailVerification', false);
    const hasVerifiedPhone = user.get('phoneVerification', false);
    const hasVerifiedAuthenticator =
      TOTP.getAuthenticatorFromUser(user)?.get('verified') ?? false;
    const hasMoreFactors =
      hasVerifiedEmail || hasVerifiedPhone || hasVerifiedAuthenticator;
    const minimumFactors = mfaEnabled && hasMoreFactors ? 2 : 1;

    if (!scopes.includes('mfa' as Scopes)) {
      const session: SessionsDoc = request[Context.Session];
      if (
        session &&
        !session.empty() &&
        session.get('factors', []).length < minimumFactors
      ) {
        throw new Exception(Exception.USER_MORE_FACTORS_REQUIRED);
      }
    }

    request[Context.User] = user;
    const dbForProject = request[CORE_SCHEMA_DB] as Database;
    // dbForProject
    //   .on(
    //     Database.EVENT_DOCUMENT_CREATE,
    //     'calculate-usage',
    //     async (event, document) =>
    //       await this.projectUsage.databaseListener({
    //         event,
    //         document,
    //         project,
    //         dbForProject,
    //       }),
    //   )
    //   .on(
    //     Database.EVENT_DOCUMENT_DELETE,
    //     'calculate-usage',
    //     async (event, document) =>
    //       await this.projectUsage.databaseListener({
    //         event,
    //         document,
    //         project,
    //         dbForProject,
    //       }),
    //   );

    return next.handle();
  }
}
