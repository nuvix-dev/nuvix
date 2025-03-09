import { Database, Document } from '@nuvix/database';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import {
  CACHE_DB,
  DB_FOR_PROJECT,
  METRIC_BUCKET_ID_FILES,
  METRIC_BUCKET_ID_FILES_STORAGE,
  METRIC_BUCKETS,
  METRIC_COLLECTIONS,
  METRIC_DATABASE_ID_COLLECTION_ID_DOCUMENTS,
  METRIC_DATABASE_ID_COLLECTIONS,
  METRIC_DATABASE_ID_DOCUMENTS,
  METRIC_DATABASES,
  METRIC_DEPLOYMENTS,
  METRIC_DEPLOYMENTS_STORAGE,
  METRIC_DOCUMENTS,
  METRIC_FILES,
  METRIC_FILES_STORAGE,
  METRIC_FUNCTION_ID_DEPLOYMENTS,
  METRIC_FUNCTION_ID_DEPLOYMENTS_STORAGE,
  METRIC_FUNCTIONS,
  METRIC_SESSIONS,
  METRIC_TEAMS,
  METRIC_USERS,
} from 'src/Utils/constants';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ProjectUsageService {
  private readonly logger = new Logger(ProjectUsageService.name);

  constructor(
    @Inject(CACHE_DB) private readonly cacheDb: Redis,
    @Inject(DB_FOR_PROJECT) private readonly projectDb: Database
  ) { }

  async addMetric(metric: string, value: number): Promise<this> {
    await this.add(metric, value);
    return this;
  }

  reduce(document: Document): this {
    this.logger.log(`Reducing metric ${document.getId()}`);
    this._reduce(document);
    return this;
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async saveMetrics(): Promise<void> {
    this.logger.log('Saving metrics to database');

    const allMetrics = await this.cacheDb.hgetall('project_usage');

    if (Object.keys(allMetrics).length > 0) {
      try {
        // const usageDoc = await this.projectDb.createDocument('stats', new Document({
          
        // }));

        // this.logger.log(`Metrics saved with ID: ${usageDoc.getId()}`);

        // Reset metrics in Redis (optional)
        // await this.cacheDb.del('project_usage');
      } catch (error) {
        this.logger.error(`Failed to save metrics: ${error.message}`);
      }
    } else {
      this.logger.log('No metrics to save');
    }

    await this.cacheDb.hset('project_usage', 'lastUpdate', Date.now());
  }

  private async add(metric: string, value: number) {
    this.logger.log(`Adding metric ${metric} with value ${value}`);
    return await this.cacheDb.hincrby('project_usage', metric, value);
  }

  private async _reduce(document: Document) { }

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
    if (event === Database.EVENT_DOCUMENT_DELETE) {
      value = -1;
    }

    const collection = document.getCollection().toLowerCase();
    switch (true) {
      case collection === 'teams':
        await this.addMetric(METRIC_TEAMS, value); // per project
        break;
      case collection === 'users':
        await this.addMetric(METRIC_USERS, value); // per project
        if (event === Database.EVENT_DOCUMENT_DELETE) {
          await this.reduce(document);
        }
        break;
      case collection === 'sessions': // sessions
        await this.addMetric(METRIC_SESSIONS, value); // per project
        break;
      case collection === 'databases': // databases
        await this.addMetric(METRIC_DATABASES, value); // per project
        if (event === Database.EVENT_DOCUMENT_DELETE) {
          await this.reduce(document);
        }
        break;
      case collection.startsWith('database_') &&
        !collection.includes('collection'): // collections
        const parts = document.getCollection().split('_');
        const databaseInternalId = parts[1] ?? 0;
        await this.addMetric(METRIC_COLLECTIONS, value); // per project
        await this.addMetric(
          METRIC_DATABASE_ID_COLLECTIONS.replace(
            '{databaseInternalId}',
            databaseInternalId.toString(),
          ),
          value,
        ); // per database
        if (event === Database.EVENT_DOCUMENT_DELETE) {
          await this.reduce(document);
        }
        break;
      case collection.startsWith('database_') &&
        collection.includes('_collection_'): // documents
        const docParts = document.getCollection().split('_');
        const dbInternalId = docParts[1] ?? 0;
        const collectionInternalId = docParts[3] ?? 0;
        await this.addMetric(METRIC_DOCUMENTS, value); // per project
        await this.addMetric(
          METRIC_DATABASE_ID_DOCUMENTS.replace(
            '{databaseInternalId}',
            dbInternalId.toString(),
          ),
          value,
        ); // per database
        await this.addMetric(
          METRIC_DATABASE_ID_COLLECTION_ID_DOCUMENTS.replace(
            '{databaseInternalId}',
            dbInternalId.toString(),
          ).replace('{collectionInternalId}', collectionInternalId.toString()),
          value,
        ); // per collection
        break;
      case collection === 'buckets': // buckets
        await this.addMetric(METRIC_BUCKETS, value); // per project
        if (event === Database.EVENT_DOCUMENT_DELETE) {
          await this.reduce(document);
        }
        break;
      case collection.startsWith('bucket_'): // files
        const bucketParts = document.getCollection().split('_');
        const bucketInternalId = bucketParts[1];
        await this.addMetric(METRIC_FILES, value); // per project
        await this.addMetric(
          METRIC_FILES_STORAGE,
          document.getAttribute('sizeOriginal') * value,
        ); // per project
        await this.addMetric(
          METRIC_BUCKET_ID_FILES.replace(
            '{bucketInternalId}',
            bucketInternalId,
          ),
          value,
        ); // per bucket
        await this.addMetric(
          METRIC_BUCKET_ID_FILES_STORAGE.replace(
            '{bucketInternalId}',
            bucketInternalId,
          ),
          document.getAttribute('sizeOriginal') * value,
        ); // per bucket
        break;
      case collection === 'functions':
        await this.addMetric(METRIC_FUNCTIONS, value); // per project
        if (event === Database.EVENT_DOCUMENT_DELETE) {
          await this.reduce(document);
        }
        break;
      case collection === 'deployments':
        await this.addMetric(METRIC_DEPLOYMENTS, value); // per project
        await this.addMetric(
          METRIC_DEPLOYMENTS_STORAGE,
          document.getAttribute('size') * value,
        ); // per project
        await this.addMetric(
          METRIC_FUNCTION_ID_DEPLOYMENTS.replace(
            '{resourceType}',
            document.getAttribute('resourceType'),
          ).replace(
            '{resourceInternalId}',
            document.getAttribute('resourceInternalId'),
          ),
          value,
        ); // per function
        await this.addMetric(
          METRIC_FUNCTION_ID_DEPLOYMENTS_STORAGE.replace(
            '{resourceType}',
            document.getAttribute('resourceType'),
          ).replace(
            '{resourceInternalId}',
            document.getAttribute('resourceInternalId'),
          ),
          document.getAttribute('size') * value,
        );
        break;
      default:
        break;
    }
  }
}

interface DbListionerProps {
  event: string;
  document: Document;
  project: Document;
  dbForProject: Database;
}
