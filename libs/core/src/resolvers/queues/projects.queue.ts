// This queue is not usefull for self-hosted version
// because we don't manage database creation for now
// but we keep it for future use cases
// and also for nuvix cloud
import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';

import { Logger } from '@nestjs/common';
import { Database, Doc, DuplicateException, type Collection } from '@nuvix/db';
import {
  DatabaseRole,
  DEFAULT_DATABASE,
  QueueFor,
  Schemas,
  type DatabaseConfig,
} from '@nuvix/utils';
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
    const project = new Doc(job.data.project) as unknown as ProjectsDoc;
    switch (job.name) {
      case ProjectJob.INIT:
        await this.initProject(project);
        return { success: true };
      case ProjectJob.DEV_INIT:
        if (!job.data.dbConfig)
          throw Error('Db config is required in dev env.');
        await this.devInit(project, job.data.dbConfig);
        return { success: true };
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

    // Must update,
    // we have to init new database instance & all here for project then do the setup
    const dbName = 'postgres';
    const client = await this.coreService.createProjectDbClient('root');
    const databases = this.appConfig.getDatabaseConfig();

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
        project.set('database', databaseConfig).set('status', 'active'),
      );
      await this.db.getCache().flush();
      try {
        // Until infrastructure setup, we use the root client to initialize the project (test only)
        this.logger.log(
          `Data source initialized for project ${project.getId()}`,
        );
      } catch (error: any) {
        this.logger.error(`Failed to initialize data source: ${error.message}`);
        throw new Exception('Failed to initialize data source');
      }

      // Setup database and collections
      // until infrastructure setup is done, we use the root client to initialize the project (test only)
      const coreSchema = this.coreService.getProjectDb(client, {
        projectId: project.getId(),
        schema: Schemas.Core,
      });
      await coreSchema.create(Schemas.Core);

      const authSchema = this.coreService.getProjectDb(client, {
        projectId: project.getId(),
        schema: Schemas.Auth,
      });
      await authSchema.create(Schemas.Auth);
      // TODO: flush cache to ensure schema is recognized (after lib update)

      const authCollections = Object.entries(collections.auth) ?? [];
      const $collections = Object.entries(collections.project) ?? [];
      let { failed } = await this.createCollections(
        authSchema,
        authCollections,
        project,
      );

      if (failed > 0) {
        this.logger.error(
          `Failed to create some auth collections for project ${project.getId()}: ${failed} failed`,
        );
        throw new Exception(
          `Failed to create some auth collections for project ${project.getId()}: ${failed} failed`,
        );
      }

      ({ failed } = await this.createCollections(
        coreSchema,
        $collections,
        project,
      ));

      if (failed > 0) {
        this.logger.error(
          `Failed to create some core collections for project ${project.getId()}: ${failed} failed`,
        );
        throw new Exception(
          `Failed to create some core collections for project ${project.getId()}: ${failed} failed`,
        );
      }

      await new Audit(coreSchema).setup();
      this.logger.log(
        `Project ${project.getId()} initialized with database ${dbName} at ${databaseConfig.host}:${databaseConfig.port}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to initialize project ${project.getId()}: ${error.message}`,
      );
      throw new Exception(
        `Failed to initialize project ${project.getId()}: ${error.message}`,
      );
    } finally {
      await this.coreService.releaseDatabaseClient(client);
      // TODO: we have to release db client in new infrastructure
    }
  }

  async devInit(
    project: ProjectsDoc,
    dbConfig: Record<string, any>,
  ): Promise<void> {
    if (project.get('status') === 'active') {
      this.logger.warn(
        `Project ${project.getId()} is already initialized, skipping...`,
      );
      return;
    }

    const dbName = DEFAULT_DATABASE;
    const databaseConfig = {
      password: (project.get('database') as unknown as DatabaseConfig).pool
        .password,
      database: dbName,
      host: dbConfig['host'],
      port: dbConfig['port'],
      user: DatabaseRole.ADMIN,
    };

    const client = await this.coreService.createProjectDbClient(
      project.getId(),
      {
        ...databaseConfig,
      },
    );

    try {
      await this.db.getCache().flush();

      // Setup database and collections
      const coreSchema = this.coreService.getProjectDb(client, {
        projectId: project.getId(),
        schema: Schemas.Core,
      });
      try {
        await coreSchema.create(Schemas.Core);
      } catch (e) {
        if (!(e instanceof DuplicateException)) throw e;
      }

      const authSchema = this.coreService.getProjectDb(client, {
        projectId: project.getId(),
        schema: Schemas.Auth,
      });
      try {
        await authSchema.create(Schemas.Auth);
      } catch (e) {
        if (!(e instanceof DuplicateException)) throw e;
      }
      // TODO: flush cache to ensure schema is recognized (after lib update)

      const authCollections = Object.entries(collections.auth) ?? [];
      const $collections = Object.entries(collections.project) ?? [];
      let { failed } = await this.createCollections(
        authSchema,
        authCollections,
        project,
      );

      if (failed > 0) {
        this.logger.error(
          `Failed to create some auth collections for project ${project.getId()}: ${failed} failed`,
        );
        throw new Exception(
          `Failed to create some auth collections for project ${project.getId()}: ${failed} failed`,
        );
      }

      ({ failed } = await this.createCollections(
        coreSchema,
        $collections,
        project,
      ));

      if (failed > 0) {
        this.logger.error(
          `Failed to create some core collections for project ${project.getId()}: ${failed} failed`,
        );
        throw new Exception(
          `Failed to create some core collections for project ${project.getId()}: ${failed} failed`,
        );
      }

      try {
        await new Audit(coreSchema).setup();
      } catch (e) {
        if (!(e instanceof DuplicateException)) throw e;
      }
      this.logger.log(
        `Project ${project.getId()} initialized with database ${dbName} at ${databaseConfig.host}:${databaseConfig.port}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to initialize project ${project.getId()}: ${error.message}`,
      );
      throw new Exception(
        `Failed to initialize project ${project.getId()}: ${error.message}`,
      );
    } finally {
      await this.coreService.releaseDatabaseClient(client);
    }
  }

  private async createCollections(
    db: Database,
    collections: [string, Collection][],
    project: ProjectsDoc,
  ): Promise<{ successful: number; failed: number }> {
    let successfulCollections = 0;
    let failedCollections = 0;

    this.logger.log(
      `Found ${collections.length} collections to process for project ${project.getId()}`,
    );

    const maxRetries = 3;
    const baseDelayMs = 200;

    for (const [_, collection] of collections) {
      if (collection['$collection'] !== Database.METADATA) {
        continue;
      }

      const colId = collection.$id;

      const attributes =
        (collection['attributes'] || []).map(attribute => new Doc(attribute)) ||
        [];
      const indexes =
        (collection['indexes'] || []).map(index => new Doc(index)) || [];

      this.logger.log(
        `Creating collection ${colId} in schema ${db.schema} for project ${project.getId()}`,
      );

      let lastError: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await db.createCollection({
            id: colId,
            attributes,
            indexes,
          });

          successfulCollections++;
          lastError = null;
          break; // created successfully
        } catch (err: any) {
          lastError = err;

          // Treat duplicate as success (idempotent)
          if (err instanceof DuplicateException) {
            this.logger.warn(
              `Collection ${colId} already exists in schema ${db.schema} for project ${project.getId()}`,
            );
            successfulCollections++;
            lastError = null;
            break;
          }

          // If we can retry, wait with exponential backoff
          if (attempt < maxRetries) {
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            this.logger.warn(
              `Attempt ${attempt} failed creating collection ${colId} for project ${project.getId()}. Retrying in ${delay}ms. Error: ${err?.message ?? err}`,
            );
            await new Promise(res => setTimeout(res, delay));
            continue;
          }

          // final failure after retries
          this.logger.error(
            `Failed to create collection ${colId} in schema ${db.schema} for project ${project.getId()}: ${err?.message ?? err}`,
          );
        }
      }

      if (lastError) {
        failedCollections++;
        // preserve original behavior of bubbling up fatal errors
        throw lastError;
      }
    }

    return { successful: successfulCollections, failed: failedCollections };
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
  dbConfig?: Record<string, any>;
}

export enum ProjectJob {
  INIT = 'init',
  DEV_INIT = 'dev',
}
