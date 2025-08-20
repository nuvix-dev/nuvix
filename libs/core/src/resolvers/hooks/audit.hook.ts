import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AuditEventType } from '@nuvix/core/decorators';
import { Exception } from '@nuvix/core/extend/exception';
import { Hook } from '@nuvix/core/server';
import { Doc } from '@nuvix-tech/db';
import { QueueFor, AppMode, Context } from '@nuvix/utils';
import { Queue } from 'bullmq';
import { AuditsQueueJobData } from '../queues/audits.queue';
import { Auth } from '@nuvix/core/helper';
import { ProjectsDoc, UsersDoc } from '@nuvix/utils/types';

@Injectable()
export class AuditHook implements Hook {
  private readonly logger = new Logger(AuditHook.name);
  constructor(
    @InjectQueue(QueueFor.AUDITS)
    private readonly auditsQueue: Queue<AuditsQueueJobData>,
  ) {}

  async preSerialization(req: NuvixRequest, reply: NuvixRes) {
    const audit: AuditEventType | undefined = (
      req.routeOptions?.config as any
    )?.['audit']; // TODO: Improve type safety
    if (!audit || !audit.event || reply.statusCode >= 400) {
      return;
    }

    try {
      const project = req[Context.Project] as ProjectsDoc;
      const user = req[Context.User] as UsersDoc;
      const res = req['hooks_args']?.['preSerialization']?.['args']?.[0];
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
      user: UsersDoc;
      project: ProjectsDoc;
    },
  ) {
    const { event, meta } = audit;

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
    const mode = req[Context.Mode] as AppMode;
    if (!user || user.empty()) {
      user = new Doc({
        $id: '',
        status: true,
        $sequence: -1,
        type: Auth.ACTIVITY_TYPE_GUEST,
        email: 'guest.' + project.getId() + '@service.' + req.hostname,
        password: '',
        name: 'Guest',
      }) as unknown as UsersDoc;
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
    const [type, key] = path.split('.', 2) as [string, string];
    const params = req.params as Record<string, string>;
    const query = req.query as Record<string, string>;
    const reqBody = req.body as Record<string, any>;
    let value: unknown;

    switch (type) {
      case 'req':
        value = params?.[key] ?? query?.[key] ?? reqBody?.[key];
        break;
      case 'res':
        value = res?.[key];
        break;
      case 'params':
        value = params?.[key];
        break;
      case 'query':
        value = query?.[key];
        break;
      case 'body':
        value = reqBody?.[key];
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
