import { Processor } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from './queue';
import { QueueFor, Schemas } from '@nuvix/utils';
import { Doc } from '@nuvix-tech/db';
import { Job } from 'bullmq';
import { CoreService } from '@nuvix/core/core.service.js';
import type { ProjectsDoc } from '@nuvix/utils/types';

interface ApiLogsBuffer {
  project: ProjectsDoc;
  logs: ApiLog[];
}

@Injectable()
@Processor(QueueFor.LOGS, { concurrency: 5000 })
export class ApiLogsQueue
  extends Queue
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly BATCH_SIZE = 1000;
  private static readonly BATCH_INTERVAL_MS = 2000;
  private readonly logger = new Logger(ApiLogsQueue.name);
  private buffer = new Map<number, ApiLogsBuffer>();
  private interval!: NodeJS.Timeout;

  constructor(private readonly coreService: CoreService) {
    super();
  }

  onModuleInit() {
    this.startTimer();
  }

  async onModuleDestroy() {
    this.logger.log('Module destroying. Flushing remaining api logs...');
    clearInterval(this.interval);
    await this.flushBuffer();
  }

  private startTimer(): void {
    this.interval = setInterval(
      () => this.flushBuffer(),
      ApiLogsQueue.BATCH_INTERVAL_MS,
    );
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.size === 0) {
      return;
    }

    const bufferCopy = new Map(this.buffer);
    this.buffer.clear();

    for (const [projectId, data] of bufferCopy.entries()) {
      if (data.logs.length === 0) {
        continue;
      }
      const { project, logs } = data;

      const client = await this.coreService.createProjectPgClient(project);
      const dataSource = this.coreService.getProjectPg(client);

      try {
        await dataSource
          .table('api_logs')
          .withSchema(Schemas.System)
          .insert(logs);
      } catch (error: any) {
        this.logger.error(
          `Error flushing api logs for project ${projectId}: ${error?.message || error}`,
          error?.stack,
        );
        // Re-add failed logs to buffer for retry
        const currentBuffer = this.buffer.get(projectId) || {
          project: data.project,
          logs: [],
        };
        currentBuffer.logs.push(...data.logs);
        this.buffer.set(projectId, currentBuffer);
      } finally {
        await this.coreService.releaseDatabaseClient(client);
      }
    }
  }

  async process(job: Job<ApiLogsQueueJobData>): Promise<void> {
    this.logger.debug(`Processing job ${job.id} for project log`);
    const project = new Doc(job.data.project as object);
    const projectId = project.getSequence();
    const log = job.data.log;

    if (!this.buffer.has(projectId)) {
      this.buffer.set(projectId, {
        project: new Doc({
          $id: project.getId(),
          $sequence: projectId,
          database: project.get('database'),
        }) as unknown as ProjectsDoc,
        logs: [],
      });
    }

    this.buffer.get(projectId)!.logs.push(log);

    if (this.buffer.get(projectId)!.logs.length >= ApiLogsQueue.BATCH_SIZE) {
      // Temporarily stop the timer to avoid a race condition where the timer
      // and a full buffer try to flush at the same exact time.
      clearInterval(this.interval);
      await this.flushBuffer();
      this.startTimer(); // Restart the timer
    }
  }
}

export type ApiLogsQueueJobData = {
  project: ProjectsDoc | object;
  log: ApiLog;
};

export interface ApiLog {
  request_id: string;
  method: string;
  path: string;
  status: number;
  timestamp: Date;
  client_ip?: string;
  user_agent?: string;
  resource: string;
  url?: string;
  latency_ms?: number;
  region?: string;
  error?: string;
  metadata?: Record<string, any>;
}
