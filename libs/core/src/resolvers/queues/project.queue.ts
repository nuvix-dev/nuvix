import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';

import { Inject, Logger } from '@nestjs/common';
import { Database, Document, DuplicateException, ID } from '@nuvix/database';
import type { PoolStoreFn, GetProjectDbFn } from '@nuvix/core/core.module';
import {
  POOLS,
  GET_PROJECT_DB,
  DB_FOR_CONSOLE,
  APP_POSTGRES_HOST,
  APP_POSTGRES_PORT,
  APP_POSTGRES_PASSWORD,
  APP_POSTGRES_USER,
  INTERNAL_SCHEMAS,
  SYSTEM_SCHEMA,
  APP_INTERNAL_POOL_API,
} from '@nuvix/utils/constants';
import collections from '@nuvix/core/collections';
import { DataSource } from '@nuvix/pg';
import { Exception } from '@nuvix/core/extend/exception';
import { HttpService } from '@nestjs/axios';

@Processor('projects')
export class ProjectQueue extends Queue {
  private readonly logger = new Logger(ProjectQueue.name);

  constructor(
    @Inject(POOLS) private readonly getPool: PoolStoreFn,
    @Inject(GET_PROJECT_DB) private readonly getProjectDb: GetProjectDbFn,
    @Inject(DB_FOR_CONSOLE) private readonly db: Database,
    private readonly httpService: HttpService,
  ) {
    super();
  }

  async process(
    job: Job<ProjectQueueOptions, any, ProjectJobs>,
    token?: string,
  ): Promise<any> {
    switch (job.name) {
      case 'init':
        const project = new Document(job.data.project as object);
        return await this.initProject(project);
      default: // noop
    }
  }

  private async initProject(project: Document): Promise<void> {
    const dbName = `p${ID.unique().slice(-10)}${project.getInternalId()}`;
    const pool = await this.getPool('root', { max: 2 });
    const roleSuffix = `${project.getInternalId()}_${Math.floor(Date.now() / 1000).toString(36)}`;
    const client = await pool.connect();

    const projectAdmin = `nuvix_${roleSuffix}`;
    const projectUser = `role_${roleSuffix}`;
    const projectPassword = project.getAttribute('database').password;
    const projectHost = APP_POSTGRES_HOST;
    const projectPort = APP_POSTGRES_PORT;
    const projectDatabase = dbName;

    try {
      const checkResult = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [projectDatabase],
      );

      if (checkResult.rowCount === 0) {
        await client.query(`CREATE DATABASE "${projectDatabase}"`);
        this.logger.log(`Created database: ${projectDatabase}`);
      }

      // 2. Create admin role with full privileges
      this.logger.debug('NOW CREATING ADMIN ROLE')
      await client.query(
        `CREATE ROLE "${projectAdmin}" WITH LOGIN PASSWORD '${APP_POSTGRES_PASSWORD}' CREATEROLE NOCREATEDB`,
      );
      this.logger.debug('ASSIGINING OWNERSHIP')
      await client.query(
        `ALTER DATABASE "${projectDatabase}" OWNER TO "${projectAdmin}"`,
      );

      // 3. Create user role with limited privileges
      this.logger.debug('SECOND USER')
      await client.query(
        `CREATE ROLE "${projectUser}" WITH LOGIN PASSWORD '${projectPassword}' NOCREATEDB NOCREATEROLE NOREPLICATION`,
      );
      this.logger.debug('GRANTING...')
      await client.query(
        `GRANT CONNECT ON DATABASE "${projectDatabase}" TO "${projectUser}"`,
      );

      try {
        // We don't need this client anymore
        client.release();
        if (!pool.ended) {
          await pool.end();
        }
      } catch (e) {
        this.logger.error(e);
      }

      const requestBody = {
        dbName: projectDatabase,
        options: {
          users: [
            { username: projectAdmin, password: APP_POSTGRES_PASSWORD },
            { username: projectUser, password: projectPassword },
          ],
          shard: {
            servers: [[projectHost, parseInt(process.env.APP_CLUSTER_PORT, 10), 'primary']],
            database: projectDatabase,
          },
        },
      }
      console.log(requestBody)
      // Create the database in the pool
      // [noop] not a good solution but it works for now!
      const res = await this.httpService.axiosRef.post(
        `${APP_INTERNAL_POOL_API}/config/add-db`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (res.status > 300) {
        throw new Error('Failed to add database to the pool');
      }

      // Init the database
      const projectPool = await this.getPool(project.getId(), {
        database: projectDatabase,
        user: APP_POSTGRES_USER,
        password: APP_POSTGRES_PASSWORD,
        host: projectHost,
        port: projectPort,
        max: 2,
      });

      const dataSource = new DataSource(await projectPool.connect());
      try {
        await dataSource.init();
      } catch (e) {
        this.logger.error(e);
        throw new Error('Failed to initialize data source');
      }

      try {
        await dataSource.createSchema(
          'auth',
          'document',
          'This schema is used to store and manage authentication data and documents.',
        );

        await dataSource.createSchema(
          'storage',
          'document',
          'This schema is used to store and manage file storage data and documents.',
        );

        await dataSource.createSchema(
          'functions',
          'document',
          'This schema is used to store and manage serverless functions and their configurations.',
        );

        await dataSource.createSchema(
          'messaging',
          'document',
          'This schema is used to store and manage messaging and notification data.',
        );

        // Set up permissions for projectUser on public schema
        await dataSource.execute(`
          -- Grant read-only access to internal schemas
          ${INTERNAL_SCHEMAS.map(
          schema => `
            GRANT USAGE ON SCHEMA ${schema} TO "${projectUser}";
            GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO "${projectUser}";
            GRANT SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO "${projectUser}";
            GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO "${projectUser}";
            
            -- Set default privileges for future objects in internal schemas (read-only)
            ALTER DEFAULT PRIVILEGES FOR ROLE "${projectAdmin}" IN SCHEMA ${schema}
            GRANT SELECT ON TABLES TO "${projectUser}";
            ALTER DEFAULT PRIVILEGES FOR ROLE "${projectAdmin}" IN SCHEMA ${schema}
            GRANT SELECT ON SEQUENCES TO "${projectUser}";
            ALTER DEFAULT PRIVILEGES FOR ROLE "${projectAdmin}" IN SCHEMA ${schema}
            GRANT EXECUTE ON FUNCTIONS TO "${projectUser}";
          `,
        ).join('\n')}
          
          -- Grant full access to public schema only
          GRANT USAGE ON SCHEMA public TO "${projectUser}";
          GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${projectUser}";
          GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${projectUser}";
          GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO "${projectUser}";

          -- Set default privileges for future objects in public schema
          ALTER DEFAULT PRIVILEGES FOR ROLE "${projectAdmin}" IN SCHEMA public
          GRANT ALL PRIVILEGES ON TABLES TO "${projectUser}";
          ALTER DEFAULT PRIVILEGES FOR ROLE "${projectAdmin}" IN SCHEMA public
          GRANT ALL PRIVILEGES ON SEQUENCES TO "${projectUser}";
          ALTER DEFAULT PRIVILEGES FOR ROLE "${projectAdmin}" IN SCHEMA public
          GRANT ALL PRIVILEGES ON FUNCTIONS TO "${projectUser}";
          
          -- Revoke schema creation permission from projectUser
          REVOKE CREATE ON DATABASE ${projectDatabase} FROM "${projectUser}";

          -- Revoke all privileges on the system schema
          REVOKE ALL PRIVILEGES ON SCHEMA ${SYSTEM_SCHEMA} FROM "${projectUser}";
        `);
      } catch (e) {
        this.logger.error(e);
        throw new Error('Failed to create schemas and set permissions');
      } finally {
        if (projectPool) {
          try {
            dataSource.getClient().release();
            projectPool.end();
          } catch { }
        }
      }

      project = await this.db.updateDocument(
        'projects',
        project.getId(),
        project
          .setAttribute('database', {
            ...project.getAttribute('database'),
            name: dbName,
            host: APP_POSTGRES_HOST,
            port: APP_POSTGRES_PORT,
            adminRole: projectAdmin,
            userRole: projectUser,
          })
          .setAttribute('status', 'active'),
      );

      const adminPool = await this.getPool(project.getId(), {
        database: projectDatabase,
        user: projectAdmin,
        password: APP_POSTGRES_PASSWORD,
        host: projectHost,
        port: projectPort,
        max: 2,
      });

      const schemas = Object.entries(collections.project) ?? [];
      for (const [schema, $collections] of schemas) {
        const collections = Object.entries($collections) ?? [];
        const db = this.getProjectDb(adminPool, project.getId());
        db.setDatabase(schema);
        await db.create(schema);
        for (const [key, collection] of collections) {
          if (collection['$collection'] !== Database.METADATA) {
            continue;
          }

          const attributes = collection['attributes'].map(
            (attribute: any) => new Document(attribute),
          );

          const indexes = collection['indexes'].map(
            (index: any) => new Document(index),
          );

          try {
            await db.createCollection(collection.$id, attributes, indexes);
          } catch (error) {
            if (!(error instanceof DuplicateException)) {
              throw error;
            }
          }
        }
      }

      try {
        await adminPool.end();
      } catch { }
    } catch (error) {
      this.logger.error(
        `Failed to create database: ${error.message}`,
        error.stack,
      );
      try {
        await client.query(
          `DROP DATABASE IF EXISTS ${projectDatabase} WITH (FORCE);`,
        );
        await client.query(`DROP ROLE IF EXISTS "${projectAdmin}";`);
        await client.query(`DROP ROLE IF EXISTS "${projectUser}";`);
      } catch (e) {
        this.logger.error(`Failed to drop database: ${e.message}`, e.stack);
      }
      await this.db.updateDocument(
        'projects',
        project.getId(),
        project.setAttribute('status', 'failed'),
      );
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to create project database',
      );
    } finally {
      if (client) {
        try {
          client.release();
        } catch { }
      }
    }
    this.logger.log(`Project ${project.getId()} successfully initialized.`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.verbose(`Processing job ${job.id} of type ${job.name}...`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${JSON.stringify(err)}`,
    );
  }
}

export interface ProjectQueueOptions {
  project: object | Document;
}

export type ProjectJobs = 'init';
