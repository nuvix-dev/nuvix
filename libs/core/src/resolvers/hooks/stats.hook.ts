import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { configuration, MetricFor, QueueFor } from '@nuvix/utils'
import { Queue } from 'bullmq'
import { Hook } from '../../server'
import { StatsQueueJob, StatsQueueOptions } from '../queues'
import { Transform } from 'stream'

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

    const reqBodySize: number = req.hooks_args.onRequest?.sizeRef?.() ?? 0
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

  async preParsing(req: NuvixRequest, _: NuvixRes, payload: any): Promise<any> {
    let bytesReceived = 0

    // We wrap the payload stream to count bytes without storing them in memory
    const countingStream = new Transform({
      transform(chunk, _, callback) {
        bytesReceived += chunk.length
        this.push(chunk)
        callback()
      },
    })

    // Attach a helper to retrieve the final count later
    req.hooks_args = req.hooks_args || {}
    req.hooks_args.onRequest = {
      sizeRef: () => bytesReceived,
    }

    return payload.pipe(countingStream)
  }
}
