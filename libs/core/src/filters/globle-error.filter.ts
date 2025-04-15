import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

@Catch(BadRequestException)
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    let status: number, message: string, type: string;

    this.logger.error(
      `${request.method} ${request.url}`,
      exception.stack ?? exception.message,
      ErrorFilter.name,
    );

    switch (true) {
      case exception instanceof BadRequestException:
        status = exception.getStatus();
        message = exception.getResponse()['message'] || 'Bad request';
        type = 'general_bad_request';
        break;
      default:
        status = 500;
        message = 'An internal server error occurred';
        type = 'general_server_error';
        break;
    }

    response.status(status).send({
      code: status,
      message: message,
      type: type,
      version: '1.0.0',
    });
  }
}
