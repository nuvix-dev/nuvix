import { Inject, Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Document } from '@nuvix/database';
import ParamsHelper from '@nuvix/core/helper/params.helper';
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  AUTH_SCHEMA_DB,
  CACHE,
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
import {
  GetProjectDbFn,
  GetProjectPG,
  PoolStoreFn,
} from '@nuvix/core/core.module';
import { Exception } from '@nuvix/core/extend/exception';
import { Cache } from '@nuvix/cache';
import { PoolClient } from 'pg';

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

  async onRequest(req: FastifyRequest, reply: FastifyReply) {
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
      this.logger.debug(`Project: ${project.getAttribute('name')}`);
      const databaseName = project.getAttribute('database');
      try {
        const pool = await this.getPool(project.getId(), {
          database: databaseName,
        });
        req[PROJECT_POOL] = pool;
        req[PROJECT_DB] = this.getProjectDb(pool, project.getId());
        req[PROJECT_PG] = this.gerProjectPg(await pool.connect());
        const authDB = this.getProjectDb(pool, project.getId());
        authDB.setDatabase('auth');
        authDB.setPrefix(project.getId());
        req[AUTH_SCHEMA_DB] = authDB;
      } catch (e) {
        this.logger.error('Something went wrong while connecting database.', e);
        throw new Exception(Exception.GENERAL_SERVER_ERROR);
      }
    }

    req[PROJECT] = project;
    return null;
  }

  async onResponse(req: FastifyRequest) {
    const client: PoolClient | undefined = req[PROJECT_PG];
    if (client) {
      try {
        client.release();
        this.logger.debug(`Pool client released`);
      } catch {
        /** noop */
      }
    }
  }
}
