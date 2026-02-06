import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Authorization } from '@nuvix/db'
import { Context } from '@nuvix/utils'
import type { ProjectsDoc, SessionsDoc, UsersDoc } from '@nuvix/utils/types'
import { Observable } from 'rxjs'
import { Scopes } from '../../config/roles'
import { Scope } from '../../decorators'
import { Exception } from '../../extend/exception'
import { TOTP } from '../../validators/MFA.validator'

@Injectable()
export class ConsoleInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    Authorization.setDefaultStatus(true)
    const request = context.switchToHttp().getRequest<NuvixRequest>()
    const _project = request[Context.Project] as ProjectsDoc
    const user = request[Context.User] as UsersDoc
    const scopes: Scopes[] = request[Context.Scopes] || []

    const scope = this.reflector.getAllAndOverride(Scope, [
      context.getHandler(),
      context.getClass(),
    ])

    if (scope) {
      const requiredScopes = Array.isArray(scope) ? scope : [scope]
      const missingScopes = requiredScopes.filter(s => !scopes.includes(s))

      if (missingScopes.length > 0) {
        throw new Exception(
          Exception.GENERAL_UNAUTHORIZED_SCOPE,
          `${user.get('email', 'User')} (role: ${request.role ?? '#'}) missing scopes (${missingScopes.join(', ')})`,
        )
      }
    }

    if (user.get('status') === false) {
      // Account is blocked
      throw new Exception(Exception.USER_BLOCKED)
    }

    if (user.get('reset')) {
      throw new Exception(Exception.USER_PASSWORD_RESET_REQUIRED)
    }

    const mfaEnabled = user.get('mfa', false)
    const hasVerifiedEmail = user.get('emailVerification', false)
    const hasVerifiedPhone = user.get('phoneVerification', false)
    const hasVerifiedAuthenticator =
      TOTP.getAuthenticatorFromUser(user)?.get('verified') ?? false
    const hasMoreFactors =
      hasVerifiedEmail || hasVerifiedPhone || hasVerifiedAuthenticator
    const minimumFactors = mfaEnabled && hasMoreFactors ? 2 : 1

    if (!scopes.includes('mfa' as Scopes)) {
      const session: SessionsDoc = request[Context.Session]
      if (
        session &&
        !session.empty() &&
        session.get('factors', []).length < minimumFactors
      ) {
        throw new Exception(Exception.USER_MORE_FACTORS_REQUIRED)
      }
    }

    request[Context.User] = user
    return next.handle()
  }
}
