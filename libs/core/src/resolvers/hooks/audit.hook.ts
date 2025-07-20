import { Injectable, Logger } from '@nestjs/common';
import { AuditEventType } from '@nuvix/core/decorators';
import { Exception } from '@nuvix/core/extend/exception';
import { Hook } from '@nuvix/core/server';

@Injectable()
export class AuditHook implements Hook {
  private readonly logger = new Logger(AuditHook.name);

  async onSend(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ) {
    this.logger.debug(req['hooks_args']?.['onSend']?.['args']);
    const audit: AuditEventType | undefined =
      req.routeOptions?.config?.['audit'];
    if (!audit) {
      return next();
    }

    try {
      const res = req['hooks_args']?.['onSend']?.['args']?.[0];
      await this.handleAudit(req, res, audit);
    } catch (e) {
      if (e instanceof Exception) {
        return next(e);
      }
      this.logger.error('Unexpected error during audit handling', { error: e });
      return next(new Exception(Exception.GENERAL_SERVER_ERROR));
    }

    return next();
  }

  async handleAudit(
    req: NuvixRequest,
    res: string | any,
    audit: AuditEventType,
  ) {
    const { event, meta } = audit;

    this.logger.debug(`Handling audit event: ${event}`, { meta });
    if (meta.resource.includes('res.') || meta.userId?.includes?.('res.')) {
      try {
        res = typeof res === 'string' ? JSON.parse(res) : res;
      } catch {
        this.logger.error(
          `Failed to parse response for resource mapping: ${meta.resource}`,
          { res },
        );
        throw new Exception(Exception.GENERAL_SERVER_ERROR);
      }
    }

    const resource = this.mapResource(meta.resource, req, res);
    if (meta.userId && this.isMappingPart(meta.userId)) {
      meta.userId = this.mapValue(req, res, meta.userId);
    }

    this.logger.debug(`Mapped resource: ${resource}`, { userId: meta.userId });
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
