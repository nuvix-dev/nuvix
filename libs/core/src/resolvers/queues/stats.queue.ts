import { Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import {
  APP_POSTGRES_PASSWORD,
  CORE_SCHEMA,
  GET_PROJECT_DB,
  GET_PROJECT_DB_CLIENT,
  MetricFor,
  QueueFor,
} from '@nuvix/utils/constants';
import { Job } from 'bullmq';
import { Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { GetClientFn, GetProjectDbFn } from '@nuvix/core/core.module';

@Processor(QueueFor.STATS, {
  concurrency: 10000,
})
export class StatsQueue extends Queue implements OnModuleInit, OnModuleDestroy {
  private static readonly BATCH_SIZE = 1000;
  private static readonly BATCH_INTERVAL_MS = 1000;
  private readonly logger = new Logger(StatsQueue.name);
  private buffer = new Map<string, StatsBuffer>();
  private interval: NodeJS.Timeout;

  constructor(
    @Inject(GET_PROJECT_DB_CLIENT) private readonly getDbClient: GetClientFn,
    @Inject(GET_PROJECT_DB)
    private readonly getProjectDb: GetProjectDbFn,
  ) {
    super();
  }

  onModuleInit() {
    this.startTimer();
  }

  async onModuleDestroy() {
    this.logger.log('Module destroying. Flushing remaining stats...');
    clearInterval(this.interval);
    await this.flushBuffer();
  }

  private startTimer(): void {
    this.interval = setInterval(
      () => this.flushBuffer(),
      StatsQueue.BATCH_INTERVAL_MS,
    );
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.size === 0) {
      return;
    }

    const bufferCopy = new Map(this.buffer);
    this.buffer.clear();

    for (const [projectId, data] of bufferCopy.entries()) {
      if (Object.keys(data.keys).length === 0) {
        continue;
      }

      let client:
        | Awaited<ReturnType<typeof this.getDatabase>>['client']
        | undefined;
      try {
        const { project, keys } = data;
        const { client: _c, dbForProject } = await this.getDatabase(project);
        client = _c;

        const entries = Object.entries(keys);
        this.logger.log(
          `Flushing ${entries.length} stats logs for project ${projectId}`,
        );

        for (const [key, value] of entries as [MetricFor, number][]) {
          this.logger.debug(`${key} processing with value ${value}`);
          // TODO: handle
        }
      } catch (error) {
        this.logger.error(
          `Error flushing stats logs for project ${projectId}:`,
          error,
        );
        // Re-add failed logs to buffer for retry
        // const currentBuffer = this.buffer.get(projectId) || {
        //   project: data.project,
        //   keys: {},
        // };
        // currentBuffer.keys.push(...data.logs);
        // this.buffer.set(projectId, currentBuffer);
      } finally {
        if (client) {
          await this.releaseClient(client);
        }
      }
    }
  }

  async process(job: Job<StatsQueueOptions, any, MetricFor>): Promise<any> {
    const { value } = job.data;
    const matric = job.name;
    const project = new Document(job.data.project);
    const projectId = project.getInternalId();

    if (!this.buffer.has(projectId)) {
      this.buffer.set(projectId, {
        project: new Document({
          $id: projectId,
          $internalId: projectId,
          database: project.getAttribute('database'),
        }),
        keys: {},
        receivedAt: new Date(),
      });
    }

    const meta = this.buffer.get(projectId);
    if (Object.hasOwn(meta.keys, matric)) {
      meta.keys[matric] = meta.keys[matric] + value;
    } else {
      meta.keys[matric] = value;
    }

    if (
      Object.keys(this.buffer.get(projectId)!.keys).length >=
      StatsQueue.BATCH_SIZE
    ) {
      // Temporarily stop the timer to avoid a race condition where the timer
      // and a full buffer try to flush at the same exact time.
      clearInterval(this.interval);
      await this.flushBuffer();
      this.startTimer();
    }

    return;
  }

  private async getDatabase(project: Document) {
    const dbOptions = project.getAttribute('database');
    const client = await this.getDbClient(project.getId(), {
      database: dbOptions.name,
      user: dbOptions.adminRole,
      password: APP_POSTGRES_PASSWORD,
      port: dbOptions.port,
      host: dbOptions.host,
    });
    const dbForProject = this.getProjectDb(client, project.getId());
    dbForProject
      .setDatabase(CORE_SCHEMA)
      .setCacheName(`${project.getId()}:core`);
    return { client, dbForProject };
  }

  private async releaseClient(
    client: Awaited<ReturnType<typeof this.getDatabase>>['client'],
  ) {
    try {
      if (client) {
        await client.end();
      }
    } catch (error) {
      this.logger.error('Failed to release database client', error);
    }
  }
}

export interface StatsQueueOptions {
  project: object;
  value: number;
}

interface StatsBuffer {
  project: Document;
  receivedAt: Date;
  keys: Record<string, number>;
}
