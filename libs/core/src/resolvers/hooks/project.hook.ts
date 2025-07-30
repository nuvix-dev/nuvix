import { Inject, Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Document } from '@nuvix/database';
import ParamsHelper from '@nuvix/core/helper/params.helper';

import {
  APP_POSTGRES_PASSWORD,
  CORE_SCHEMA,
  CORE_SCHEMA_DB,
  DB_FOR_PLATFORM,
  GET_PROJECT_DB,
  GET_PROJECT_PG,
  PROJECT,
  PROJECT_DB,
  PROJECT_DB_CLIENT,
  PROJECT_PG,
  GET_PROJECT_DB_CLIENT,
  AUDITS_FOR_PROJECT,
  AppMode,
} from '@nuvix/utils/constants';
import { Hook } from '../../server/hooks/interface';
import type {
  GetProjectDbFn,
  GetProjectPG,
  GetClientFn,
} from '@nuvix/core/core.module';
import { Exception } from '@nuvix/core/extend/exception';
import { Client } from 'pg';
import { setupDatabaseMeta } from '@nuvix/core/helper/db-meta.helper';
import { Audit } from '@nuvix/audit';

@Injectable()
export class ProjectHook implements Hook {
  private readonly logger = new Logger(ProjectHook.name);
  constructor(
    @Inject(DB_FOR_PLATFORM) private readonly db: Database,
    @Inject(GET_PROJECT_DB_CLIENT) private readonly getPool: GetClientFn,
    @Inject(GET_PROJECT_PG) private readonly getProjectPg: GetProjectPG,
    @Inject(GET_PROJECT_DB)
    private readonly getProjectDb: GetProjectDbFn,
  ) { }

  async onRequest(req: NuvixRequest) {
    const params = new ParamsHelper(req);
    const projectId =
      params.getFromHeaders('x-nuvix-project') ||
      params.getFromQuery('project', 'console');

    if (projectId === 'console') {
      req[PROJECT] = new Document({ $id: 'console' });
      return null;
    }

    const project = await Authorization.skip(
      async () => await this.db.getDocument('projects', projectId as string),
    );

    if (!project.isEmpty()) {
      // For testing & demo purpose (until infra. setup)
      project.setAttribute('database', {
        ...project.getAttribute('database'),
        name: 'postgres',
        host: '35.244.24.126',
        port: 6432,
        adminRole: 'nuvix_admin',
        password: APP_POSTGRES_PASSWORD,
        userRole: 'postgres',
        userPassword: 'testpassword',
      });
      try {
        const dbOptions = project.getAttribute('database');
        const client = await this.getPool(project.getId(), {
          database: dbOptions.name,
          user: dbOptions.adminRole,
          password: APP_POSTGRES_PASSWORD,
          port: dbOptions.port,
          host: dbOptions.host,
          max: 10,
        });
        client.setMaxListeners(20);
        req[PROJECT_DB_CLIENT] = client;

        await setupDatabaseMeta({
          client,
          project,
          request: req,
        });

        req[PROJECT_DB] = this.getProjectDb(client, project.getId());
        req[PROJECT_PG] = this.getProjectPg(client);
        const coreDatabase = this.getProjectDb(client, project.getId());
        coreDatabase.setDatabase(CORE_SCHEMA);
        req[CORE_SCHEMA_DB] = coreDatabase;
        req[AUDITS_FOR_PROJECT] = new Audit(coreDatabase);
      } catch (e) {
        // TODO: improve the error handling
        this.logger.error('Something went wrong while connecting database.', e);
        throw new Exception(Exception.GENERAL_SERVER_ERROR);
      }
    }

    req[PROJECT] = project;
    req[AppMode._REQUEST] = params.get('mode') || AppMode.DEFAULT;
    return null;
  }

  async onResponse(req: NuvixRequest) {
    const client: Client = req[PROJECT_DB_CLIENT];
    if (client) {
      try {
        await client.end();

        // Clear the reference to prevent potential memory leaks
        req[PROJECT_PG] = undefined;
      } catch (error) {
        this.logger.error('An error occured while ending the client: ', error);
      }
    }
  }
}
