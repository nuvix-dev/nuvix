import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Doc } from '@nuvix/db'
import { Context, QueueFor } from '@nuvix/utils'
import type { ProjectsDoc } from '@nuvix/utils/types'
import type { Queue } from 'bullmq'
import { AuthType } from '../../decorators'
import { Auth } from '../../helpers'
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
    const project: ProjectsDoc =
      req[Context.Project] ?? new Doc({ $id: 'console' })
    const user = req[Context.User] ?? new Doc()
    const skipLogging = req.routeOptions.config.skipLogging || false

    if (
      project?.empty() ||
      project?.getId() === 'console' ||
      Auth.isPlatformActor ||
      skipLogging
    ) {
      return next()
    }

    const namespace = req[Context.Namespace]
    const path = req.url.split('?')[0] || '/'
    const { authorization, cookie, ...safeHeaders } = req.headers
    const headers = Object.entries(safeHeaders)
      .filter(([k]) => !k.toUpperCase().startsWith('X-NUVIX'))
      .reduce(
        (obj, [k, v]) => {
          obj[k] = v
          return obj
        },
        {} as Record<string, any>,
      )

    const metadata: Record<string, any> = {
      ips: req.ips || [req.ip],
      headers,
      host: req.host,
      query: req.query,
      mode: req[Context.Mode],
      team: req[Context.Team]?.empty()
        ? null
        : {
            $id: req[Context.Team]?.getId(),
            name: req[Context.Team]?.get('name'),
          },
      auth_type: req[Context.AuthType] || AuthType.SESSION,
      api_key: !!req[Context.ApiKey],
    }

    if (!user.empty()) {
      metadata.user = {
        $id: user.getId(),
        name: user.get('name'),
        email: user.get('email'),
      }
    }

    if (req.error) {
      metadata.error = req.error
    } else if (reply.statusCode >= 400) {
      metadata.error = { message: reply.raw.statusMessage }
    }

    await this.logsQueue.add('log', {
      project,
      log: {
        request_id: req.id,
        method: req.method,
        path,
        status: reply.statusCode,
        timestamp: new Date(),
        client_ip: req.ip,
        resource: namespace ?? 'unknown',
        user_agent: req.headers['user-agent'],
        url: req.url,
        latency_ms: reply.elapsedTime,
        region: this.appConfig.get('app').region,
        metadata,
      },
    })

    next()
  }
}
