import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Hook } from '@nuvix/core/server';
import { Doc } from '@nuvix-tech/db';
import { Context, QueueFor } from '@nuvix/utils';
import type { Queue } from 'bullmq';

@Injectable()
export class LogsHook implements Hook {
  constructor(@InjectQueue(QueueFor.LOGS) private readonly logsQueue: Queue) {}

  async onResponse(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ) {
    const project = req[Context.Project] ?? new Doc({ $id: 'console' });
    // TODO: queue api logs
    return;
  }
}
