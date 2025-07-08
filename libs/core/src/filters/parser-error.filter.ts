import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { ParserError } from '@nuvix/utils/query/error';

@Catch(ParserError)
export class ParserErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ParserErrorFilter.name);

  catch(exception: ParserError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<NuvixRes>();
    const request = ctx.getRequest<NuvixRequest>();

    this.logger.error(
      `${request.method} ${request.url}`,
      exception.stack ?? exception.message,
      ParserErrorFilter.name,
    );

    const status = 400;

    response.status(status).send({
      code: status,
      type: 'syntax_error',
      message: exception.message,
      hint: exception.hint ?? 'Check the condition syntax and try again.',
      detail: exception.detail,
      version: '1.0.0',
    });
  }
}
