import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { QueueFor } from '@nuvix/utils'
import type { Queue } from 'bullmq'
import { Hook } from '../../server'
import type { ApiLogsQueueJobData } from '../queues/logs.queue'

@Injectable()
export class LogsHook implements Hook {
  constructor(
    @InjectQueue(QueueFor.LOGS)
    private readonly logsQueue: Queue<ApiLogsQueueJobData>,
  ) {}

  async onResponse(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ) {
    const ctx = req.context
    if (ctx.isAdminUser || req.routeOptions.config.skipLogging) return next()

    // Shallow strip of high-risk headers before hitting Redis
    const { authorization, cookie, ...headers } = req.headers

    await this.logsQueue.add('log', {
      request_id: req.id,
      method: req.method,
      path: req.url.split('?')[0] || '/',
      status: reply.statusCode,
      timestamp: new Date(),
      client_ip: req.ip,
      resource: ctx.namespace ?? 'unknown',
      user_agent: req.headers['user-agent'] as string,
      latency_ms: reply.elapsedTime,
      error:
        reply.statusCode >= 400
          ? ctx.errorMessage || 'Error response'
          : undefined,
      region: 'default',
      metadata: {
        headers, // Processed further in queue
        query: req.query,
        mode: ctx.mode,
        session_type: ctx.authType,
        user: !ctx.user.empty() ? ctx.user.getId() : undefined,
      },
    })

    next()
  }
}
