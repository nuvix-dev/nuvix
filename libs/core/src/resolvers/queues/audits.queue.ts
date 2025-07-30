import { Processor } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from './queue';
import {
  APP_POSTGRES_PASSWORD,
  AppMode,
  CORE_SCHEMA,
  GET_PROJECT_DB,
  GET_PROJECT_DB_CLIENT,
  QueueFor,
} from '@nuvix/utils/constants';
import { GetClientFn, GetProjectDbFn } from '@nuvix/core/core.module';
import { Document } from '@nuvix/database';
import { Audit } from '@nuvix/audit';
import { Job } from 'bullmq';

interface AuditLogsBuffer {
  project: Document;
  logs: AuditLog[];
}

@Injectable()
@Processor(QueueFor.AUDITS, { concurrency: 50000 })
export class AuditsQueue
  extends Queue
  implements OnModuleInit, OnModuleDestroy {
  private static readonly BATCH_SIZE = 1000; // Number of logs to process in one batch
  private static readonly BATCH_INTERVAL_MS = 1000; // Interval in milliseconds to flush
  private readonly logger = new Logger(AuditsQueue.name);
  private buffer = new Map<string, AuditLogsBuffer>();
  private interval: NodeJS.Timeout;

  constructor(
    @Inject(GET_PROJECT_DB_CLIENT) private readonly getDbClient: GetClientFn,
    @Inject(GET_PROJECT_DB)
    private readonly getProjectDb: GetProjectDbFn,
  ) {
    super();
  }

  onModuleInit() {
    this.startTimer();
  }

  async onModuleDestroy() {
    Logger.log('Module destroying. Flushing remaining logs...');
    clearInterval(this.interval);
    await this.flushBuffer();
  }

  private startTimer(): void {
    this.interval = setInterval(
      () => this.flushBuffer(),
      AuditsQueue.BATCH_INTERVAL_MS,
    );
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.size === 0) {
      return;
    }

    const bufferCopy = new Map(this.buffer);
    this.buffer.clear();

    for (const [projectId, data] of bufferCopy.entries()) {
      if (data.logs.length === 0) {
        continue;
      }

      let client:
        | Awaited<ReturnType<typeof this.getDatabase>>['client']
        | undefined;
      try {
        const { project, logs } = data;
        const { client: _c, audits } = await this.getDatabase(project);
        client = _c;

        this.logger.log(
          `Flushing ${logs.length} audit logs for project ${projectId}`,
        );
        await audits.logBatch(logs);
      } catch (error) {
        this.logger.error(
          `Error flushing audit logs for project ${projectId}:`,
          error,
        );
        // Re-add failed logs to buffer for retry
        const currentBuffer = this.buffer.get(projectId) || {
          project: data.project,
          logs: [],
        };
        currentBuffer.logs.push(...data.logs);
        this.buffer.set(projectId, currentBuffer);
      } finally {
        if (client) {
          await this.releaseClient(client);
        }
      }
    }
  }

  async process(job: Job<AuditsQueueJobData>): Promise<void> {
    const { resource, mode, userAgent, ip, data } = job.data;
    const project = new Document(job.data.project as object);
    const user = new Document(job.data.user ?? {});
    const projectId = project.getInternalId();
    const log: AuditLog = {
      userId: user.getInternalId(),
      event: job.name,
      resource,
      userAgent: userAgent || '',
      ip: ip || '',
      location: '', // TODO: Implement location extraction logic
      data: {
        userId: user.getId(),
        userName: user.getAttribute('name') || '',
        userEmail: user.getAttribute('email') || '',
        userType: user.getAttribute('type') || '',
        mode,
        data: data || {},
      },
      timestamp: new Date(),
    };

    if (!this.buffer.has(projectId)) {
      this.buffer.set(projectId, {
        project: new Document({
          $id: projectId,
          $internalId: projectId,
          database: project.getAttribute('database'),
        }),
        logs: [],
      });
    }

    this.buffer.get(projectId)!.logs.push(log);

    if (this.buffer.get(projectId)!.logs.length >= AuditsQueue.BATCH_SIZE) {
      // Temporarily stop the timer to avoid a race condition where the timer
      // and a full buffer try to flush at the same exact time.
      clearInterval(this.interval);
      await this.flushBuffer();
      this.startTimer(); // Restart the timer
    }
  }

  private async getDatabase(project: Document) {
    const dbOptions = project.getAttribute('database');
    const client = await this.getDbClient(project.getId(), {
      database: dbOptions.name,
      user: dbOptions.adminRole,
      password: APP_POSTGRES_PASSWORD,
      port: dbOptions.port,
      host: dbOptions.host,
    });
    const dbForProject = this.getProjectDb(client, project.getId());
    dbForProject
      .setDatabase(CORE_SCHEMA)
      .setCacheName(`${project.getId()}:core`);
    const audits = new Audit(dbForProject);
    return { client, audits };
  }

  private async releaseClient(
    client: Awaited<ReturnType<typeof this.getDatabase>>['client'],
  ) {
    try {
      if (client) {
        await client.end();
      }
    } catch (error) {
      this.logger.error('Failed to release database client', error);
    }
  }
}

export type AuditsQueueJobData = {
  project: Document | object;
  user: Document | object;
  resource: string;
  mode: AppMode;
  userAgent?: string;
  ip?: string;
  data?: Record<string, any>;
};

interface AuditLog {
  userId: string;
  event: string;
  resource: string;
  userAgent: string;
  ip: string;
  location: string;
  data: {
    userId: string;
    userName: string;
    userEmail: string;
    userType: string;
    mode: AppMode;
    data: Record<string, any>;
  };
  timestamp: Date;
}
