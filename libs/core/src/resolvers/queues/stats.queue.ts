import { Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import {
  fnv1a128,
  MetricFor,
  MetricPeriod,
  QueueFor,
  Schemas,
} from '@nuvix/utils';
import { Job } from 'bullmq';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Doc, type Database } from '@nuvix-tech/db';
import { CoreService } from '@nuvix/core/core.service.js';
import type { ProjectsDoc, Stats } from '@nuvix/utils/types';
import { AppConfigService } from '@nuvix/core/config.service';

@Processor(QueueFor.STATS, {
  concurrency: 10000,
})
export class StatsQueue extends Queue implements OnModuleInit, OnModuleDestroy {
  private static readonly BATCH_SIZE = 1000;
  private static readonly BATCH_INTERVAL_MS = 5000;
  private readonly logger = new Logger(StatsQueue.name);
  private buffer = new Map<number, StatsBuffer>();
  private interval!: NodeJS.Timeout;

  private static periods = [
    MetricPeriod.INF,
    MetricPeriod.HOUR,
    MetricPeriod.DAY,
  ] as const;

  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
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

      const { project, keys, receivedAt } = data;
      const { client, dbForProject } =
        await this.coreService.createProjectDatabase(project, {
          schema: Schemas.Core,
        });

      try {
        const entries = Object.entries(keys);
        const stats: Doc<Stats>[] = [];

        // Process each metric key-value pair
        for (const [key, value] of entries as [MetricFor, number][]) {
          if (value === 0) continue;
          this.logger.debug(`${key} processing with value ${value}`);

          for (const period of StatsQueue.periods) {
            const time = StatsQueue.formatDate(period, receivedAt);
            const id = fnv1a128(`${time}|${period}|${key}`);

            const doc = new Doc<Stats>({
              $id: id,
              time,
              period,
              metric: key,
              value,
              region: this.appConfig.get('app').region,
            });

            stats.push(doc);
          }
        }

        // Bulk insert/update stats
        if (stats.length > 0) {
          try {
            this.logger.log(
              `Flushing ${stats.length} stats logs for project ${projectId}`,
            );
            await dbForProject.createOrUpdateDocumentsWithIncrease(
              'stats',
              'value',
              stats,
            );
          } catch (error) {
            this.logger.error(
              `Error creating/updating stats logs for project ${projectId}:`,
              error,
            );
          }
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

  async process(job: Job<StatsQueueOptions, any, StatsQueueJob>): Promise<any> {
    const { metrics: _metrics, reduce } = job.data;
    const project = new Doc(job.data.project) as ProjectsDoc;
    const projectId = project.getSequence();

    switch (job.name) {
      case StatsQueueJob.ADD_METRIC:
        if (!this.buffer.has(projectId)) {
          this.buffer.set(projectId, {
            project: new Doc({
              $id: project.getId(),
              $sequence: projectId,
              database: project.get('database'),
            }) as unknown as ProjectsDoc,
            keys: {},
            receivedAt: new Date(),
          });
        }

        const metrics = [..._metrics];
        if (reduce && reduce.length > 0) {
          let _client;
          try {
            const { client, dbForProject } =
              await this.coreService.createProjectDatabase(project, {
                schema: Schemas.Core,
              });
            _client = client;

            for (const doc of reduce) {
              await this.reduce(project, doc, metrics, dbForProject);
            }
          } finally {
            if (_client) {
              await this.coreService
                .releaseDatabaseClient(_client)
                .catch(() => {
                  /* ignore */
                });
            }
          }
        }

        for (const metric of metrics) {
          const meta = this.buffer.get(projectId)!;
          if (Object.hasOwn(meta.keys, metric.key)) {
            meta.keys[metric.key] = meta.keys[metric.key]! + metric.value;
          } else {
            meta.keys[metric.key] = metric.value;
          }
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
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        break;
    }

    return;
  }

  public static formatDate(
    period: MetricPeriod,
    date: Date | string,
  ): string | null {
    date = typeof date === 'string' ? new Date(date) : date;
    switch (period) {
      case MetricPeriod.INF:
        return null;
      case MetricPeriod.HOUR:
        return date.toISOString().slice(0, 13) + ':00:00Z';
      case MetricPeriod.DAY:
        return date.toISOString().slice(0, 10) + 'T00:00:00Z';
      default:
        throw new Error(`Unsupported period: ${period}`);
    }
  }

  private async reduce(
    project: ProjectsDoc,
    document: Doc,
    metrics: Array<{ key: MetricFor; value: number }>,
    dbForProject: Database,
  ): Promise<void> {
    if (document.empty()) return;

    try {
      const collection = document.getCollection();

      switch (true) {
        case collection === 'users': {
          const sessions = document.get('sessions', [])?.length || 0;
          if (sessions > 0) {
            metrics.push({
              key: MetricFor.SESSIONS,
              value: sessions * -1,
            });
          }
          break;
        }
          
        case collection === 'buckets': {
          const filesDoc = await dbForProject.getDocument(
            'stats',
            fnv1a128(
              `${MetricPeriod.INF}|${MetricFor.BUCKET_ID_FILES.replace('{bucketInternalId}', document.getSequence().toString())}`,
            ),
          );
          const storageDoc = await dbForProject.getDocument(
            'stats',
            fnv1a128(
              `${MetricPeriod.INF}|${MetricFor.BUCKET_ID_FILES_STORAGE.replace('{bucketInternalId}', document.getSequence().toString())}`,
            ),
          );

          if (filesDoc?.get('value')) {
            metrics.push({
              key: MetricFor.FILES,
              value: filesDoc.get('value') * -1,
            });
          }

          if (storageDoc?.get('value')) {
            metrics.push({
              key: MetricFor.FILES_STORAGE,
              value: storageDoc.get('value') * -1,
            });
          }
          break;
        }

        case collection === 'functions': {
          const resourceType = collection;
          const resourceInternalId = document.getSequence().toString();

          const deployments = await dbForProject.getDocument(
            'stats',
            fnv1a128(
              `${MetricPeriod.INF}|${MetricFor.FUNCTION_ID_DEPLOYMENTS.replace('{resourceType}', resourceType).replace('{resourceInternalId}', resourceInternalId)}`,
            ),
          );
          const deploymentsStorage = await dbForProject.getDocument(
            'stats',
            fnv1a128(
              `${MetricPeriod.INF}|${MetricFor.FUNCTION_ID_DEPLOYMENTS_STORAGE.replace('{resourceType}', resourceType).replace('{resourceInternalId}', resourceInternalId)}`,
            ),
          );
          const builds = await dbForProject.getDocument(
            'stats',
            fnv1a128(
              `${MetricPeriod.INF}|${MetricFor.FUNCTION_ID_BUILDS.replace('{functionInternalId}', resourceInternalId)}`,
            ),
          );
          const buildsStorage = await dbForProject.getDocument(
            'stats',
            fnv1a128(
              `${MetricPeriod.INF}|${MetricFor.FUNCTION_ID_BUILDS_STORAGE.replace('{functionInternalId}', resourceInternalId)}`,
            ),
          );
          const buildsCompute = await dbForProject.getDocument(
            'stats',
            fnv1a128(
              `${MetricPeriod.INF}|${MetricFor.FUNCTION_ID_BUILDS_COMPUTE.replace('{functionInternalId}', resourceInternalId)}`,
            ),
          );
          const executions = await dbForProject.getDocument(
            'stats',
            fnv1a128(
              `${MetricPeriod.INF}|${MetricFor.FUNCTION_ID_EXECUTIONS.replace('{functionInternalId}', resourceInternalId)}`,
            ),
          );
          const executionsCompute = await dbForProject.getDocument(
            'stats',
            fnv1a128(
              `${MetricPeriod.INF}|${MetricFor.FUNCTION_ID_EXECUTIONS_COMPUTE.replace('{functionInternalId}', resourceInternalId)}`,
            ),
          );

          if (deployments?.get('value')) {
            metrics.push(
              {
                key: MetricFor.DEPLOYMENTS,
                value: deployments.get('value') * -1,
              },
              {
                key: MetricFor.FUNCTION_ID_DEPLOYMENTS.replace(
                  '{resourceType}',
                  resourceType,
                ) as MetricFor,
                value: deployments.get('value') * -1,
              },
            );
          }

          if (deploymentsStorage?.get('value')) {
            metrics.push(
              {
                key: MetricFor.DEPLOYMENTS_STORAGE,
                value: deploymentsStorage.get('value') * -1,
              },
              {
                key: MetricFor.FUNCTION_ID_DEPLOYMENTS_STORAGE.replace(
                  '{resourceType}',
                  resourceType,
                ) as MetricFor,
                value: deploymentsStorage.get('value') * -1,
              },
            );
          }

          if (builds?.get('value')) {
            metrics.push(
              { key: MetricFor.BUILDS, value: builds.get('value') * -1 },
              {
                key: MetricFor.FUNCTION_ID_BUILDS.replace(
                  '{functionInternalId}',
                  resourceType,
                ) as MetricFor,
                value: builds.get('value') * -1,
              },
            );
          }

          if (buildsStorage?.get('value')) {
            metrics.push(
              {
                key: MetricFor.BUILDS_STORAGE,
                value: buildsStorage.get('value') * -1,
              },
              {
                key: MetricFor.FUNCTION_ID_BUILDS_STORAGE.replace(
                  '{functionInternalId}',
                  resourceType,
                ) as MetricFor,
                value: buildsStorage.get('value') * -1,
              },
            );
          }

          if (buildsCompute?.get('value')) {
            metrics.push(
              {
                key: MetricFor.BUILDS_COMPUTE,
                value: buildsCompute.get('value') * -1,
              },
              {
                key: MetricFor.FUNCTION_ID_BUILDS_COMPUTE.replace(
                  '{functionInternalId}',
                  resourceType,
                ) as MetricFor,
                value: buildsCompute.get('value') * -1,
              },
            );
          }

          if (executions?.get('value')) {
            metrics.push(
              {
                key: MetricFor.EXECUTIONS,
                value: executions.get('value') * -1,
              },
              {
                key: MetricFor.FUNCTION_ID_EXECUTIONS.replace(
                  '{functionInternalId}',
                  resourceType,
                ) as MetricFor,
                value: executions.get('value') * -1,
              },
            );
          }

          if (executionsCompute?.get('value')) {
            metrics.push(
              {
                key: MetricFor.EXECUTIONS_COMPUTE,
                value: executionsCompute.get('value') * -1,
              },
              {
                key: MetricFor.FUNCTION_ID_EXECUTIONS_COMPUTE.replace(
                  '{functionInternalId}',
                  resourceType,
                ) as MetricFor,
                value: executionsCompute.get('value') * -1,
              },
            );
          }
          break;
        }

        default:
          break;
      }
    } catch (error) {
      this.logger.error(
        `[reducer] ${new Date().toISOString()} ${project.getSequence()} ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export interface StatsQueueOptions {
  project: object;
  metrics: Array<{ key: MetricFor; value: number }>;
  reduce?: Doc<any>[];
}

interface StatsBuffer {
  project: ProjectsDoc;
  receivedAt: Date;
  keys: Record<string, number>;
}

export enum StatsQueueJob {
  ADD_METRIC = 'add-metric',
}
