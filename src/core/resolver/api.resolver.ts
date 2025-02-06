import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class ApiInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method;
    const url = request.url;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        Logger.log(
          `${method} ${url} ${Date.now() - start}ms`,
          context.getClass().name,
        );
      }),
    );
  }
}
