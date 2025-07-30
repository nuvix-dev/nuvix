import { Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import {
  MetricFor,
  QueueFor,
} from '@nuvix/utils/constants';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Document } from '@nuvix/database';

@Processor(QueueFor.STATS, {
  concurrency: 10000,
})
export class StatsQueue extends Queue {
  private readonly logger = new Logger(StatsQueue.name);
  constructor() {
    super();
  }

  async process(job: Job<UsageQueueOptions, any, MetricFor>): Promise<any> {
    const { project: p, value, region } = job.data;
    const project = new Document(p);
    const metric = job.name;

    this.logger.debug(job.data);

    return;

    // this.metrics.incrementBandwidth

    // const redisKey = `stats:${projectId}:${metric}:${region}`;

    // // Aggregate values in Redis (incremental updates)
    // await this.redisClient.hincrby(redisKey, "value", value);
    // await this.redisClient.hset(redisKey, "lastUpdated", Date.now());
  }
}

export interface UsageQueueOptions {
  project: object;
  value: number;
  timestamp: number;
  region: string;
}
