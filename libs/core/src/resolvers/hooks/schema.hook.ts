import { Injectable } from '@nestjs/common';
import { DataSource, Context as DataSourceContext } from '@nuvix/pg';
import { Exception } from '@nuvix/core/extend/exception';
import { Hook } from '@nuvix/core/server';
import {
  Context,
  CURRENT_SCHEMA_DB,
  CURRENT_SCHEMA_PG,
  PROJECT_DB_CLIENT,
  PROJECT_PG,
} from '@nuvix/utils';
import type { ProjectsDoc } from '@nuvix/utils/types';
import { CoreService } from '@nuvix/core/core.service.js';
import type { Client } from 'pg';

@Injectable()
export class SchemaHook implements Hook {
  constructor(
    private readonly coreService: CoreService,
  ) {}

  async preHandler(request: NuvixRequest) {
    const project = request[Context.Project] as ProjectsDoc;
    if (project.empty() || project.getId() === 'console') {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const client = request[PROJECT_DB_CLIENT] as Client;
    const pg = request[PROJECT_PG] as DataSource;

    const schemaId =
      (request.params as { schemaId: string | undefined; }).schemaId ?? 'public';
    if (schemaId === undefined) return;
    const schema = await pg.getSchema(schemaId);
    if (schema) {
      const pg = this.coreService.getProjectPg(
        client,
        new DataSourceContext({
          schema: schema.name,
        }),
      );
      request[CURRENT_SCHEMA_PG] = pg;
      if (schema.type === 'document') {
        const db = this.coreService.getProjectDb(client, project.getId());
        db.setMeta({
          schema: schema.name,
          // cacheId: `${project.getId()}:${schemaId}`, // Uncomment after implementing cache
        });
        request[CURRENT_SCHEMA_DB] = db;
      }
    } else {
      throw new Exception(Exception.SCHEMA_NOT_FOUND);
    }

    return null;
  }
}
