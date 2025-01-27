import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import { Exception } from '../extend/exception';

@Catch(Exception) // , Error
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: Exception, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof Exception ? exception.getStatus() : 500;

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
