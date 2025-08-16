import { Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Doc } from '@nuvix-tech/db';
import ParamsHelper from '@nuvix/core/helper/params.helper';

import {
  CORE_SCHEMA,
  CORE_SCHEMA_DB,
  AUDITS_FOR_PROJECT,
  AppMode,
  Context,
  PROJECT_DB_CLIENT,
  PROJECT_DB,
  PROJECT_PG,
} from '@nuvix/utils';
import { Hook } from '../../server/hooks/interface';
import { Exception } from '@nuvix/core/extend/exception';
import { Client } from 'pg';
import { setupDatabaseMeta } from '@nuvix/core/helper/db-meta.helper';
import { Audit } from '@nuvix/audit';
import { CoreService } from '@nuvix/core/core.service.js';
import { AppConfigService } from '@nuvix/core/config.service.js';

@Injectable()
export class ProjectHook implements Hook {
  private readonly logger = new Logger(ProjectHook.name);
  private readonly db: Database;
  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
  ) {
    this.db = coreService.getPlatformDb();
  }

  async onRequest(req: NuvixRequest) {
    const params = new ParamsHelper(req);
    const projectId =
      params.getFromHeaders('x-nuvix-project') ||
      params.getFromQuery('project', 'console');

    if (!projectId || projectId === 'console') {
      req[Context.Project] = new Doc({ $id: 'console' });
      return null;
    }

    const project = await Authorization.skip(
      () => this.db.getDocument('projects', projectId),
    );

    if (!project.empty()) {
      // For testing & demo purpose (until infra. setup)
      project.set('database', {
        ...project.get('database') as unknown as Record<string, any>,
        name: 'postgres',
        host: '35.244.24.126',
        port: 6432,
        adminRole: 'nuvix_admin',
        password: this.appConfig.getDatabaseConfig().postgres.password,
        userRole: 'postgres',
        userPassword: 'testpassword',
      });
      try {
        const dbOptions = project.get('database') as unknown as Record<string, any>;
        const client = await this.coreService.createProjectDbClient(project.getId(), {
          database: dbOptions['name'],
          user: dbOptions['adminRole'],
          password: this.appConfig.getDatabaseConfig().postgres.password as string,
          port: dbOptions['port'],
          host: dbOptions['host'],
        });
        client.setMaxListeners(20);
        req[PROJECT_DB_CLIENT] = client;

        await setupDatabaseMeta({
          client,
          project,
          request: req,
        });

        req[PROJECT_DB] = this.coreService.getProjectDb(client, project.getId());
        req[PROJECT_PG] = this.coreService.getProjectPg(client);
        const coreDatabase = this.coreService.getProjectDb(client, project.getId());
        coreDatabase.setMeta({
          schema: CORE_SCHEMA,
        });
        req[CORE_SCHEMA_DB] = coreDatabase;
        req[AUDITS_FOR_PROJECT] = new Audit(coreDatabase);
      } catch (e) {
        // TODO: improve the error handling
        this.logger.error('Something went wrong while connecting database.', e);
        throw new Exception(Exception.GENERAL_SERVER_ERROR);
      }
    }

    req[Context.Project] = project;
    req[Context.Mode] = params.get('mode') || AppMode.DEFAULT;
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
