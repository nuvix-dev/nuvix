import { Inject, Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Document } from '@nuvix/database';
import ParamsHelper from '@nuvix/core/helper/params.helper';

import {
  APP_POSTGRES_PASSWORD,
  AUTH_SCHEMA_DB,
  DB_FOR_CONSOLE,
  GET_PROJECT_DB,
  GET_PROJECT_PG,
  POOLS,
  PROJECT,
  PROJECT_DB,
  PROJECT_PG,
  PROJECT_POOL,
} from '@nuvix/utils/constants';
import { Hook } from '../../server/hooks/interface';
import type {
  GetProjectDbFn,
  GetProjectPG,
  PoolStoreFn,
} from '@nuvix/core/core.module';
import { Exception } from '@nuvix/core/extend/exception';
import { Cache } from '@nuvix/cache';
import { PoolClient } from 'pg';
import { DataSource } from '@nuvix/pg';

@Injectable()
export class ProjectHook implements Hook {
  private readonly logger = new Logger(ProjectHook.name);
  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly db: Database,
    @Inject(POOLS) private readonly getPool: PoolStoreFn,
    @Inject(GET_PROJECT_PG) private readonly gerProjectPg: GetProjectPG,
    @Inject(GET_PROJECT_DB)
    private readonly getProjectDb: GetProjectDbFn,
  ) {}

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
        const pool = await this.getPool(project.getId(), {
          database: dbOptions.name,
          user: dbOptions.adminRole,
          password: APP_POSTGRES_PASSWORD,
          port: dbOptions.port,
          host: dbOptions.host,
          max: 30,
        });
        req[PROJECT_POOL] = pool;
        req[PROJECT_DB] = this.getProjectDb(pool, project.getId());
        req[PROJECT_PG] = this.gerProjectPg(await pool.connect());
        const authDB = this.getProjectDb(pool, project.getId());
        authDB.setDatabase('auth');
        req[AUTH_SCHEMA_DB] = authDB;
      } catch (e) {
        this.logger.error('Something went wrong while connecting database.', e);
        throw new Exception(Exception.GENERAL_SERVER_ERROR);
      }
    }

    req[PROJECT] = project;
    return null;
  }

  async onResponse(req: NuvixRequest) {
    const dataSource: DataSource | undefined = req[PROJECT_PG];
    if (dataSource && dataSource instanceof DataSource) {
      try {
        const client: PoolClient | undefined = dataSource.getClient();
        if (client) {
          client.release();
        }

        // Clear the reference to prevent potential memory leaks
        req[PROJECT_PG] = undefined;
      } catch (error) {
        this.logger.error('Error releasing pool client', error);
      }
    }
  }
}
