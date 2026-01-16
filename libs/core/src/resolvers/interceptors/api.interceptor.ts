import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { Context, CORE_SCHEMA_DB, MetricFor, QueueFor } from '@nuvix/utils'
import { Database, Events, Doc } from '@nuvix/db'
import { Reflector } from '@nestjs/core'
import { Auth } from '../../helpers/auth.helper'
import { Exception } from '../../extend/exception'
import { TOTP } from '../../validators/MFA.validator'
import {
  Scope,
  Auth as Auths,
  type AuthType,
  _Namespace,
} from '../../decorators'
import { Scopes } from '../../config/roles'
import type { ProjectsDoc, SessionsDoc, UsersDoc } from '@nuvix/utils/types'
import type { Queue } from 'bullmq'
import { StatsQueueJob, type StatsQueueOptions } from '../queues'
import { InjectQueue } from '@nestjs/bullmq'

@Injectable()
export class ApiInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @InjectQueue(QueueFor.STATS)
    private readonly statsQueue: Queue<
      StatsQueueOptions,
      unknown,
      StatsQueueJob
    >,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<NuvixRequest>()
    const project = request[Context.Project] as ProjectsDoc
    let user = request[Context.User] as UsersDoc
    const scopes: Scopes[] = request[Context.Scopes] || []

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

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
      request[Context.Namespace] = namespace
      if (
        namespace in project.get('services', {}) &&
        !project.get('services', {})[namespace] &&
        !Auth.isTrustedActor
      ) {
        throw new Exception(Exception.GENERAL_SERVICE_DISABLED)
      }
    }

    if (scope) {
      const requiredScopes = Array.isArray(scope) ? scope : [scope]
      const missingScopes = requiredScopes.filter(s => !scopes.includes(s))

      if (missingScopes.length > 0) {
        throw new Exception(
          Exception.GENERAL_UNAUTHORIZED_SCOPE,
          `${user.get('email', 'User')} (role: ${request['role'] ?? '#'}) missing scopes [${missingScopes.join(', ')}]`,
        )
      }
    }

    if (authTypes) {
      const allowedAuthTypes = Array.isArray(authTypes)
        ? authTypes
        : [authTypes]
      if (
        allowedAuthTypes.length > 0 &&
        !allowedAuthTypes.includes(request[Context.AuthType] as AuthType)
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
    const dbForProject = request[CORE_SCHEMA_DB] as Database

    if (dbForProject instanceof Database) {
      const metrics: Array<{ key: MetricFor; value: number }> = []
      const reduce: Doc<any>[] = []

      dbForProject
        .on(Events.DocumentCreate, 'calculate-usage', document =>
          this.usageDatabaseListener(
            Events.DocumentCreate,
            document,
            metrics,
            reduce,
          ),
        )
        .on(Events.DocumentDelete, 'calculate-usage', document =>
          this.usageDatabaseListener(
            Events.DocumentDelete,
            document,
            metrics,
            reduce,
          ),
        )
        .on(Events.DocumentsCreate, 'calculate-usage', documents =>
          this.usageDatabaseListener(
            Events.DocumentsCreate,
            new Doc({
              modified: documents.length,
            }),
            metrics,
            reduce,
          ),
        )
        .on(Events.DocumentsDelete, 'calculate-usage', documents =>
          this.usageDatabaseListener(
            Events.DocumentDelete,
            Array.isArray(documents)
              ? new Doc({
                  modified: documents.length,
                })
              : documents,
            metrics,
            reduce,
          ),
        )
        .on(Events.DocumentsUpsert, 'calculate-usage', document =>
          this.usageDatabaseListener(
            Events.DocumentsUpsert,
            document,
            metrics,
            reduce,
          ),
        )

      await this.statsQueue.add(StatsQueueJob.ADD_METRIC, {
        project,
        metrics,
        reduce,
      })
    }

    return next.handle()
  }

  private async usageDatabaseListener(
    event: Events,
    document: Doc<any>,
    metrics: Array<{ key: MetricFor; value: number }>,
    reduce: Doc<any>[],
  ) {
    let value = 1

    switch (event) {
      case Events.DocumentDelete:
        value = -1
        break
      case Events.DocumentsDelete:
        value = -1 * document.get('modified', 0)
        break
      case Events.DocumentsCreate:
        value = document.get('modified', 0)
        break
      case Events.DocumentsUpsert:
        value = document.get('created', 0)
        break
    }
    const collection = document.getCollection()

    switch (true) {
      case collection === 'teams':
        metrics.push({ key: MetricFor.TEAMS, value })
        break
      case collection === 'users':
        metrics.push({ key: MetricFor.USERS, value })
        if (event === Events.DocumentDelete) {
          reduce.push(document)
        }
        break
      case collection === 'sessions':
        metrics.push({ key: MetricFor.SESSIONS, value })
        break
      case collection === 'buckets':
        metrics.push({ key: MetricFor.BUCKETS, value })
        if (event === Events.DocumentDelete) {
          reduce.push(document)
        }
        break
      case collection.startsWith('bucket_'):
        const bucketParts = collection.split('_')
        const bucketInternalId = bucketParts[1]

        metrics.push({ key: MetricFor.FILES, value })
        metrics.push({
          key: MetricFor.FILES_STORAGE,
          value: document.get('sizeOriginal') * value,
        })
        metrics.push({
          key: `${bucketInternalId}.files` as MetricFor.BUCKET_ID_FILES,
          value,
        })
        metrics.push({
          key: `${bucketInternalId}.files.storage` as MetricFor.BUCKET_ID_FILES_STORAGE,
          value: document.get('sizeOriginal') * value,
        })
        break
      case collection === 'functions':
        metrics.push({ key: MetricFor.FUNCTIONS, value })
        if (event === Events.DocumentDelete) {
          reduce.push(document)
        }
        break
      case collection === 'deployments':
        const resourceType = document.get('resourceType')
        const resourceInternalId = document.get('resourceInternalId')
        const size = document.get('size')
        if (!resourceType || !resourceInternalId || !size) {
          break
        }

        metrics.push({ key: MetricFor.DEPLOYMENTS, value })
        metrics.push({
          key: MetricFor.DEPLOYMENTS_STORAGE,
          value: size * value,
        })
        metrics.push({
          key: `${resourceType}.deployments` as MetricFor.DEPLOYMENTS,
          value,
        })
        metrics.push({
          key: `${resourceType}.deployments.storage` as MetricFor.DEPLOYMENTS_STORAGE,
          value: size * value,
        })
        metrics.push({
          key: `${resourceType}.${resourceInternalId}.deployments` as MetricFor.DEPLOYMENTS,
          value,
        })
        metrics.push({
          key: `${resourceType}.${resourceInternalId}.deployments.storage` as MetricFor.DEPLOYMENTS_STORAGE,
          value: size * value,
        })
        break
      default:
        break
    }
  }
}
