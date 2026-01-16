import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Hook } from '../../server'
import { configuration, Context, MetricFor, QueueFor } from '@nuvix/utils'
import { Queue } from 'bullmq'
import { StatsQueueOptions, StatsQueueJob } from '../queues'
import { Auth } from '../../helpers'
import type { ProjectsDoc } from '@nuvix/utils/types'

@Injectable()
export class StatsHook implements Hook {
  constructor(
    @InjectQueue(QueueFor.STATS)
    private readonly statsQueue: Queue<StatsQueueOptions, any, StatsQueueJob>,
  ) {}

  async onResponse(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ): Promise<unknown> {
    if (configuration.app.enableStats === false) return

    const project: ProjectsDoc = req[Context.Project]
    if (
      project.empty() ||
      project.getId() === 'console' ||
      Auth.isPlatformActor
    )
      return

    const reqBodySize: number = req['hooks_args']['onRequest']?.sizeRef?.() ?? 0
    const resBodySize: number = Number(reply.getHeader('Content-Length')) || 0

    await this.statsQueue.add(StatsQueueJob.ADD_METRIC, {
      project,
      metrics: [
        { key: MetricFor.REQUESTS, value: 1 },
        { key: MetricFor.INBOUND, value: reqBodySize },
        { key: MetricFor.OUTBOUND, value: resBodySize },
      ],
    })

    return
  }
}
