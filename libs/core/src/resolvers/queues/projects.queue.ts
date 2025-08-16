import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';

import { Logger } from '@nestjs/common';
import { Database, Doc, DuplicateException } from '@nuvix-tech/db';
import {
  INTERNAL_SCHEMAS,
  SYSTEM_SCHEMA,
  CORE_SCHEMA,
  QueueFor,
} from '@nuvix/utils';
import { DataSource } from '@nuvix/pg';
import { Exception } from '@nuvix/core/extend/exception';
import { Audit } from '@nuvix/audit';
import { CoreService } from '@nuvix/core/core.service.js';
import type { ProjectsDoc } from '@nuvix/utils/types';
import { AppConfigService } from '@nuvix/core/config.service.js';
import collections from '@nuvix/utils/collections/index.js';

@Processor(QueueFor.PROJECTS, { concurrency: 1000 })
export class ProjectsQueue extends Queue {
  private readonly logger = new Logger(ProjectsQueue.name);
  private readonly db: Database;

  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
  ) {
    super();
    this.db = this.coreService.getPlatformDb();
  }

  async process(
    job: Job<ProjectQueueOptions, any, ProjectJob>,
    token?: string,
  ): Promise<any> {
    switch (job.name) {
      case ProjectJob.INIT:
        const project = new Doc(job.data.project) as unknown as ProjectsDoc;
        await this.initProject(project);
        return;
      default:
        this.logger.warn(
          `Unknown job type ${job.name} for project ${job.data.project}`,
        );
        throw new Exception(`Unknown job type: ${job.name}`);
    }
  }

  // Temp Setup (until infrastructure setup)
  private async initProject(project: ProjectsDoc): Promise<void> {
    if (project.get('status') === 'active') {
      this.logger.warn(
        `Project ${project.getId()} is already initialized, skipping...`,
      );
      return;
    }

    const dbName = 'postgres';
    const client = await this.coreService.createProjectDbClient('root');
    const databases = this.appConfig.getDatabaseConfig();
    let db: Database | undefined;

    const databaseConfig = {
      ...(project.get('database', {}) as Record<string, any>),
      password: databases.postgres.password,
      name: dbName,
      host: databases.postgres.host,
      port: databases.postgres.port,
      adminRole: 'nuvix_admin',
      userRole: 'postgres',
    };

    try {
      // Update project document with database configuration (temporarily before collections)
      project = await this.db.updateDocument(
        'projects',
        project.getId(),
        project
          .set('database', databaseConfig)
          .set('status', 'active'),
      );
      await this.db.getCache().flush();

      const dataSource = new DataSource(client as any);
      try {
        // Until infrastructure setup, we use the root client to initialize the project (test only)
        await dataSource.init();
        this.logger.log(
          `Data source initialized for project ${project.getId()}`,
        );
      } catch (error: any) {
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
        this.logger.log(
          `Schema ${CORE_SCHEMA} created successfully for project ${project.getId()}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to create schema ${CORE_SCHEMA}: ${error.message}`,
        );
        throw new Exception('Failed to create schemas and set permissions');
      }

      // Setup database and collections
      db = this.coreService.getProjectDb(client, project.getId()); // until infrastructure setup
      db.setMeta({ schema: CORE_SCHEMA });
      await db.create(CORE_SCHEMA);
      // TODO: flush cache to ensure schema is recognized (after lib update)

      const $collections = Object.entries(collections.project) ?? [];
      let successfulCollections = 0;
      let failedCollections = 0;

      this.logger.log(
        `Found ${$collections.length} collections to process for project ${project.getId()}`,
      );

      for (const [_, collection] of $collections) {
        if (collection['$collection'] !== Database.METADATA) {
          continue;
        }

        try {
          const attributes =
            collection['attributes'].map(
              (attribute) => new Doc(attribute),
            ) || [];

          const indexes =
            collection['indexes']?.map((index) => new Doc(index)) ||
            [];

          this.logger.log(
            `Creating collection ${collection.$id} in schema ${CORE_SCHEMA} for project ${project.getId()}`,
          );

          await db.createCollection({ id: collection.$id, attributes, indexes });
          successfulCollections++;
        } catch (error: any) {
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
      await new Audit(db).setup();

      this.logger.log(
        `Collection creation completed: ${successfulCollections} successful, ${failedCollections} failed for project ${project.getId()}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to initialize project ${project.getId()}: ${error.message}`,
      );
      throw new Exception(
        `Failed to initialize project ${project.getId()}: ${error.message}`,
      );
    } finally {
      this.coreService.releaseDatabaseClient(client);
      // TODO: we have to release db client in new infrastructure
      this.logger.log(
        `Project ${project.getId()} initialization completed with database ${dbName} at ${databaseConfig.host}:${databaseConfig.port}`,
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
}

export interface ProjectQueueOptions {
  project: ProjectsDoc;
}

export enum ProjectJob {
  INIT = 'init',
};
