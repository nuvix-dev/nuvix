import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';

import { Inject, Logger } from '@nestjs/common';
import { Database, Document, DuplicateException, ID } from '@nuvix/database';
import type {
  PoolStoreFn,
  GetProjectPG,
  GetProjectDbFn,
} from '@nuvix/core/core.module';
import {
  POOLS,
  GET_PROJECT_PG,
  GET_PROJECT_DB,
  DB_FOR_CONSOLE,
  APP_POSTGRES_HOST,
  APP_POSTGRES_PORT,
  APP_POSTGRES_PASSWORD,
  APP_POSTGRES_USER,
} from '@nuvix/utils/constants';
import collections from '@nuvix/core/collections';
import { DataSource } from '@nuvix/pg';
import { Exception } from '@nuvix/core/extend/exception';

@Processor('projects')
export class ProjectQueue extends Queue {
  private readonly logger = new Logger(ProjectQueue.name);

  constructor(
    @Inject(POOLS) private readonly getPool: PoolStoreFn,
    @Inject(GET_PROJECT_PG) private readonly getProjectPg: GetProjectPG,
    @Inject(GET_PROJECT_DB) private readonly getProjectDb: GetProjectDbFn,
    @Inject(DB_FOR_CONSOLE) private readonly db: Database,
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
        await client.query(`CREATE DATABASE ${projectDatabase}`);
        await client.query(
          `CREATE ROLE "${projectAdmin}" WITH LOGIN PASSWORD $1 CREATEDB CREATEROLE`,
          [APP_POSTGRES_PASSWORD],
        );

        await client.query(
          `CREATE ROLE "${projectUser}" WITH LOGIN PASSWORD $1`,
          [projectPassword],
        );
        // Grant full access to projectAdmin role
        await client.query(
          `-- Grant admin role full privileges on the database
          GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${projectAdmin};
          
          -- Allow admin role to create schemas and manage roles
          ALTER ROLE ${projectAdmin} WITH CREATEDB CREATEROLE;
          
          -- Grant schema creation and role management permissions
          GRANT CREATE ON DATABASE ${dbName} TO ${projectAdmin};
          
          -- Grant ability to modify ownership and permissions
          ALTER DEFAULT PRIVILEGES FOR ROLE ${projectAdmin} IN SCHEMA public 
          GRANT ALL PRIVILEGES ON TABLES TO ${projectAdmin};
          
          -- Allow admin to grant permissions to others
          ALTER DEFAULT PRIVILEGES FOR ROLE ${projectAdmin}
          GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${projectAdmin} WITH GRANT OPTION;
          
          -- Allow admin to grant schema usage to others
          GRANT USAGE ON SCHEMA public TO ${projectAdmin} WITH GRANT OPTION; `,
        );

        this.logger.log(`Created database: ${projectDatabase}`);
      }

      try {
        // We don't need this client anymore
        client.release();
        if (!pool.ended) {
          await pool.end();
        }
      } catch (e) {
        this.logger.error(e);
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
        // TODO: Handle error & cleanup
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
      } catch (e) {
        this.logger.error(e);
        // TODO: Handle error & cleanup
      }

      // after

      // // For role_${roleSuffix}:
      // // - Restrict actions on protected schemas
      // // - Allow read-only access to all schemas
      // // - Grant full access to other schemas
      // await client.query(
      //   `GRANT CONNECT ON DATABASE ${dbName} TO $1`,
      //   [`role_${roleSuffix}`]
      // );

      // We need to connect to the newly created database to set schema-level permissions
      // const dbClient = await pool.connect();
      // try {
      //   await dbClient.query(`\\c ${dbName}`);

      //   // Ensure schemas exist before granting permissions
      //   await dbClient.query(`
      //     CREATE SCHEMA IF NOT EXISTS system;
      //     CREATE SCHEMA IF NOT EXISTS auth;
      //   `);

      //   // Read-only access to all schemas
      //   await dbClient.query(`
      //     ALTER DEFAULT PRIVILEGES GRANT USAGE ON SCHEMAS TO $1;
      //     ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO $1;
      //   `, [`role_${roleSuffix}`]);

      //   // Restrict protected schemas to read-only
      //   await dbClient.query(`
      //     REVOKE CREATE, DROP ON SCHEMA system, auth FROM $1;
      //     REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA system, auth FROM $1;
      //   `, [`role_${roleSuffix}`]);

      //   // Full access to other schemas (created later)
      //   await dbClient.query(`
      //     ALTER DEFAULT PRIVILEGES GRANT ALL PRIVILEGES ON TABLES TO $1;
      //     ALTER DEFAULT PRIVILEGES GRANT ALL PRIVILEGES ON SEQUENCES TO $1;
      //     ALTER DEFAULT PRIVILEGES GRANT ALL PRIVILEGES ON FUNCTIONS TO $1;
      //   `, [`role_${roleSuffix}`]);

      project = await this.db.updateDocument(
        'projects',
        project.getId(),
        project.setAttribute('database', {
          ...project.getAttribute('database'),
          name: dbName,
          host: APP_POSTGRES_HOST,
          port: APP_POSTGRES_PORT,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to create database: ${error.message}`,
        error.stack,
      );
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to create project database',
      );
    } finally {
      // Always release the connection
      // TODO: ----
    }

    const schemas = Object.entries(collections.project) ?? [];
    for (const [schema, $collections] of schemas) {
      const collections = Object.entries($collections) ?? [];
      const db = this.getProjectDb(pool, project.getId());
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

    this.logger.log(`Project ${project.getId()} successfully initialized.`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.verbose(`Processing job ${job.id} of type ${job.name}...`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${err.message}`,
    );
  }
}

export interface ProjectQueueOptions {
  project: object | Document;
}

export type ProjectJobs = 'init';
