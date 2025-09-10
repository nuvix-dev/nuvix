import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Hook } from '@nuvix/core/server';
import { Doc } from '@nuvix-tech/db';
import { Context, QueueFor } from '@nuvix/utils';
import type { Queue } from 'bullmq';
import type { ProjectsDoc } from '@nuvix/utils/types';
import type { ApiLogsQueueJobData } from '../queues/logs.queue';
import { Auth } from '@nuvix/core/helper';
import { AppConfigService } from '@nuvix/core/config.service';

@Injectable()
export class LogsHook implements Hook {
  constructor(
    @InjectQueue(QueueFor.LOGS)
    private readonly logsQueue: Queue<ApiLogsQueueJobData>,
    private readonly appConfig: AppConfigService,
  ) {}

  async onResponse(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ) {
    const project: ProjectsDoc =
      req[Context.Project] ?? new Doc({ $id: 'console' });
    const user = req[Context.User] ?? new Doc();

    if (
      project?.empty() ||
      project?.getId() === 'console' ||
      Auth.isPlatformActor
    )
      return next();

    const { authorization, cookie, ...safeHeaders } = req.headers;
    const headers = Object.entries(safeHeaders)
      .filter(([k]) => !k.toUpperCase().startsWith('X-NUVIX'))
      .reduce(
        (obj, [k, v]) => {
          obj[k] = v;
          return obj;
        },
        {} as Record<string, any>,
      );

    const metadata: Record<string, any> = {
      ips: req.ips || [req.ip],
      headers,
      host: req.host,
    };

    if (!user.empty()) {
      metadata['user'] = {
        $id: user.getId(),
        name: user.get('name'),
        email: user.get('email'),
      };
    }

    if (req['error']) {
      metadata['error'] = req['error'];
    } else if (reply.statusCode >= 400) {
      metadata['error'] = { message: reply.raw.statusMessage };
    }

    await this.logsQueue.add('log', {
      project,
      log: {
        request_id: req.id,
        method: req.method,
        path: req.url,
        status: reply.statusCode,
        timestamp: new Date(),
        client_ip: req.ip,
        user_agent: req.headers['user-agent'],
        url: req.originalUrl || req.url,
        latency_ms: reply.elapsedTime,
        region: this.appConfig.get('app').region,
        metadata,
      },
    });

    next();
  }
}
