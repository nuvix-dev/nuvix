import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Database } from '@nuvix-tech/db';
import { CURRENT_SCHEMA_DB } from '@nuvix/utils';

@Injectable()
export class DocSchemaGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const schemaDb = req[CURRENT_SCHEMA_DB];

    if (schemaDb && schemaDb instanceof Database) {
      return true;
    }

    return false;
  }
}
