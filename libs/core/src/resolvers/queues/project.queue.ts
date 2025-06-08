import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';

import { Inject, Logger } from '@nestjs/common';
import { Database, Document, DuplicateException, ID } from '@nuvix/database';
import type { PoolStoreFn, GetProjectDbFn } from '@nuvix/core/core.module';
import {
  POOLS,
  GET_PROJECT_DB,
  DB_FOR_PLATFORM,
  APP_POSTGRES_HOST,
  APP_POSTGRES_PORT,
  APP_POSTGRES_PASSWORD,
  APP_POSTGRES_USER,
  INTERNAL_SCHEMAS,
  SYSTEM_SCHEMA,
  APP_INTERNAL_POOL_API,
  CORE_SCHEMA,
} from '@nuvix/utils/constants';
import collections from '@nuvix/core/collections';
import { DataSource } from '@nuvix/pg';
import { Exception } from '@nuvix/core/extend/exception';

@Processor('projects')
export class ProjectQueue extends Queue {
  private readonly logger = new Logger(ProjectQueue.name);

  constructor(
    @Inject(POOLS) private readonly getPool: PoolStoreFn,
    @Inject(GET_PROJECT_DB) private readonly getProjectDb: GetProjectDbFn,
    @Inject(DB_FOR_PLATFORM) private readonly db: Database,
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
        await this.initProject(project);
      default: // noop
    }
  }

  // Temp Setup (until infrastructure setup)
  private async initProject(project: Document): Promise<void> {
    const dbName = 'postgres';
    let pool: any = null;
    let client: any = null;
    let db: any = null;

    const projectHost = APP_POSTGRES_HOST;
    const projectPort = APP_POSTGRES_PORT;
    const projectDatabase = dbName;

    try {
      // Get pool with retry mechanism
      pool = await this.getPoolWithRetries(project, { max: 10 });
      client = await pool.connect();

      // Update project document with database configuration
      project = await this.db.updateDocument(
        'projects',
        project.getId(),
        project
          .setAttribute('database', {
            ...project.getAttribute('database'),
            password: APP_POSTGRES_PASSWORD,
            name: dbName,
            host: APP_POSTGRES_HOST,
            port: APP_POSTGRES_PORT,
            adminRole: 'nuvix_admin',
            userRole: 'postgres',
          })
          .setAttribute('status', 'active'),
      );

      // Initialize data source
      const dataSource = new DataSource(client);
      try {
        await dataSource.init();
        this.logger.log(`Data source initialized for project ${project.getId()}`);
      } catch (error) {
        this.logger.error(`Failed to initialize data source: ${error.message}`);
        throw new Exception('Failed to initialize data source');
      }

      // Create core schema
      try {
        await dataSource.createSchema(
          CORE_SCHEMA,
          'document',
          'This schema is used to store and manage core data and documents.',
        );
        this.logger.log(`Schema ${CORE_SCHEMA} created successfully for project ${project.getId()}`);
      } catch (error) {
        this.logger.error(`Failed to create schema ${CORE_SCHEMA}: ${error.message}`);
        throw new Exception('Failed to create schemas and set permissions');
      }

      // Setup database and collections
      db = this.getProjectDb(pool, project.getId());
      db.setDatabase(CORE_SCHEMA);
      await db.create(CORE_SCHEMA);

      const $collections = Object.entries(collections.project) ?? [];
      let successfulCollections = 0;
      let failedCollections = 0;

      for (const [_, collection] of $collections) {
        if (collection['$collection'] !== Database.METADATA) {
          continue;
        }

        try {
          const attributes = collection['attributes']?.map(
            (attribute: any) => new Document(attribute),
          ) || [];

          const indexes = collection['indexes']?.map(
            (index: any) => new Document(index),
          ) || [];

          this.logger.log(
            `Creating collection ${collection.$id} in schema ${CORE_SCHEMA} for project ${project.getId()}`,
          );

          await db.createCollection(collection.$id, attributes, indexes);
          successfulCollections++;

        } catch (error) {
          if (error instanceof DuplicateException) {
            this.logger.warn(
              `Collection ${collection.$id} already exists in schema ${CORE_SCHEMA} for project ${project.getId()}`,
            );
            successfulCollections++;
          } else {
            this.logger.error(
              `Failed to create collection ${collection.$id} in schema ${CORE_SCHEMA} for project ${project.getId()}: ${error.message}`,
            );
            failedCollections++;
            throw error;
          }
        }
      }

      this.logger.log(
        `Collection creation completed: ${successfulCollections} successful, ${failedCollections} failed for project ${project.getId()}`,
      );

    } catch (error) {
      this.logger.error(
        `Failed to initialize project ${project.getId()}: ${error.message}`,
      );
      throw new Exception(
        `Failed to initialize project ${project.getId()}: ${error.message}`,
      );
    } finally {
      // Cleanup resources in reverse order
      if (db) {
        try {
          await db.close();
          this.logger.debug(`Database connection closed for project ${project.getId()}`);
        } catch (error) {
          this.logger.error(`Failed to close database connection: ${error.message}`);
        }
      }

      if (client) {
        try {
          client.release();
          this.logger.debug(`Client connection released for project ${project.getId()}`);
        } catch (error) {
          this.logger.error(`Failed to release client connection: ${error.message}`);
        }
      }

      this.logger.log(
        `Project ${project.getId()} initialization completed with database ${dbName} at ${projectHost}:${projectPort}`,
      );
    }
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

  async getPoolWithRetries(
    project: Document,
    config: Parameters<PoolStoreFn>['1'],
  ) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 5000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const pool = await this.getPool(project.getId(), config as any);
        return pool;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} failed: ${error.message}`);

        if (attempt < MAX_RETRIES) {
          console.log(
            `Waiting ${RETRY_DELAY_MS / 1000} seconds before retrying...`,
          );
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    throw new Error(
      `Failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`,
    );
  }
}

export interface ProjectQueueOptions {
  project: object | Document;
}

export type ProjectJobs = 'init';
