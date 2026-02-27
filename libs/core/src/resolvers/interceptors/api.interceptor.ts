import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { _Namespace, Auth as Auths, Scope } from '../../decorators'
import { Exception } from '../../extend/exception'
import { TOTP } from '../../validators/MFA.validator'

@Injectable()
export class ApiInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<NuvixRequest>()
    const { user, scopes = [], project } = request.context

    const scope = this.reflector.getAllAndOverride(Scope, [
      context.getHandler(),
      context.getClass(),
    ])
    const namespace = this.reflector.getAllAndOverride(_Namespace, [
      context.getHandler(),
      context.getClass(),
    ])
    const authTypes = this.reflector.getAllAndOverride(Auths, [
      context.getHandler(),
      context.getClass(),
    ])

    if (namespace) {
      request.context.namespace = namespace
      if (
        namespace in project.get('services', {}) &&
        !project.get('services', {})[namespace] &&
        !(request.context.isAPIUser || request.context.isAdminUser)
      ) {
        throw new Exception(Exception.GENERAL_SERVICE_DISABLED)
      }
    }

    if (scope) {
      const requiredScopes = Array.isArray(scope) ? scope : [scope]
      const missingScopes = requiredScopes.filter(
        s => !scopes.includes(s as string),
      )

      if (missingScopes.length > 0) {
        throw new Exception(
          Exception.GENERAL_UNAUTHORIZED_SCOPE,
          `${user.get('email', 'User')} (role: ${request.role ?? '#'}) missing scopes [${missingScopes.join(', ')}]`,
        )
      }
    }

    if (authTypes) {
      const allowedAuthTypes = Array.isArray(authTypes)
        ? authTypes
        : [authTypes]
      const authType = request.context.authType
      if (
        allowedAuthTypes.length > 0 &&
        (!authType || !allowedAuthTypes.includes(authType))
      ) {
        throw new Exception(Exception.USER_UNAUTHORIZED)
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

    if (!scopes.includes('mfa')) {
      const { session } = request.context
      if (
        session &&
        !session.empty() &&
        session.get('factors', []).length < minimumFactors
      ) {
        throw new Exception(Exception.USER_MORE_FACTORS_REQUIRED)
      }
    }

    return next.handle()
  }
}
