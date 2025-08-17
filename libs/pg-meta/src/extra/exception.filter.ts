import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';

import { PgMetaException } from './execption';

@Catch(PgMetaException)
export class PgMetaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PgMetaExceptionFilter.name);

  catch(exception: PgMetaException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<NuvixRes>();
    const request = ctx.getRequest<NuvixRequest>();

    let status = getStatusCodeFromError(exception);

    this.logger.error(
      `${request.method} ${request.url}`,
      exception.stack ?? exception.message,
      PgMetaExceptionFilter.name,
    );
    const errorCode = exception.extra?.errorCode ?? 'DEFAULT_ERROR_CODE';
    const responseBody: Record<string, string | number | boolean> = {
      code: status,
      message: exception.message,
      type: errorCode,
      version: '1.0.0',
    };

    // Add useful debug info while excluding sensitive information
    if (exception.extra) {
      if (exception.extra.formattedError)
        responseBody['formattedError'] = exception.extra.formattedError;
      if (exception.extra['severity'])
        responseBody['severity'] = exception.extra['severity'];
      if (exception.extra['position'])
        responseBody['position'] = exception.extra['position'];
      if (exception.extra['routine'])
        responseBody['routine'] = exception.extra['routine'];
      if (exception.extra['hint'])
        responseBody['hint'] = exception.extra['hint'];
    }

    // Add stack trace in non-production environments
    if (process.env['NODE_ENV'] !== 'production' && exception.stack) {
      responseBody['stack'] = exception.stack;
    }

    response.status(status).send(responseBody);
  }
}

const getStatusCodeFromError = (
  error: any,
  defaultResponseCode = 400,
): number => {
  if (error.message === 'Connection terminated due to connection timeout') {
    return 504;
  } else if (error.message === 'sorry, too many clients already') {
    return 503;
  } else if (error.message === 'Query read timeout') {
    return 408;
  }
  return defaultResponseCode;
};
