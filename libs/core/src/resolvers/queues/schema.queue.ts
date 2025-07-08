import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';

import { Inject, Logger } from '@nestjs/common';
import { Database, Document, DuplicateException } from '@nuvix/database';
import type { GetClientFn, GetProjectDbFn } from '@nuvix/core/core.module';
import {
  GET_PROJECT_DB_CLIENT,
  GET_PROJECT_DB,
  APP_POSTGRES_PASSWORD,
} from '@nuvix/utils/constants';
import collections from '@nuvix/core/collections';

@Processor('schema')
export class SchemaQueue extends Queue {
  private readonly logger = new Logger(SchemaQueue.name);

  constructor(
    @Inject(GET_PROJECT_DB_CLIENT) private readonly getDbClient: GetClientFn,
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
        await this.initDocumentSchema(project, job.data.schema);
        return {
          success: true,
        };
      case 'process': // added case for 'process'
        break; // added break statement
      default: // noop
    }
  }

  private async initDocumentSchema(
    project: Document,
    schema: string,
  ): Promise<void> {
    const { client, dbForProject } = await this.getDatabase(project, schema);

    try {
      await dbForProject.create(schema);

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
          await dbForProject.createCollection(
            collection.$id,
            attributes,
            indexes,
          );
        } catch (error) {
          if (!(error instanceof DuplicateException)) {
            throw error;
          }
        }
      }
    } finally {
      await this.releaseClient(client);
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

  private async getDatabase(project: Document, database: string) {
    const dbOptions = project.getAttribute('database');
    const client = await this.getDbClient(project.getId(), {
      database: dbOptions.name,
      user: dbOptions.adminRole,
      password: APP_POSTGRES_PASSWORD,
      port: dbOptions.port,
      host: dbOptions.host,
      max: 2,
    });
    const dbForProject = this.getProjectDb(client, project.getId());
    dbForProject.setDatabase(database);
    return { client, dbForProject };
  }

  private async releaseClient(
    client: Awaited<ReturnType<typeof this.getDatabase>>['client'],
  ) {
    try {
      if (client) await client.end();
    } catch (error) {
      this.logger.error('Failed to release database client', error);
    }
  }
}

export interface SchemaQueueOptions {
  project: object | Document;
  schema: string;
}

export type SchemaJobs = 'init_doc' | 'process';
