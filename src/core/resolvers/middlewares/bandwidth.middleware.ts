import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { Request, Response, NextFunction } from 'express';
import { CACHE_DB, PROJECT, WORKER_TYPE_USAGE } from 'src/Utils/constants';
import { Redis } from 'ioredis';
import { MetricsHelper } from 'src/core/helper/metrics.helper';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UsageJobs, UsageQueueOptions } from '../queues/usage.queue';

@Injectable()
export class BandwidthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BandwidthMiddleware.name);

  constructor(
    @InjectQueue(WORKER_TYPE_USAGE)
    private readonly usageQueue: Queue<UsageQueueOptions, any, UsageJobs>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const project: Document = req[PROJECT];

    if (project.getId() !== 'console') {
      const startTime = process.hrtime();

      let responseSize = 0;
      const originalWrite = res.write;
      const originalEnd = res.end;

      res.write = function (chunk: any, ...args: any[]) {
        responseSize += chunk.length;
        return originalWrite.apply(res, [chunk, ...args]);
      };

      res.end = function (chunk: any, ...args: any[]) {
        if (chunk) responseSize += chunk.length;
        return originalEnd.apply(res, [chunk, ...args]);
      };

      res.on('finish', async () => {
        const duration = process.hrtime(startTime);
        const elapsedTimeMs = duration[0] * 1000 + duration[1] / 1e6;

        const requestSize = parseInt(req.headers['content-length'] || '0', 10);
        const outboundSize = responseSize;
        const inboundSize = requestSize;

        const region = process.env.APP_REGION || 'default';

        await this.usageQueue.add(UsageJobs.NETWORK_REQUESTS, {
          project: project.toObj(),
          value: 1,
          timestamp: Date.now(),
          region,
        });
        await this.usageQueue.add(UsageJobs.NETWORK_INBOUND, {
          project: project.toObj(),
          value: inboundSize,
          timestamp: Date.now(),
          region,
        });
        await this.usageQueue.add(UsageJobs.NETWORK_OUTBOUND, {
          project: project.toObj(),
          value: outboundSize,
          timestamp: Date.now(),
          region,
        });
      });
    }

    next();
  }
}
