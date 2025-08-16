import { Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import {
  CORE_SCHEMA,
  MetricFor,
  QueueFor,
} from '@nuvix/utils';
import { Job } from 'bullmq';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Doc } from '@nuvix-tech/db';
import { CoreService } from '@nuvix/core/core.service.js';
import type { ProjectsDoc } from '@nuvix/utils/types';

@Processor(QueueFor.STATS, {
  concurrency: 10000,
})
export class StatsQueue extends Queue implements OnModuleInit, OnModuleDestroy {
  private static readonly BATCH_SIZE = 1000;
  private static readonly BATCH_INTERVAL_MS = 1000;
  private readonly logger = new Logger(StatsQueue.name);
  private buffer = new Map<number, StatsBuffer>();
  private interval!: NodeJS.Timeout;

  constructor(
    private readonly coreService: CoreService,
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

      const { project, keys } = data;
      const { client, dbForProject } = await this.coreService.createProjectDatabase(project, { schema: CORE_SCHEMA });

      try {
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
        await this.coreService.releaseDatabaseClient(client);
      }
    }
  }

  async process(job: Job<StatsQueueOptions, any, MetricFor>): Promise<any> {
    const { value } = job.data;
    const matric = job.name;
    const project = new Doc(job.data.project);
    const projectId = project.getSequence();

    if (!this.buffer.has(projectId)) {
      this.buffer.set(projectId, {
        project: new Doc({
          $id: project.getId(),
          $internalId: projectId,
          database: project.get('database'),
        }) as unknown as ProjectsDoc,
        keys: {},
        receivedAt: new Date(),
      });
    }

    const meta = this.buffer.get(projectId)!;
    if (Object.hasOwn(meta.keys, matric)) {
      meta.keys[matric] = meta.keys[matric]! + value;
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
};

export interface StatsQueueOptions {
  project: object;
  value: number;
}

interface StatsBuffer {
  project: ProjectsDoc;
  receivedAt: Date;
  keys: Record<string, number>;
}
