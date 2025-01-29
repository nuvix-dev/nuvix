import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Exception } from '../extend/exception';

@Catch(Exception, Error) // , Error
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: Exception, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof Exception ? exception.getStatus() : 500;

    this.logger.error(
      `${request.method} ${request.url}`,
      exception,
      HttpExceptionFilter.name,
    );

    response.status(status).json({
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
