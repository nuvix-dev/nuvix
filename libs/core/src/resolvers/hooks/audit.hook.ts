import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Doc } from '@nuvix/db'
import { AuthActivity, QueueFor, RouteContext } from '@nuvix/utils'
import { UsersDoc } from '@nuvix/utils/types'
import { Queue } from 'bullmq'
import { AuditEventType } from '../../decorators'
import { Exception } from '../../extend/exception'
import { Hook } from '../../server'
import { AuditsQueueJobData } from '../queues/audits.queue'

@Injectable()
export class AuditHook implements Hook {
  private readonly logger = new Logger(AuditHook.name)
  constructor(
    @InjectQueue(QueueFor.AUDITS)
    private readonly auditsQueue: Queue<AuditsQueueJobData>,
  ) {}

  async preSerialization(req: NuvixRequest, reply: NuvixRes) {
    const audit = req.routeOptions?.config[RouteContext.AUDIT]
    if (!audit || !audit.event || reply.statusCode >= 400) {
      return
    }

    try {
      const body = req.hooks_args?.preSerialization?.args?.[0]
      await this.handleAudit(req, body, audit)
    } catch (e) {
      this.logger.error('Unexpected error during audit handling', { error: e })
    }

    return
  }

  async handleAudit(req: NuvixRequest, body: any, audit: AuditEventType) {
    const { event, meta } = audit
    const ctx = req.context
    let user = ctx.user

    try {
      body = typeof body === 'string' ? JSON.parse(body) : body
    } catch (e) {
      this.logger.error(
        `Failed to parse response for resource mapping: ${meta.resource}`,
        { body },
      )
      throw new Exception(Exception.GENERAL_SERVER_ERROR)
    }

    const resource = this.mapResource(meta.resource, req, body)
    if (meta.userId && this.isMappingPart(meta.userId)) {
      meta.userId = this.mapValue(req, body, meta.userId)
    }

    if (!user || user.empty()) {
      user = new Doc({
        $id: '',
        status: true,
        $sequence: -1,
        type: AuthActivity.GUEST,
        email: `guest.${ctx.project.getId()}@service.${req.host}`,
        password: '',
        name: 'Guest',
      }) as unknown as UsersDoc
    }

    await this.auditsQueue.add(event, {
      mode: ctx.mode,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
      resource,
      user,
      data: body
        ? this.stripSensitiveData(body, ctx.sensitiveFields)
        : undefined,
    })
  }

  private mapResource(
    resource: string,
    req: NuvixRequest,
    body: Record<string, any>,
  ): string {
    return resource
      .split('/')
      .map(part =>
        this.isMappingPart(part) ? this.mapValue(req, body, part) : part,
      )
      .join('/')
  }

  private mapValue(
    req: NuvixRequest,
    body: Record<string, any>,
    path: string,
  ): any {
    path = path.slice(1, -1)
    const [type, key] = path.split('.', 2) as [string, string]
    const params = req.params as Record<string, string>
    const query = req.query as Record<string, string>
    const reqBody = req.body as Record<string, any>
    let value: unknown

    switch (type) {
      case 'req':
        value = params?.[key] ?? query?.[key] ?? reqBody?.[key]
        break
      case 'res':
        value = body?.[key]
        break
      case 'params':
        value = params?.[key]
        break
      case 'query':
        value = query?.[key]
        break
      case 'body':
        value = reqBody?.[key]
        break
      default:
        value = 'Unknown'
    }

    return value ?? 'Unknown'
  }

  private isMappingPart(part: string): boolean {
    return /{.*\..*}/.test(part)
  }

  protected stripSensitiveData(
    data: Record<string, any>,
    keys: string[],
  ): Record<string, any> {
    const strippedData = { ...data }
    for (const key of keys) {
      if (key in strippedData) {
        strippedData[key] = '[REDACTED]'
      }
    }
    return strippedData
  }
}
