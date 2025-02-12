import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Authorization } from '@nuvix/database';
import { Observable } from 'rxjs';


@Injectable()
export class ConsoleInterceptor implements NestInterceptor {

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {

    Authorization.setDefaultStatus(true)

    return next.handle();
  }

}