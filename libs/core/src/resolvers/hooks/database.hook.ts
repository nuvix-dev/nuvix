import { Inject, Injectable } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { DataSource } from '@nuvix/pg';

import { GetProjectDbFn } from '@nuvix/core/core.module';
import { Exception } from '@nuvix/core/extend/exception';
import { Hook } from '@nuvix/core/server';
import {
  CURRENT_SCHEMA_DB,
  GET_PROJECT_DB,
  PROJECT,
  PROJECT_PG,
  PROJECT_POOL_CLIENT,
} from '@nuvix/utils/constants';
import { PoolClient } from 'pg';

@Injectable()
export class DatabaseHook implements Hook {
  constructor(
    @Inject(GET_PROJECT_DB) private readonly getProjectDB: GetProjectDbFn,
  ) {}

  async preHandler(request: NuvixRequest) {
    const project = request[PROJECT] as Document;
    if (project.isEmpty() || project.getId() === 'console') {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const client: PoolClient = request[PROJECT_POOL_CLIENT];
    const pg = request[PROJECT_PG] as DataSource;

    const schemaId = (request.params as { id: string | undefined }).id;
    if (schemaId === undefined) return;

    const schema = await pg.getSchema(schemaId);
    if (!schema || schema.type !== 'document')
      throw new Exception(Exception.DATABASE_NOT_FOUND);

    const db = this.getProjectDB(client, project.getId());
    db.setDatabase(schema.name);
    request[CURRENT_SCHEMA_DB] = db;

    return null;
  }
}
