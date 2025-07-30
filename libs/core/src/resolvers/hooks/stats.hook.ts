import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Hook } from '@nuvix/core/server';
import { MetricFor, PROJECT, QueueFor } from '@nuvix/utils/constants';
import { Queue } from 'bullmq';
import { StatsQueueOptions } from '../queues';
import { Authorization, Document } from '@nuvix/database';
import { Auth } from '@nuvix/core/helper';

@Injectable()
export class StatsHook implements Hook {
  constructor(
    @InjectQueue(QueueFor.STATS)
    private readonly statsQueue: Queue<StatsQueueOptions, any, MetricFor>,
  ) { }

  async onResponse(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ): Promise<unknown> {
    const project: Document = req[PROJECT];
    if (
      project.isEmpty() ||
      project.getId() === 'console' ||
      Auth.isPrivilegedUser(Authorization.getRoles())
    )
      return;

    const reqBodySize: number = req['hooks_args']['onRequest']?.size || 0;
    const resBodySize: number = Number(reply.getHeader('Content-Length')) || 0;

    await this.statsQueue.addBulk([
      { name: MetricFor.REQUESTS, data: { value: 1, project } },
      { name: MetricFor.INBOUND, data: { value: reqBodySize, project } },
      { name: MetricFor.OUTBOUND, data: { value: resBodySize, project } },
    ]);

    return;
  }
}
