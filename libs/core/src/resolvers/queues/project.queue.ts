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

@Processor('projects')
export class ProjectQueue extends Queue {
  private readonly logger = new Logger(ProjectQueue.name);

  constructor(
    @Inject(POOLS) private readonly getPool: PoolStoreFn,
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

  // Temp Setup (until infrastructure setup)
  private async initProject(project: Document): Promise<void> {
    const dbName = 'postgres';
    const pool = await this.getPool('root', { max: 2 });
    const client = await pool.connect();

    const projectHost = APP_POSTGRES_HOST;
    const projectPort = APP_POSTGRES_PORT;
    const projectDatabase = dbName;

    try {
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

      const dataSource = new DataSource(client);
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
      } catch (e) {
        this.logger.error(e);
        throw new Error('Failed to create schemas and set permissions');
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
      try {
        client.release();
        if (!pool.ended) {
          await pool.end();
        }
      } catch (e) {
        this.logger.error(e);
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
