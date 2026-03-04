import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { configuration, MetricFor, QueueFor } from '@nuvix/utils'
import { Queue } from 'bullmq'
import { Hook } from '../../server'
import { StatsQueueJob, StatsQueueOptions } from '../queues'

@Injectable()
export class StatsHook implements Hook {
  constructor(
    @InjectQueue(QueueFor.STATS)
    private readonly statsQueue: Queue<StatsQueueOptions, any, StatsQueueJob>,
  ) {}

  async onResponse(
    req: NuvixRequest,
    reply: NuvixRes,
    _next: (err?: Error) => void,
  ): Promise<unknown> {
    if (configuration.app.enableStats === false) {
      return
    }

    if (req.context.isAdminUser) {
      return
    }

    const reqBodySize: number = req.requestSize?.() || 0
    const resBodySize: number = Number(reply.getHeader('Content-Length')) || 0

    await this.statsQueue.add(StatsQueueJob.ADD_METRIC, {
      metrics: [
        { key: MetricFor.REQUESTS, value: 1 },
        { key: MetricFor.INBOUND, value: reqBodySize },
        { key: MetricFor.OUTBOUND, value: resBodySize },
      ],
    })

    return
  }
}
