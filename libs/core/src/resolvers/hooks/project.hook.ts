import { Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Doc } from '@nuvix-tech/db';
import ParamsHelper from '@nuvix/core/helper/params.helper';

import {
  Schemas,
  AUTH_SCHEMA_DB,
  CORE_SCHEMA_DB,
  AUDITS_FOR_PROJECT,
  AppMode,
  Context,
  PROJECT_DB_CLIENT,
  PROJECT_PG,
  type DatabaseConfig,
  DatabaseRole,
  DEFAULT_DATABASE,
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
  protected dbRole: DatabaseRole = DatabaseRole.ADMIN;

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
    const devKey = params.getFromHeaders('x-dev-key');

    if (!projectId || projectId === 'console') {
      req[Context.Project] = new Doc({ $id: 'console' });
      return null;
    }

    const project = await Authorization.skip(() =>
      this.db.getDocument('projects', projectId),
    );

    if (!project.empty()) {
      const environment = project.get('environment');

      if (environment === 'dev') {
        const envToken = await Authorization.skip(
          () => this.db.findOne('envtokens',
            qb => {
              qb = qb.equal('projectInternalId', project.getSequence());
              return devKey ? qb.equal('token', devKey) : qb;
            }
          )
        );

        if (envToken.empty()) {
          throw new Exception(Exception.GENERAL_BAD_REQUEST, 'Invalid environment token. Please ensure dev mode is properly configured and the token is correct.');
        }

        const dbConfig = project.get('database') as unknown as DatabaseConfig;
        const metadata = envToken.get('metadata');

        if (!metadata['host'] || !metadata['port'])
          throw new Exception(Exception.GENERAL_UNKNOWN, 'Missing required metadata: host or port for dev environment.');

        dbConfig.pool['host'] = metadata['host'];
        dbConfig.pool['port'] = metadata['pool_port'];
        dbConfig.postgres['host'] = metadata['host'];
        dbConfig.postgres['port'] = metadata['port'];

        project.set('database', dbConfig);
      }

      try {
        const dbOptions = project.get('database') as unknown as DatabaseConfig;
        const client = await this.coreService.createProjectDbClient(
          project.getId(),
          {
            database: DEFAULT_DATABASE,
            user: this.dbRole,
            password: dbOptions.pool.password, // TODO: we have to use here admin password for admin
            port: dbOptions.pool.port || dbOptions.postgres.port,
            host: dbOptions.pool.host,
          },
        );
        client.setMaxListeners(20);
        req[PROJECT_DB_CLIENT] = client;

        await setupDatabaseMeta({
          client,
          project,
          request: req,
        });

        req[PROJECT_PG] = this.coreService.getProjectPg(client);
        const coreDatabase = this.coreService.getProjectDb(client, {
          projectId: project.getId(),
          schema: Schemas.Core,
        });
        const authDatabase = this.coreService.getProjectDb(client, {
          projectId: project.getId(),
          schema: Schemas.Auth,
        });
        req[AUTH_SCHEMA_DB] = authDatabase;
        req[CORE_SCHEMA_DB] = coreDatabase;
        req[AUDITS_FOR_PROJECT] = new Audit(coreDatabase);
      } catch (e) {
        // TODO: improve the error handling
        this.logger.error('Something went wrong while connecting database.', e);
        throw new Exception(Exception.GENERAL_SERVER_ERROR,
          'Database connection faild.'
        );
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
        req[PROJECT_DB_CLIENT] = undefined;
        req[AUTH_SCHEMA_DB] = undefined;
        req[CORE_SCHEMA_DB] = undefined;
        req[AUDITS_FOR_PROJECT] = undefined;
      } catch (error) {
        this.logger.error('An error occured while ending the client: ', error);
      }
    }
  }
}
