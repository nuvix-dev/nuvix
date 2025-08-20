import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { errorCodes, Exception } from '../extend/exception';
import { AppConfigService } from '../config.service';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);
  constructor(private readonly appConfig: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<NuvixRes>();
    const request = ctx.getRequest<NuvixRequest>();

    let status: number,
      message: string,
      type: string,
      extra: Record<string, unknown> = {};

    switch (true) {
      case exception instanceof Exception:
        status = exception.getStatus();
        message = exception.message;
        type = exception.getType() || Exception.GENERAL_UNKNOWN;
        extra = exception.getDetails();
        break;
      case exception instanceof BadRequestException:
        status = exception.getStatus();
        message =
          (typeof exception.getResponse() === 'object'
            ? (exception.getResponse() as Record<string, any>)['message']
            : exception.getResponse()) ||
          errorCodes[Exception.GENERAL_BAD_REQUEST]?.description;
        type = Exception.GENERAL_BAD_REQUEST;
        break;
      case exception instanceof HttpException:
        status = exception.getStatus();
        message = exception.message;
        type = exception.name;
        break;
      default:
        status = 500;
        message = errorCodes[Exception.GENERAL_SERVER_ERROR]?.description!;
        type = Exception.GENERAL_SERVER_ERROR;
        break;
    }

    if (!this.appConfig.get('app').isProduction && status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).send({
      code: status,
      message,
      type,
      version: '1.0.0',
      ...extra,
    });
  }
}
