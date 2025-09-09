import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { errorCodes, Exception } from '../extend/exception';
import { AppConfigService } from '../config.service';
import {
  AuthorizationException,
  ConflictException,
  DuplicateException,
  IndexException,
  NotFoundException,
  OrderException,
  QueryException,
  RelationshipException,
  TimeoutException,
  TruncateException,
} from '@nuvix-tech/db';

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
      case exception instanceof AuthorizationException:
        status = HttpStatus.FORBIDDEN;
        message =
          exception.message ||
          errorCodes[Exception.GENERAL_ACCESS_FORBIDDEN]?.description!;
        type = Exception.GENERAL_ACCESS_FORBIDDEN;
        break;

      case exception instanceof QueryException:
      case exception instanceof RelationshipException:
        status = HttpStatus.BAD_REQUEST;
        message =
          exception.message ||
          errorCodes[Exception.GENERAL_BAD_REQUEST]!.description;
        type = Exception.GENERAL_BAD_REQUEST;
        break;

      case exception instanceof ConflictException:
      case exception instanceof DuplicateException:
        status = HttpStatus.CONFLICT;
        message =
          exception.message || 'A conflict or duplicate entry error occurred.';
        type = Exception.GENERAL_BAD_REQUEST;
        break;

      case exception instanceof NotFoundException:
        status = HttpStatus.NOT_FOUND;
        message =
          exception.message ||
          errorCodes[Exception.GENERAL_NOT_FOUND]!.description;
        type = Exception.GENERAL_NOT_FOUND;
        break;

      case exception instanceof TimeoutException:
        status = HttpStatus.REQUEST_TIMEOUT;
        message =
          exception.message ||
          errorCodes[Exception.DATABASE_TIMEOUT]?.description!;
        type = Exception.DATABASE_TIMEOUT;
        break;

      case exception instanceof TruncateException:
      case exception instanceof IndexException:
      case exception instanceof OrderException:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message =
          exception.message || 'A structural or data integrity error occurred.';
        type = Exception.GENERAL_SERVER_ERROR;
        break;

      default:
        status = 500;
        message = errorCodes[Exception.GENERAL_SERVER_ERROR]?.description!;
        type = Exception.GENERAL_SERVER_ERROR;
        break;
    }

    message ??= (exception as any)?.message;

    if (status >= 500) {
      this.logger.error(exception);
    }

    request['error'] = { message, type, ...extra };

    if (!this.appConfig.get('app').isProduction) {
      extra['exception'] = (exception as any)?.stack;
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
