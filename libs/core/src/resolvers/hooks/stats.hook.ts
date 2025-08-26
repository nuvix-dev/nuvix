import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Hook } from '@nuvix/core/server';
import { Context, MetricFor, QueueFor } from '@nuvix/utils';
import { Queue } from 'bullmq';
import { StatsQueueOptions } from '../queues';
import { Auth } from '@nuvix/core/helper';
import type { ProjectsDoc } from '@nuvix/utils/types';

@Injectable()
export class StatsHook implements Hook {
  constructor(
    @InjectQueue(QueueFor.STATS)
    private readonly statsQueue: Queue<StatsQueueOptions, any, MetricFor>,
  ) {}

  async onResponse(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ): Promise<unknown> {
    const project: ProjectsDoc = req[Context.Project];
    if (
      project.empty() ||
      project.getId() === 'console' ||
      Auth.isPlatformActor
    )
      return;

    const reqBodySize: number =
      req['hooks_args']['onRequest']?.sizeRef?.() ?? 0;
    const resBodySize: number = Number(reply.getHeader('Content-Length')) || 0;

    await this.statsQueue.addBulk([
      { name: MetricFor.REQUESTS, data: { value: 1, project } },
      { name: MetricFor.INBOUND, data: { value: reqBodySize, project } },
      { name: MetricFor.OUTBOUND, data: { value: resBodySize, project } },
    ]);

    return;
  }
}
