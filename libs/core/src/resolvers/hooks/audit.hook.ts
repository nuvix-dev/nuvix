import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AuditEventType } from '@nuvix/core/decorators';
import { Exception } from '@nuvix/core/extend/exception';
import { Hook } from '@nuvix/core/server';
import { Document } from '@nuvix/database';
import { QueueFor, PROJECT, USER, AppMode } from '@nuvix/utils/constants';
import { Queue } from 'bullmq';
import { AuditsQueueJobData } from '../queues/audits.queue';
import { Auth } from '@nuvix/core/helper';

@Injectable()
export class AuditHook implements Hook {
  private readonly logger = new Logger(AuditHook.name);
  constructor(
    @InjectQueue(QueueFor.AUDITS)
    private readonly auditsQueue: Queue<AuditsQueueJobData>,
  ) {}

  async onSend(req: NuvixRequest) {
    const audit: AuditEventType | undefined =
      req.routeOptions?.config?.['audit'];
    if (!audit || !audit.event) {
      return;
    }

    try {
      const project = req[PROJECT] as Document;
      const user = req[USER] as Document;
      const res = req['hooks_args']?.['onSend']?.['args']?.[0];
      await this.handleAudit(req, res, { audit, user, project });
    } catch (e) {
      this.logger.error('Unexpected error during audit handling', { error: e });
    }

    return;
  }

  async handleAudit(
    req: NuvixRequest,
    res: string | any,
    {
      audit,
      user,
      project,
    }: {
      audit: AuditEventType;
      user: Document;
      project: Document;
    },
  ) {
    const { event, meta } = audit;

    this.logger.debug(`Handling audit event: ${event}`, { meta });
    try {
      res = typeof res === 'string' ? JSON.parse(res) : res;
    } catch {
      this.logger.error(
        `Failed to parse response for resource mapping: ${meta.resource}`,
        { res },
      );
      throw new Exception(Exception.GENERAL_SERVER_ERROR);
    }

    const resource = this.mapResource(meta.resource, req, res);
    if (meta.userId && this.isMappingPart(meta.userId)) {
      meta.userId = this.mapValue(req, res, meta.userId);
    }
    const mode = req[AppMode._REQUEST];
    this.logger.debug(`Mapped resource: ${resource}`, { userId: meta.userId });
    if (!user || user.isEmpty()) {
      user = new Document({
        $id: '',
        status: true,
        type: Auth.ACTIVITY_TYPE_GUEST,
        email: 'guest.' + project.getId() + '@service.' + req.hostname,
        password: '',
        name: 'Guest',
      });
    }

    await this.auditsQueue.add(event, {
      project,
      mode,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
      resource,
      user,
      data: res,
    });
  }

  private mapResource(
    resource: string,
    req: NuvixRequest,
    res: Record<string, any>,
  ): string {
    return resource
      .split('/')
      .map(part =>
        this.isMappingPart(part) ? this.mapValue(req, res, part) : part,
      )
      .join('/');
  }

  private mapValue(
    req: NuvixRequest,
    res: Record<string, any>,
    path: string,
  ): any {
    path = path.slice(1, -1);
    const [type, key] = path.split('.', 2);
    let value: any;

    switch (type) {
      case 'req':
        value = req.params?.[key] ?? req.query?.[key] ?? req.body?.[key];
        break;
      case 'res':
        value = res?.[key];
        break;
      case 'params':
        value = req.params?.[key];
        break;
      case 'query':
        value = req.query?.[key];
        break;
      case 'body':
        value = req.body?.[key];
        break;
      default:
        value = 'Unknown';
    }

    return value ?? 'Unknown';
  }

  private isMappingPart(part: string): boolean {
    return /{.*\..*}/.test(part);
  }
}
