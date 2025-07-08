import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';
import {
  SMS,
  Push,
  Email,
  FCM,
  APNS,
  Telesign,
  TextMagic,
  Twilio,
  Vonage,
  Msg91,
  Mailgun,
  Sendgrid,
  SMTP,
  SMSAdapter,
  PushAdapter,
  EmailAdapter,
  Attachment,
  Priority,
} from '@nuvix/messaging';
import { Device } from '@nuvix/storage';
import { Database, Document, Query } from '@nuvix/database';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MESSAGE_TYPE_EMAIL,
  MESSAGE_TYPE_PUSH,
  MESSAGE_TYPE_SMS,
  MESSAGE_SEND_TYPE_EXTERNAL,
  APP_POSTGRES_PASSWORD,
  GET_PROJECT_DB_CLIENT,
  GET_PROJECT_DB,
  CORE_SCHEMA,
  GET_DEVICE_FOR_PROJECT,
  WORKER_TYPE_MESSAGING,
} from '@nuvix/utils/constants';
import { MessageStatus } from '@nuvix/core/messaging/status';
import {
  GetProjectDbFn,
  GetProjectDeviceFn,
  GetClientFn,
} from '@nuvix/core/core.module';

@Injectable()
@Processor(WORKER_TYPE_MESSAGING)
export class MessagingQueue extends Queue {
  private readonly logger = new Logger(MessagingQueue.name);

  constructor(
    @Inject(GET_PROJECT_DB_CLIENT) private readonly getPool: GetClientFn,
    @Inject(GET_PROJECT_DB)
    private readonly getProjectDb: GetProjectDbFn,
    @Inject(GET_DEVICE_FOR_PROJECT)
    private readonly getProjectDevice: GetProjectDeviceFn,
  ) {
    super();
  }

  async process(
    job: Job<MessagingJobData, any, MessagingJob>,
    token?: string,
  ): Promise<any> {
    switch (job.name) {
      case MESSAGE_SEND_TYPE_EXTERNAL:
        const data = job.data;
        const project = new Document(data.project as object);
        const message = new Document(data.message as object);
        const { client, dbForProject } = await this.getDatabase(project);
        const deviceForFiles = this.getProjectDevice(project.getId());

        try {
          await this.sendExternalMessage(
            dbForProject,
            message,
            deviceForFiles,
            project,
            undefined as any,
          );
        } finally {
          await this.releaseClient(client);
        }
        return {
          status: 'processed',
          messageId: message.getId(),
          projectId: project.getId(),
        };
      default:
        throw Error('Invalid Job!');
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.verbose(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${err.message}`,
    );
  }

  private getSmsAdapter(provider: Document): SMSAdapter | null {
    const credentials = provider.getAttribute('credentials') || {};

    switch (provider.getAttribute('provider')) {
      case 'twilio':
        return new Twilio(
          credentials['accountSid'] || '',
          credentials['authToken'] || '',
          null,
          credentials['messagingServiceSid'] || null,
        );
      case 'textmagic':
        return new TextMagic(
          credentials['username'] || '',
          credentials['apiKey'] || '',
        );
      case 'telesign':
        return new Telesign(
          credentials['customerId'] || '',
          credentials['apiKey'] || '',
        );
      case 'msg91':
        return new Msg91(
          credentials['senderId'] || '',
          credentials['authKey'] || '',
          credentials['templateId'] || '',
        );
      case 'vonage':
        return new Vonage(
          credentials['apiKey'] || '',
          credentials['apiSecret'] || '',
        );
      default:
        return null;
    }
  }

  private getPushAdapter(provider: Document): PushAdapter | null {
    const credentials = provider.getAttribute('credentials') || {};
    const options = provider.getAttribute('options') || {};

    switch (provider.getAttribute('provider')) {
      case 'apns':
        return new APNS(
          credentials['authKey'] || '',
          credentials['authKeyId'] || '',
          credentials['teamId'] || '',
          credentials['bundleId'] || '',
          options['sandbox'] || false,
        );
      case 'fcm':
        return new FCM(JSON.stringify(credentials['serviceAccountJSON']));
      default:
        return null;
    }
  }

  private getEmailAdapter(provider: Document): EmailAdapter | null {
    const credentials = provider.getAttribute('credentials') || {};
    const options = provider.getAttribute('options') || {};
    const apiKey = credentials['apiKey'] || '';

    switch (provider.getAttribute('provider')) {
      case 'smtp':
        return new SMTP(
          credentials['host'] || '',
          credentials['port'] || 25,
          credentials['username'] || '',
          credentials['password'] || '',
          options['encryption'] || '',
          options['autoTLS'] || false,
          options['mailer'] || '',
        );
      case 'mailgun':
        return new Mailgun(
          apiKey,
          credentials['domain'] || '',
          credentials['isEuRegion'] || false,
        );
      case 'sendgrid':
        return new Sendgrid(apiKey);
      default:
        return null;
    }
  }

  private async buildEmailMessage(
    dbForProject: Database,
    message: Document,
    provider: Document,
    deviceForFiles: Device,
    project: Document,
  ): Promise<Email> {
    const fromName = provider.getAttribute('options')?.fromName || null;
    const fromEmail = provider.getAttribute('options')?.fromEmail || null;
    const replyToEmail = provider.getAttribute('options')?.replyToEmail || null;
    const replyToName = provider.getAttribute('options')?.replyToName || null;
    const data = message.getAttribute('data') || {};
    const ccTargets = data.cc || [];
    const bccTargets = data.bcc || [];
    let cc: Array<{ email: string }> = [];
    let bcc: Array<{ email: string }> = [];
    let attachments = data.attachments || [];

    if (ccTargets.length > 0) {
      const ccTargetDocs = await dbForProject.find('targets', [
        Query.equal('$id', ccTargets),
        Query.limit(ccTargets.length),
      ]);
      for (const ccTarget of ccTargetDocs) {
        cc.push({ email: ccTarget.getAttribute('identifier') });
      }
    }

    if (bccTargets.length > 0) {
      const bccTargetDocs = await dbForProject.find('targets', [
        Query.equal('$id', bccTargets),
        Query.limit(bccTargets.length),
      ]);
      for (const bccTarget of bccTargetDocs) {
        bcc.push({ email: bccTarget.getAttribute('identifier') });
      }
    }

    if (attachments.length > 0) {
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const bucketId = attachment.bucketId;
        const fileId = attachment.fileId;

        const bucket = await dbForProject.getDocument('buckets', bucketId);
        if (bucket.isEmpty()) {
          throw new Error(
            'Storage bucket with the requested ID could not be found',
          );
        }

        const file = await dbForProject.getDocument(
          'bucket_' + bucket.getInternalId(),
          fileId,
        );
        if (file.isEmpty()) {
          throw new Error(
            'Storage file with the requested ID could not be found',
          );
        }

        const path = file.getAttribute('path', '');

        if (!(await deviceForFiles.exists(path))) {
          throw new Error('File not found in ' + path);
        }

        let contentType = 'text/plain';
        const mimeType = file.getAttribute('mimeType');
        if (mimeType) {
          contentType = mimeType;
        }

        // if (deviceForFiles.getType() !== Storage.DEVICE_LOCAL) {
        //     await deviceForFiles.transfer(path, path, this.getLocalDevice(project));
        // }

        const fileData = await deviceForFiles.read(path);

        attachments[i] = new Attachment(
          file.getAttribute('name'),
          fileData,
          contentType,
          file.getAttribute('sizeOriginal'),
        );
      }
    }

    const to = message.getAttribute('to');
    const subject = data.subject;
    const content = data.content;
    const html = data.html || false;

    return new Email({
      to,
      subject,
      content,
      fromName,
      fromEmail,
      replyToName,
      replyToEmail,
      cc,
      bcc,
      attachments,
      html,
    });
  }

  private buildSmsMessage(message: Document, provider: Document): SMS {
    const to = message.getAttribute('to');
    const content = message.getAttribute('data').content;
    const from = provider.getAttribute('options').from;

    return new SMS(to, content, from);
  }

  private buildPushMessage(message: Document): Push {
    const data = message.getAttribute('data');
    const to = message.getAttribute('to');
    let title = data.title || null;
    let body = data.body || null;
    const messageData = data.data || null;
    const action = data.action || null;
    const image = data.image?.url || null;
    const sound = data.sound || null;
    const icon = data.icon || null;
    const color = data.color || null;
    const tag = data.tag || null;
    const badge = data.badge || null;
    const contentAvailable = data.contentAvailable || null;
    const critical = data.critical || null;
    let priority = data.priority || null;

    if (title === '') {
      title = null;
    }
    if (body === '') {
      body = null;
    }
    if (priority !== null) {
      priority = priority === 'high' ? Priority.HIGH : Priority.NORMAL;
    }

    return new Push({
      to,
      title,
      body,
      data: messageData,
      action,
      sound,
      image,
      icon,
      color,
      tag,
      badge,
      contentAvailable,
      critical,
      priority,
    });
  }

  private async sendExternalMessage(
    dbForProject: Database,
    message: Document,
    deviceForFiles: Device,
    project: Document,
    queueForStatsUsage: any, // Replace with proper type
  ): Promise<void> {
    const topicIds = message.getAttribute('topics', []);
    const targetIds = message.getAttribute('targets', []);
    const userIds = message.getAttribute('users', []);
    const providerType = message.getAttribute('providerType');

    let allTargets: Document[] = [];

    if (topicIds.length > 0) {
      const topics = await dbForProject.find('topics', [
        Query.equal('$id', topicIds),
        Query.limit(topicIds.length),
      ]);
      for (const topic of topics) {
        const targets = topic
          .getAttribute('targets')
          .filter(
            (target: Document) =>
              target.getAttribute('providerType') === providerType,
          );
        allTargets.push(...targets);
      }
    }

    if (userIds.length > 0) {
      const users = await dbForProject.find('users', [
        Query.equal('$id', userIds),
        Query.limit(userIds.length),
      ]);
      for (const user of users) {
        const targets = user
          .getAttribute('targets')
          .filter(
            (target: Document) =>
              target.getAttribute('providerType') === providerType,
          );
        allTargets.push(...targets);
      }
    }

    if (targetIds.length > 0) {
      const targets = await dbForProject.find('targets', [
        Query.equal('$id', targetIds),
        Query.equal('providerType', [providerType]),
        Query.limit(targetIds.length),
      ]);
      allTargets.push(...targets);
    }

    if (allTargets.length === 0) {
      await dbForProject.updateDocument(
        'messages',
        message.getId(),
        message.setAttributes({
          status: MessageStatus.FAILED,
          deliveryErrors: ['No valid recipients found.'],
        }),
      );
      console.warn('No valid recipients found.');
      return;
    }

    const defaultProvider = await dbForProject.findOne('providers', [
      Query.equal('enabled', [true]),
      Query.equal('type', [providerType]),
    ]);

    if (defaultProvider.isEmpty()) {
      await dbForProject.updateDocument(
        'messages',
        message.getId(),
        message.setAttributes({
          status: MessageStatus.FAILED,
          deliveryErrors: ['No enabled provider found.'],
        }),
      );
      console.warn('No enabled provider found.');
      return;
    }

    const identifiers: Record<string, Record<string, null>> = {};
    const providers: Record<string, Document> = {
      [defaultProvider.getId()]: defaultProvider,
    };

    for (const target of allTargets) {
      let providerId = target.getAttribute('providerId');
      if (!providerId) {
        providerId = defaultProvider.getId();
      }

      if (providerId) {
        if (!identifiers[providerId]) {
          identifiers[providerId] = {};
        }
        identifiers[providerId][target.getAttribute('identifier')] = null;
      }
    }

    const providerPromises = Object.keys(identifiers).map(async providerId => {
      let provider: Document;
      if (providers[providerId]) {
        provider = providers[providerId];
      } else {
        provider = await dbForProject.getDocument('providers', providerId);
        if (provider.isEmpty() || !provider.getAttribute('enabled')) {
          provider = defaultProvider;
        } else {
          providers[providerId] = provider;
        }
      }

      const identifiersForProvider = identifiers[providerId];

      let adapter: SMSAdapter | PushAdapter | EmailAdapter;
      switch (provider.getAttribute('type')) {
        case MESSAGE_TYPE_SMS:
          adapter = this.getSmsAdapter(provider);
          break;
        case MESSAGE_TYPE_PUSH:
          adapter = this.getPushAdapter(provider);
          break;
        case MESSAGE_TYPE_EMAIL:
          adapter = this.getEmailAdapter(provider);
          break;
        default:
          throw new Error(
            'Provider with the requested ID is of the incorrect type',
          );
      }

      if (!adapter) {
        throw new Error('Failed to create adapter for provider');
      }

      const batches = this.chunkArray(
        Object.keys(identifiersForProvider),
        adapter.getMaxMessagesPerRequest(),
      );

      const batchPromises = batches.map(async batch => {
        let deliveredTotal = 0;
        const deliveryErrors: string[] = [];
        const messageData = message; // TODO: ----
        messageData.setAttribute('to', batch);

        let data: SMS | Push | Email;
        switch (provider.getAttribute('type')) {
          case MESSAGE_TYPE_SMS:
            data = this.buildSmsMessage(messageData, provider);
            break;
          case MESSAGE_TYPE_PUSH:
            data = this.buildPushMessage(messageData);
            break;
          case MESSAGE_TYPE_EMAIL:
            data = await this.buildEmailMessage(
              dbForProject,
              messageData,
              provider,
              deviceForFiles,
              project,
            );
            break;
          default:
            throw new Error(
              'Provider with the requested ID is of the incorrect type',
            );
        }

        try {
          const response = await adapter.send(data);
          deliveredTotal += response.deliveredTo as number;

          for (const result of response.results as any[]) {
            if (result.status === 'failure') {
              deliveryErrors.push(
                `Failed sending to target ${result.recipient} with error: ${result.error}`,
              );
            }

            // Deleting push targets when token has expired
            if (result.error === 'Expired device token') {
              const target = await dbForProject.findOne('targets', [
                Query.equal('identifier', [result.recipient]),
              ]);

              if (!target.isEmpty()) {
                await dbForProject.updateDocument(
                  'targets',
                  target.getId(),
                  target.setAttribute('expired', true),
                );
              }
            }
          }
        } catch (error) {
          deliveryErrors.push(
            `Failed sending to targets with error: ${error.message}`,
          );
        } finally {
          const errorTotal = deliveryErrors.length;
          // Add stats usage metrics here if needed
          // queueForStatsUsage...

          return {
            deliveredTotal,
            deliveryErrors,
          };
        }
      });

      return Promise.all(batchPromises);
    });

    const results = (await Promise.all(providerPromises)).flat();

    let deliveredTotal = 0;
    let deliveryErrors: string[] = [];

    for (const result of results) {
      deliveredTotal += result.deliveredTotal;
      deliveryErrors = [...deliveryErrors, ...result.deliveryErrors];
    }

    if (deliveryErrors.length === 0 && deliveredTotal === 0) {
      deliveryErrors.push('Unknown error');
    }

    message.setAttribute('deliveryErrors', deliveryErrors);

    if (message.getAttribute('deliveryErrors').length > 0) {
      message.setAttribute('status', MessageStatus.FAILED);
    } else {
      message.setAttribute('status', MessageStatus.SENT);
    }

    message.removeAttribute('to');

    for (const provider of Object.values(providers)) {
      message.setAttribute(
        'search',
        `${message.getAttribute('search')} ${provider.getAttribute('name')} ${provider.getAttribute('provider')} ${provider.getAttribute('type')}`,
      );
    }

    message.setAttribute('deliveredTotal', deliveredTotal);
    message.setAttribute('deliveredAt', new Date().toISOString());

    await dbForProject.updateDocument('messages', message.getId(), message);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async getDatabase(project: Document) {
    const dbOptions = project.getAttribute('database');
    const client = await this.getPool(project.getId(), {
      database: dbOptions.name,
      user: dbOptions.adminRole,
      password: APP_POSTGRES_PASSWORD,
      port: dbOptions.port,
      host: dbOptions.host,
    });
    const dbForProject = this.getProjectDb(client, project.getId());
    dbForProject.setDatabase(CORE_SCHEMA);
    return { client, dbForProject };
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

export type MessagingJob = typeof MESSAGE_SEND_TYPE_EXTERNAL;

export interface MessagingJobData {
  message: Document | Object;
  project: Document | Object;
}
