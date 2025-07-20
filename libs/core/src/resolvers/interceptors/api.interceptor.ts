import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  AppMode,
  CACHE_DB,
  CORE_SCHEMA_DB,
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
      params.getFromQuery('mode', AppMode.DEFAULT);

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
      // TODO: remove APP_SKIP_SCOPE
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
      const session: Document = request[SESSION];
      if (
        session &&
        !session.isEmpty() &&
        session.getAttribute('factors', []).length < minimumFactors
      ) {
        throw new Exception(Exception.USER_MORE_FACTORS_REQUIRED);
      }
    }

    request[USER] = user;
    const dbForProject = request[CORE_SCHEMA_DB] as Database;
    dbForProject
      .on(
        Database.EVENT_DOCUMENT_CREATE,
        'calculate-usage',
        async (event, document) =>
          await this.projectUsage.databaseListener({
            event,
            document,
            project,
            dbForProject,
          }),
      )
      .on(
        Database.EVENT_DOCUMENT_DELETE,
        'calculate-usage',
        async (event, document) =>
          await this.projectUsage.databaseListener({
            event,
            document,
            project,
            dbForProject,
          }),
      );

    return next.handle();
  }
}
