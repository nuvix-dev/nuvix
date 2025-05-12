import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';

import { Inject, Logger } from '@nestjs/common';
import { Database, Document, DuplicateException } from '@nuvix/database';
import type {
  PoolStoreFn,
  GetProjectPG,
  GetProjectDbFn,
} from '@nuvix/core/core.module';
import { POOLS, GET_PROJECT_PG, GET_PROJECT_DB } from '@nuvix/utils/constants';
import collections from '@nuvix/core/collections';

@Processor('projects')
export class ProjectQueue extends Queue {
  private readonly logger = new Logger(ProjectQueue.name);

  constructor(
    @Inject(POOLS) private readonly getPool: PoolStoreFn,
    @Inject(GET_PROJECT_PG) private readonly getProjectPg: GetProjectPG,
    @Inject(GET_PROJECT_DB) private readonly getProjectDb: GetProjectDbFn,
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
    const pool = await this.getPool(project.getId(), {
      database: project.getAttribute('database'),
    });
    const postgreDb = this.getProjectPg(await pool.connect());

    try {
      await postgreDb.createSchema(
        'auth',
        'document',
        'This schema is used to store and manage authentication data and documents.',
      );

      await postgreDb.createSchema(
        'storage',
        'document',
        'This schema is used to store and manage file storage data and documents.',
      );

      await postgreDb.createSchema(
        'functions',
        'document',
        'This schema is used to store and manage serverless functions and their configurations.',
      );

      await postgreDb.createSchema(
        'messaging',
        'document',
        'This schema is used to store and manage messaging and notification data.',
      );
    } catch (e) {
      this.logger.error(e);
      throw e;
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
