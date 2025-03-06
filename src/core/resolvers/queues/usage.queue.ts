import { Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import {
  WORKER_TYPE_USAGE,
  METRIC_NETWORK_REQUESTS,
  METRIC_NETWORK_INBOUND,
  METRIC_NETWORK_OUTBOUND,
  CACHE_DB,
} from 'src/Utils/constants';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Document } from '@nuvix/database';
import { MetricsHelper } from 'src/core/helper/metrics.helper';

@Processor(WORKER_TYPE_USAGE)
export class UsageQueue extends Queue {
  private readonly logger = new Logger(UsageQueue.name);
  private metrics: MetricsHelper;
  constructor(@Inject(CACHE_DB) cacheDb: Redis) {
    super();
    this.metrics = new MetricsHelper(cacheDb);
  }

  async process(job: Job<UsageQueueOptions, any, UsageJobs>): Promise<any> {
    const { project: p, value, region } = job.data;
    const project = new Document(p);
    const metric = job.name;

    this.logger.debug(job.data);

    // this.metrics.incrementBandwidth

    // const redisKey = `stats:${projectId}:${metric}:${region}`;

    // // Aggregate values in Redis (incremental updates)
    // await this.redisClient.hincrby(redisKey, "value", value);
    // await this.redisClient.hset(redisKey, "lastUpdated", Date.now());
  }
}

export interface UsageQueueOptions {
  project: Object;
  value: number;
  timestamp: number;
  region: string;
}

export enum UsageJobs {
  NETWORK_REQUESTS = METRIC_NETWORK_REQUESTS,
  NETWORK_INBOUND = METRIC_NETWORK_INBOUND,
  NETWORK_OUTBOUND = METRIC_NETWORK_OUTBOUND,
}
