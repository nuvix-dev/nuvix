import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  _AuditEvent,
  ResourcePath,
  AuditEventKey,
} from '@nuvix/core/decorators';
import { Observable } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const auditEvent = this.reflector.get<{
      [K in AuditEventKey]: _AuditEvent | ResourcePath;
    }>('audit-event', context.getHandler());
    this.logger.debug(auditEvent);

    return next.handle();
  }
}
