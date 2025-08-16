import { Database, Doc } from '@nuvix-tech/db';
import {

} from '@nuvix/utils';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CoreService } from './core.service.js';


// TODO: we have to fully refactor this service to use the new database client and Queue system

@Injectable()
export class ProjectUsageService {
  private readonly logger = new Logger(ProjectUsageService.name);

  constructor(
    private readonly coreService: CoreService,
  ) {}

  async addMetric(
    metric: string,
    value: number,
    project?: Doc,
  ): Promise<this> {
    this.logger.log(`Adding metric ${metric} with value ${value}`);
    const projectId = project?.getSequence() ?? 'global';
    const key = `project_usage:${projectId}`;

    // Keep track of all IDs to iterate over in cron later
    // await this.cacheDb.sadd('usage_project_ids', projectId);

    // await this.cacheDb.hincrby(key, metric, value);
    return this;
  }

  reduce(document: Doc): this {
    this.logger.log(`Reducing metric ${document.getId()}`);
    // this._reduce(document);
    return this;
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async saveMetrics(): Promise<void> {
    this.logger.log('Saving metrics to database');

    // const projectIds = await this.cacheDb.smembers('usage_project_ids');
    // if (!projectIds.length) {
    //   this.logger.log('No metrics to save');
    //   return;
    // }

    // for (const projectId of projectIds) {
    //   const usageData = await this.cacheDb.hgetall(
    //     `project_usage:${projectId}`,
    //   );
    //   if (Object.keys(usageData).length > 0) {
    //     try {
    //       // const projectDb = await this.getProjectDb(projectId);

    //       for (const [key, value] of Object.entries(usageData)) {
    //         if (!value) continue;

    //         const periods = [
    //           { period: 'inf', format: undefined },
    //           { period: '1h', format: 'YYYY-MM-DD-HH' },
    //           { period: '1d', format: 'YYYY-MM-DD' },
    //         ];
    //         for (const { period, format } of periods) {
    //           const time = period === 'inf' ? null : new Date().toISOString();
    //           const id = `${period}_${key}_${projectId}`;

    // try {
    //   await projectDb.createDocument(
    //     'stats',
    //     new Doc({
    //       $id: id,
    //       period,
    //       time,
    //       metric: key,
    //       value: Number(value),
    //       region: process.env._APP_REGION || 'default',
    //     }),
    //   );
    // } catch (error) {
    //   if (error instanceof DuplicateException) {
    //     const v = Number(value ?? 0);
    //     if (v < 0) {
    //       await projectDb.decreaseDocumentAttribute(
    //         'stats',
    //         id,
    //         'value',
    //         Math.abs(v),
    //       );
    //     } else {
    //       await projectDb.increaseDocumentAttribute(
    //         'stats',
    //         id,
    //         'value',
    //         v,
    //       );
    //     }
    //   } else {
    //     this.logger.error(
    //       `Failed to save metric ${key} for ${projectId}: ${error.message}`,
    //     );
    //   }
    // }
    //         }
    //       }

    //       this.logger.log(`Metrics saved for project: ${projectId}`);
    //     } catch (error) {
    //       this.logger.error(
    //         `Failed to save metrics for ${projectId}: ${error.message}`,
    //       );
    //     }
    //   }
    //   // await this.cacheDb.del(`project_usage:${projectId}`);
    // }

    // await this.cacheDb.hset('project_usage', 'lastUpdate', Date.now());
  }

  private async _reduce(document: Doc) {}

  async databaseListener({
    event,
    document,
    project,
    dbForProject,
  }: DbListionerProps) {
    this.logger.log(
      `Database listener called with event ${event} for document ${document.getId()}`,
    );
    let value = 1;
    // if (event === Database.EVENT_DOCUMENT_DELETE) {
    //   value = -1;
    // }

    const collection = document.getCollection().toLowerCase();
    // switch (true) {
    //   case collection === 'teams':
    //     await this.addMetric(METRIC_TEAMS, value, project); // per project
    //     break;
    //   case collection === 'users':
    //     await this.addMetric(METRIC_USERS, value, project); // per project
    //     if (event === Database.EVENT_DOCUMENT_DELETE) {
    //       await this.reduce(document);
    //     }
    //     break;
    //   case collection === 'sessions': // sessions
    //     await this.addMetric(METRIC_SESSIONS, value, project); // per project
    //     break;
    //   case collection === 'databases': // databases
    //     await this.addMetric(METRIC_DATABASES, value, project); // per project
    //     if (event === Database.EVENT_DOCUMENT_DELETE) {
    //       await this.reduce(document);
    //     }
    //     break;
    //   case collection.startsWith('database_') &&
    //     !collection.includes('collection'): // collections
    //     const parts = document.getCollection().split('_');
    //     const databaseInternalId = parts[1] ?? 0;
    //     await this.addMetric(METRIC_COLLECTIONS, value, project); // per project
    //     await this.addMetric(
    //       METRIC_DATABASE_ID_COLLECTIONS.replace(
    //         '{databaseInternalId}',
    //         databaseInternalId.toString(),
    //       ),
    //       value,
    //       project,
    //     ); // per database
    //     if (event === Database.EVENT_DOCUMENT_DELETE) {
    //       await this.reduce(document);
    //     }
    //     break;
    //   case collection.startsWith('database_') &&
    //     collection.includes('_collection_'): // documents
    //     const docParts = document.getCollection().split('_');
    //     const dbInternalId = docParts[1] ?? 0;
    //     const collectionInternalId = docParts[3] ?? 0;
    //     await this.addMetric(METRIC_DOCUMENTS, value, project); // per project
    //     await this.addMetric(
    //       METRIC_DATABASE_ID_DOCUMENTS.replace(
    //         '{databaseInternalId}',
    //         dbInternalId.toString(),
    //       ),
    //       value,
    //       project,
    //     ); // per database
    //     await this.addMetric(
    //       METRIC_DATABASE_ID_COLLECTION_ID_DOCUMENTS.replace(
    //         '{databaseInternalId}',
    //         dbInternalId.toString(),
    //       ).replace('{collectionInternalId}', collectionInternalId.toString()),
    //       value,
    //       project,
    //     ); // per collection
    //     break;
    //   case collection === 'buckets': // buckets
    //     await this.addMetric(METRIC_BUCKETS, value, project); // per project
    //     if (event === Database.EVENT_DOCUMENT_DELETE) {
    //       await this.reduce(document);
    //     }
    //     break;
    //   case collection.startsWith('bucket_'): // files
    //     const bucketParts = document.getCollection().split('_');
    //     const bucketInternalId = bucketParts[1];
    //     await this.addMetric(METRIC_FILES, value, project); // per project
    //     await this.addMetric(
    //       METRIC_FILES_STORAGE,
    //       document.get('sizeOriginal') * value,
    //       project,
    //     ); // per project
    //     await this.addMetric(
    //       METRIC_BUCKET_ID_FILES.replace(
    //         '{bucketInternalId}',
    //         bucketInternalId,
    //       ),
    //       value,
    //       project,
    //     ); // per bucket
    //     await this.addMetric(
    //       METRIC_BUCKET_ID_FILES_STORAGE.replace(
    //         '{bucketInternalId}',
    //         bucketInternalId,
    //       ),
    //       document.get('sizeOriginal') * value,
    //       project,
    //     ); // per bucket
    //     break;
    //   case collection === 'functions':
    //     await this.addMetric(METRIC_FUNCTIONS, value, project); // per project
    //     if (event === Database.EVENT_DOCUMENT_DELETE) {
    //       await this.reduce(document);
    //     }
    //     break;
    //   case collection === 'deployments':
    //     await this.addMetric(METRIC_DEPLOYMENTS, value, project); // per project
    //     await this.addMetric(
    //       METRIC_DEPLOYMENTS_STORAGE,
    //       document.get('size') * value,
    //       project,
    //     ); // per project
    //     await this.addMetric(
    //       METRIC_FUNCTION_ID_DEPLOYMENTS.replace(
    //         '{resourceType}',
    //         document.get('resourceType'),
    //       ).replace(
    //         '{resourceInternalId}',
    //         document.get('resourceInternalId'),
    //       ),
    //       value,
    //       project,
    //     ); // per function
    //     await this.addMetric(
    //       METRIC_FUNCTION_ID_DEPLOYMENTS_STORAGE.replace(
    //         '{resourceType}',
    //         document.get('resourceType'),
    //       ).replace(
    //         '{resourceInternalId}',
    //         document.get('resourceInternalId'),
    //       ),
    //       document.get('size') * value,
    //       project,
    //     );
    //     break;
    //   default:
    //     break;
    // }
  }
}

interface DbListionerProps {
  event: string;
  document: Doc;
  project: Doc;
  dbForProject: Database;
}
