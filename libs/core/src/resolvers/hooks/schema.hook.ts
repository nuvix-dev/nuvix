import { Injectable } from '@nestjs/common';
import { DataSource, Context as DataSourceContext } from '@nuvix/pg';
import { Exception } from '@nuvix/core/extend/exception';
import { Hook } from '@nuvix/core/server';
import {
  AppMode,
  Context,
  CURRENT_SCHEMA_DB,
  CURRENT_SCHEMA_PG,
  DatabaseRole,
  PROJECT_DB_CLIENT,
  PROJECT_PG,
  Schemas,
  type Schema,
} from '@nuvix/utils';
import type { ProjectsDoc, UsersDoc } from '@nuvix/utils/types';
import { CoreService } from '@nuvix/core/core.service.js';
import type { Client } from 'pg';
import { Auth } from '@nuvix/core/helper';

@Injectable()
export class SchemaHook implements Hook {
  constructor(private readonly coreService: CoreService) {}

  async preHandler(request: NuvixRequest) {
    const project = request[Context.Project] as ProjectsDoc;
    if (project.empty() || project.getId() === 'console') {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }
    const user: UsersDoc = request[Context.User];
    const mode: AppMode = request[Context.Mode];
    let role = DatabaseRole.POSTGRES;
    const client = request[PROJECT_DB_CLIENT] as Client;
    const pg = request[PROJECT_PG] as DataSource;

    if (user.empty()) {
      role = DatabaseRole.ANON;
    } else {
      role = DatabaseRole.AUTHENTICATED;
    }

    const schemaId = (request.params as { schemaId: string | undefined })
      .schemaId;
    if (schemaId === undefined) return;
    const schema = await pg
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .where('name', schemaId)
      .first();

    if (schema) {
      if (!Auth.isTrustedActor) {
        if (!schema.enabled) {
          throw new Exception(Exception.SCHEMA_NOT_FOUND);
        }
        // TODO: Check if schema is publicly accessible
      }

      const pg = this.coreService.getProjectPg(
        client,
        new DataSourceContext({
          schema: schema.name,
        }),
      );
      request[CURRENT_SCHEMA_PG] = pg;
      if (schema.type === 'document') {
        const db = this.coreService.getProjectDb(client, {
          projectId: project.getId(),
          schema: schema.name,
        });
        request[CURRENT_SCHEMA_DB] = db;
      } else {
        if (mode !== AppMode.ADMIN) {
          try {
            await client.query(`SET ROLE ${role}`);
          } catch (e) {
            throw new Exception(
              Exception.GENERAL_SERVER_ERROR,
              'Unable to set request role.',
            ); // TODO: improve message
          }
        }
      }
    } else {
      throw new Exception(Exception.SCHEMA_NOT_FOUND);
    }

    return null;
  }
}
