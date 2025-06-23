import { Inject, Injectable } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { Context, DataSource } from '@nuvix/pg';

import type { GetProjectPG } from '@nuvix/core/core.module';
import { Exception } from '@nuvix/core/extend/exception';
import { Hook } from '@nuvix/core/server';
import {
  CURRENT_SCHEMA_PG,
  GET_PROJECT_PG,
  PROJECT,
  PROJECT_PG,
  PROJECT_POOL,
} from '@nuvix/utils/constants';

@Injectable()
export class SchemaHook implements Hook {
  constructor(
    @Inject(GET_PROJECT_PG) private readonly getProjectPG: GetProjectPG,
  ) {}

  async preHandler(request: NuvixRequest) {
    const project = request[PROJECT] as Document;
    if (project.isEmpty() || project.getId() === 'console') {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const pool = request[PROJECT_POOL];
    const pg = request[PROJECT_PG] as DataSource;

    const schemaId = (request.params as { schemaId: string | undefined })
      .schemaId ?? 'public';
    if (schemaId === undefined) return;
    const schema = await pg.getSchema(schemaId);
    if (schema) {
      const db = this.getProjectPG(
        pool,
        new Context({
          schema: schema.name,
        }),
      );
      request[CURRENT_SCHEMA_PG] = db;
    } else {
      throw new Exception(Exception.SCHEMA_NOT_FOUND);
    }

    return null;
  }
}
