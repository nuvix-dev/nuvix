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

@Processor('schema')
export class SchemaQueue extends Queue {
  private readonly logger = new Logger(SchemaQueue.name);

  constructor(
    @Inject(POOLS) private readonly getPool: PoolStoreFn,
    @Inject(GET_PROJECT_PG) private readonly getProjectPg: GetProjectPG,
    @Inject(GET_PROJECT_DB) private readonly getProjectDb: GetProjectDbFn,
  ) {
    super();
  }

  async process(
    job: Job<SchemaQueueOptions, any, SchemaJobs>,
    token?: string,
  ): Promise<any> {
    switch (job.name) {
      case 'init_doc':
        const project = new Document(job.data.project as object);
        return await this.initDocumentSchema(project, job.data.schema);
      case 'process': // added case for 'process'
        break; // added break statement
      default: // noop
    }
  }

  private async initDocumentSchema(
    project: Document,
    schema: string,
  ): Promise<void> {
    const pool = await this.getPool(project.getId(), {
      database: project.getAttribute('database'),
    });
    const db = this.getProjectDb(pool, project.getId());
    db.setDatabase(schema);
    await db.create(schema);

    for (const [key, collection] of Object.entries(collections.docSchema)) {
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

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}...`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${err.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}...`);
  }
}

export interface SchemaQueueOptions {
  project: object | Document;
  schema: string;
}

export type SchemaJobs = 'init_doc' | 'process';
