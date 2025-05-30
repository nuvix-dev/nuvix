import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  APP_MODE_ADMIN,
  APP_MODE_DEFAULT,
  CACHE_DB,
  PROJECT,
  SCOPES,
  SESSION,
  USER,
} from '@nuvix/utils/constants';
import ParamsHelper from '../../helper/params.helper';
import { Authorization, Database, Document } from '@nuvix/database';
import { Reflector } from '@nestjs/core';
import { Auth } from '../../helper/auth.helper';
import { Exception } from '../../extend/exception';
import { TOTP } from '../../validators/MFA.validator';
import { Redis } from 'ioredis';
import { ProjectUsageService } from '@nuvix/core/project-usage.service';
import { Namespace, Scope } from '@nuvix/core/decorators';
import { Scopes } from '@nuvix/core/config/roles';

@Injectable()
export class ApiInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CACHE_DB) private readonly cacheDb: Redis,
    private readonly projectUsage: ProjectUsageService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<NuvixRequest>();
    const params = new ParamsHelper(request);
    const project = request[PROJECT] as Document;
    let user = request[USER] as Document;
    const scopes: Scopes[] = request[SCOPES];
    const mode =
      params.getFromHeaders('x-nuvix-mode') ||
      params.getFromQuery('mode', APP_MODE_DEFAULT);

    const scope = this.reflector.getAllAndOverride(Scope, [
      context.getHandler(),
      context.getClass(),
    ]);
    const namespace = this.reflector.getAllAndOverride(Namespace, [
      context.getHandler(),
      context.getClass(),
    ]);

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

    if (scope && !process.env.APP_SKIP_SCOPE) {
      const requiredScopes = Array.isArray(scope) ? scope : [scope];
      const missingScopes = requiredScopes.filter(s => !scopes.includes(s));

      if (missingScopes.length > 0) {
        if (project.isEmpty()) {
          // Check if permission is denied because project is missing
          throw new Exception(Exception.PROJECT_NOT_FOUND);
        }

        throw new Exception(
          Exception.GENERAL_UNAUTHORIZED_SCOPE,
          `${user.getAttribute('email', 'User')} (role: ${request['role'] ?? '#'}) missing scopes (${missingScopes.join(', ')})`,
        );
      }
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

    if (!scopes.includes('mfa' as any)) {
      const session = request[SESSION];
      if (
        session &&
        session.getAttribute('factors', []).length < minimumFactors
      ) {
        throw new Exception(Exception.USER_MORE_FACTORS_REQUIRED);
      }
    }

    request[USER] = user;
    // this.dbForProject
    //   .on(
    //     Database.EVENT_DOCUMENT_CREATE,
    //     'calculate-usage',
    //     async (event, document) =>
    //       await this.projectUsage.databaseListener({
    //         event,
    //         document,
    //         project,
    //         dbForProject: this.dbForProject,
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
    //         dbForProject: this.dbForProject,
    //       }),
    //   );

    return next.handle();
  }
}
