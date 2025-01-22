import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import { Exception } from '../extend/exception';

@Catch(Exception)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: Exception, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response.status(status).json({
      code: status,
      message: exception.message,
      type: exception.getType(),
      version: '1.0.0',
    });
  }
}
