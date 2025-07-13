import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Exception } from '../extend/exception';

import { DatabaseError } from '@nuvix/database';

@Catch(Exception, DatabaseError)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: Exception, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<NuvixRes>();
    const request = ctx.getRequest<NuvixRequest>();
    let status =
      exception instanceof Exception
        ? exception.getStatus()
        : (exception as any).status || 500;
    if (typeof status !== 'number' || status >= 500) {
      status = 500;
    }

    if (status >= 500)
      this.logger.error(
        `${request.method} ${request.url}`,
        exception.stack ?? exception.message,
        HttpExceptionFilter.name,
      );

    response.status(status).send({
      code: status,
      message: exception.message,
      type:
        exception instanceof Exception
          ? exception.getType()
          : 'general_server_error',
      version: '1.0.0',
    });
  }
}
