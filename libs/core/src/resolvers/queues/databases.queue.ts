import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Database, Doc, DuplicateException } from '@nuvix-tech/db';
import { QueueFor } from '@nuvix/utils';
import { CoreService } from '@nuvix/core/core.service.js';
import type { Projects, ProjectsDoc } from '@nuvix/utils/types';
import collections from '@nuvix/utils/collections/index.js';

@Processor(QueueFor.DATABASES, { concurrency: 10000 })
export class DatabasesQueue extends Queue {
  private readonly logger = new Logger(DatabasesQueue.name);

  constructor(private readonly coreService: CoreService) {
    super();
  }

  async process(
    { data, name, ...job }: Job<SchemaQueueOptions, any, SchemaJob>,
    token?: string,
  ): Promise<void> {
    switch (name) {
      case SchemaJob.INIT_DOC:
        const project = new Doc(
          data.project as unknown as Projects,
        ) as ProjectsDoc;
        await this.initDocumentSchema(project, data.schema);
        return;
      default:
        throw Error(`Unknown job type: ${name}`);
    }
  }

  private async initDocumentSchema(
    project: ProjectsDoc,
    schema: string,
  ): Promise<void> {
    const { client, dbForProject } =
      await this.coreService.createProjectDatabase(project, { schema });

    try {
      await dbForProject.create(schema);

      for (const [key, collection] of Object.entries(collections.database)) {
        if (collection['$collection'] !== Database.METADATA) {
          continue;
        }

        const attributes = collection['attributes'].map(
          attribute => new Doc(attribute),
        );

        const indexes = (collection['indexes'] ?? []).map(
          index => new Doc(index),
        );

        try {
          await dbForProject.createCollection({
            id: collection.$id,
            attributes,
            indexes,
          });
        } catch (error) {
          if (!(error instanceof DuplicateException)) {
            throw error;
          }
        }
      }
    } finally {
      await this.coreService.releaseDatabaseClient(client);
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
  project: ProjectsDoc;
  schema: string;
}

export enum SchemaJob {
  INIT_DOC = 'init_doc',
  PROCESS = 'process',
}
