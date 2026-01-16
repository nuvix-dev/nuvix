import { OnWorkerEvent, Processor } from '@nestjs/bullmq'
import { Queue } from './queue'
import { Job } from 'bullmq'
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
} from '@nuvix/messaging'
import { Device } from '@nuvix/storage'
import { Database, Doc, Query } from '@nuvix/db'
import { Injectable, Logger } from '@nestjs/common'
import { Schemas, QueueFor, MessageType, MessageProvider } from '@nuvix/utils'
import { MessageStatus } from '@nuvix/utils'
import type {
  Files,
  Messages,
  MessagesDoc,
  Projects,
  ProjectsDoc,
  ProvidersDoc,
  TargetsDoc,
} from '@nuvix/utils/types'
import { CoreService } from '../../core.service.js'

@Injectable()
@Processor(QueueFor.MESSAGING, { concurrency: 10000 })
export class MessagingQueue extends Queue {
  private readonly logger = new Logger(MessagingQueue.name)

  constructor(private readonly coreService: CoreService) {
    super()
  }

  async process(job: Job<MessagingJobData, any, MessagingJob>): Promise<any> {
    switch (job.name) {
      case MessagingJob.EXTERNAL:
        const data = job.data
        const project = new Doc(data.project as unknown as Projects)
        const message = new Doc(data.message as unknown as Messages)
        const { client, dbForProject } =
          await this.coreService.createProjectDatabase(project, {
            schema: Schemas.Core,
          })
        const deviceForFiles = this.coreService.getProjectDevice(
          project.getId(),
        )

        try {
          await this.sendExternalMessage(
            dbForProject,
            message,
            deviceForFiles,
            project,
            undefined as any,
          )
        } finally {
          await this.coreService.releaseDatabaseClient(client)
        }
        return {
          status: 'processed',
          messageId: message.getId(),
          projectId: project.getId(),
        }
      default:
        throw Error('Invalid Job!')
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.verbose(`Processing job ${job.id} of type ${job.name}`)
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${err.message}`,
    )
  }

  private getSmsAdapter(provider: ProvidersDoc): SMSAdapter | null {
    const credentials = provider.get('credentials', {}) as Record<string, any>

    switch (provider.get('provider') as MessageProvider) {
      case MessageProvider.TELESIGN:
        return new Telesign(
          credentials['customerId'] || '',
          credentials['apiKey'] || '',
        )
      case MessageProvider.TEXTMAGIC:
        return new TextMagic(
          credentials['username'] || '',
          credentials['apiKey'] || '',
        )
      case MessageProvider.TWILIO:
        return new Twilio(
          credentials['accountSid'] || '',
          credentials['authToken'] || '',
          undefined,
          credentials['messagingServiceSid'] || null,
        )
      case MessageProvider.VONAGE:
        return new Vonage(
          credentials['apiKey'] || '',
          credentials['apiSecret'] || '',
        )
      case MessageProvider.MSG91:
        return new Msg91(
          credentials['senderId'] || '',
          credentials['authKey'] || '',
          credentials['templateId'] || '',
        )
      default:
        return null
    }
  }

  private getPushAdapter(provider: ProvidersDoc): PushAdapter | null {
    const credentials = provider.get('credentials', {}) as Record<string, any>
    const options = provider.get('options') || {}

    switch (provider.get('provider') as MessageProvider) {
      case MessageProvider.APNS:
        return new APNS(
          credentials['authKey'] || '',
          credentials['authKeyId'] || '',
          credentials['teamId'] || '',
          credentials['bundleId'] || '',
          options['sandbox'] || false,
        )
      case MessageProvider.FCM:
        return new FCM(JSON.stringify(credentials['serviceAccountJSON']))
      default:
        return null
    }
  }

  private getEmailAdapter(provider: ProvidersDoc): EmailAdapter | null {
    const credentials = provider.get('credentials', {}) as Record<string, any>
    const options = provider.get('options') || {}
    const apiKey = credentials['apiKey'] || ''

    switch (provider.get('provider') as MessageProvider) {
      case MessageProvider.SMTP:
        return new SMTP(
          credentials['host'] ?? '',
          credentials['port'] ?? 25,
          credentials['username'] ?? '',
          credentials['password'] ?? '',
          options['autoTLS'] ?? false,
          options['encryption'] || '',
          options['mailer'] || '',
        )
      case MessageProvider.MAILGUN:
        return new Mailgun(
          apiKey,
          credentials['domain'] || '',
          credentials['isEuRegion'] || false,
        )
      case MessageProvider.SENDGRID:
        return new Sendgrid(apiKey)
      default:
        return null
    }
  }

  private async buildEmailMessage(
    dbForProject: Database,
    message: MessagesDoc,
    provider: ProvidersDoc,
    deviceForFiles: Device,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    project: ProjectsDoc,
  ): Promise<Email> {
    const fromName = provider.get('options')?.['fromName'] || null
    const fromEmail = provider.get('options')?.['fromEmail'] || null
    const replyToEmail = provider.get('options')?.['replyToEmail'] || null
    const replyToName = provider.get('options')?.['replyToName'] || null
    const data = message.get('data') || {}
    const ccTargets = data['cc'] || []
    const bccTargets = data['bcc'] || []
    const cc: Array<{ email: string }> = []
    const bcc: Array<{ email: string }> = []
    const attachments = data['attachments'] || []

    if (ccTargets.length > 0) {
      const ccTargetDocs = await dbForProject.withSchema(Schemas.Auth, () =>
        dbForProject.find('targets', [
          Query.equal('$id', ccTargets),
          Query.limit(ccTargets.length),
        ]),
      )
      for (const ccTarget of ccTargetDocs) {
        cc.push({ email: ccTarget.get('identifier') })
      }
    }

    if (bccTargets.length > 0) {
      const bccTargetDocs = await dbForProject.withSchema(Schemas.Auth, () =>
        dbForProject.find('targets', [
          Query.equal('$id', bccTargets),
          Query.limit(bccTargets.length),
        ]),
      )
      for (const bccTarget of bccTargetDocs) {
        bcc.push({ email: bccTarget.get('identifier') })
      }
    }

    if (attachments.length > 0) {
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i]
        const bucketId = attachment.bucketId
        const fileId = attachment.fileId

        const bucket = await dbForProject.getDocument('buckets', bucketId)
        if (bucket.empty()) {
          throw new Error(
            'Storage bucket with the requested ID could not be found',
          )
        }

        const file = await dbForProject.getDocument<Files>(
          'bucket_' + bucket.getSequence(),
          fileId,
        )
        if (file.empty()) {
          throw new Error(
            'Storage file with the requested ID could not be found',
          )
        }

        const path = file.get('path', '')

        if (!(await deviceForFiles.exists(path))) {
          throw new Error('File not found in ' + path)
        }

        let contentType = 'text/plain'
        const mimeType = file.get('mimeType')
        if (mimeType) {
          contentType = mimeType
        }

        // if (deviceForFiles.getType() !== Storage.DEVICE_LOCAL) {
        //     await deviceForFiles.transfer(path, path, this.getLocalDevice(project));
        // }

        const fileData = await deviceForFiles.read(path)

        attachments[i] = new Attachment(
          file.get('name'),
          fileData,
          contentType,
          file.get('sizeOriginal'),
        )
      }
    }

    const to = message.get('to') as string[]
    const subject = data['subject']
    const content = data['content']
    const html = data['html'] || false

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
    })
  }

  private buildSmsMessage(message: MessagesDoc, provider: ProvidersDoc): SMS {
    const to = message.get('to') as string[]
    const content = message.get('data')['content']
    const from = provider.get('options')['from']

    return new SMS(to, content, from)
  }

  private buildPushMessage(message: MessagesDoc): Push {
    const data = message.get('data')
    const to = message.get('to') as string[]
    let title = data['title'] || null
    let body = data['body'] || null
    const messageData = data['data'] || null
    const action = data['action'] || null
    const image = data['image']?.url || null
    const sound = data['sound'] || null
    const icon = data['icon'] || null
    const color = data['color'] || null
    const tag = data['tag'] || null
    const badge = data['badge'] || null
    const contentAvailable = data['contentAvailable'] || null
    const critical = data['critical'] || null
    let priority = data['priority'] || null

    if (title === '') {
      title = null
    }
    if (body === '') {
      body = null
    }
    if (priority !== null) {
      priority = priority === 'high' ? Priority.HIGH : Priority.NORMAL
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
    })
  }

  private async sendExternalMessage(
    dbForProject: Database,
    message: MessagesDoc,
    deviceForFiles: Device,
    project: ProjectsDoc,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queueForStatsUsage: any,
  ): Promise<void> {
    const topicIds = message.get('topics', [])
    const targetIds = message.get('targets', [])
    const userIds = message.get('users', [])
    const providerType = message.get('providerType') as MessageType

    const allTargets: TargetsDoc[] = []

    if (topicIds.length > 0) {
      const topics = await dbForProject.find('topics', [
        Query.equal('$id', topicIds),
        Query.limit(topicIds.length),
      ])
      for (const topic of topics) {
        const targets = (topic.get('targets') as TargetsDoc[]).filter(
          target => target.get('providerType') === providerType,
        )
        allTargets.push(...targets)
      }
    }

    if (userIds.length > 0) {
      const users = await dbForProject.withSchema(Schemas.Auth, () =>
        dbForProject.find('users', [
          Query.equal('$id', userIds),
          Query.limit(userIds.length),
        ]),
      )
      for (const user of users) {
        const targets = (user.get('targets') as TargetsDoc[]).filter(
          target => target.get('providerType') === providerType,
        )
        allTargets.push(...targets)
      }
    }

    if (targetIds.length > 0) {
      const targets = await dbForProject.withSchema(Schemas.Auth, () =>
        dbForProject.find('targets', [
          Query.equal('$id', targetIds),
          Query.equal('providerType', [providerType]),
          Query.limit(targetIds.length),
        ]),
      )
      allTargets.push(...targets)
    }

    if (allTargets.length === 0) {
      await dbForProject.updateDocument(
        'messages',
        message.getId(),
        message
          .set('status', MessageStatus.FAILED)
          .set('deliveryErrors', ['No valid recipients found.']),
      )
      this.logger.warn('No valid recipients found.')
      return
    }

    const defaultProvider = await dbForProject.findOne('providers', [
      Query.equal('enabled', [true]),
      Query.equal('type', [providerType]),
    ])

    if (defaultProvider.empty()) {
      await dbForProject.updateDocument(
        'messages',
        message.getId(),
        message
          .set('status', MessageStatus.FAILED)
          .set('deliveryErrors', ['No enabled provider found.']),
      )
      console.warn('No enabled provider found.')
      return
    }

    const identifiers: Record<string, Record<string, null>> = {}
    const providers: Record<string, ProvidersDoc> = {
      [defaultProvider.getId()]: defaultProvider,
    }

    for (const target of allTargets) {
      let providerId = target.get('providerId')
      if (!providerId) {
        providerId = defaultProvider.getId()
      }

      if (providerId) {
        if (!identifiers[providerId]) {
          identifiers[providerId] = {}
        }
        identifiers[providerId]![target.get('identifier')] = null
      }
    }

    const providerPromises = Object.keys(identifiers).map(async providerId => {
      let provider: ProvidersDoc
      if (providers[providerId]) {
        provider = providers[providerId]
      } else {
        provider = await dbForProject.getDocument('providers', providerId)
        if (provider.empty() || !provider.get('enabled')) {
          provider = defaultProvider
        } else {
          providers[providerId] = provider
        }
      }

      const identifiersForProvider = identifiers[providerId]!

      let adapter: SMSAdapter | PushAdapter | EmailAdapter | null = null
      switch (provider.get('type') as MessageType) {
        case MessageType.EMAIL:
          adapter = this.getEmailAdapter(provider)
          break
        case MessageType.PUSH:
          adapter = this.getPushAdapter(provider)
          break
        case MessageType.SMS:
          adapter = this.getSmsAdapter(provider)
          break
        default:
          throw new Error(
            'Provider with the requested ID is of the incorrect type',
          )
      }

      if (!adapter) {
        throw new Error('Failed to create adapter for provider')
      }

      const batches = this.chunkArray(
        Object.keys(identifiersForProvider),
        adapter.getMaxMessagesPerRequest(),
      )

      const batchPromises = batches.map(async batch => {
        let deliveredTotal = 0
        const deliveryErrors: string[] = []
        const messageData: Doc<Messages & { to?: string }> = message // TODO: should we clone it?
        messageData.set('to', batch)

        let data: SMS | Push | Email
        switch (provider.get('type') as MessageType) {
          case MessageType.EMAIL:
            data = await this.buildEmailMessage(
              dbForProject,
              messageData,
              provider,
              deviceForFiles,
              project,
            )
            break
          case MessageType.PUSH:
            data = this.buildPushMessage(messageData)
            break
          case MessageType.SMS:
            data = this.buildSmsMessage(messageData, provider)
            break
          default:
            throw new Error(
              'Provider with the requested ID is of the incorrect type',
            )
        }

        try {
          const response = await adapter.send(data)
          deliveredTotal += response.deliveredTo as number

          for (const result of response.results as any[]) {
            if (result.status === 'failure') {
              deliveryErrors.push(
                `Failed sending to target ${result.recipient} with error: ${result.error}`,
              )
            }

            // Deleting push targets when token has expired
            if (result.error === 'Expired device token') {
              const target = await dbForProject.findOne('targets', [
                Query.equal('identifier', [result.recipient]),
              ])

              if (!target.empty()) {
                await dbForProject.updateDocument(
                  'targets',
                  target.getId(),
                  target.set('expired', true),
                )
              }
            }
          }
        } catch (error: any) {
          deliveryErrors.push(
            `Failed sending to targets with error: ${error.message}`,
          )
        } finally {
          // const errorTotal = deliveryErrors.length;
          // Add stats usage metrics
          // queueForStatsUsage...

          return {
            deliveredTotal,
            deliveryErrors,
          }
        }
      })

      return Promise.all(batchPromises)
    })

    const results = (await Promise.all(providerPromises)).flat()

    let deliveredTotal = 0
    let deliveryErrors: string[] = []

    for (const result of results) {
      deliveredTotal += result.deliveredTotal
      deliveryErrors = [...deliveryErrors, ...result.deliveryErrors]
    }

    if (deliveryErrors.length === 0 && deliveredTotal === 0) {
      deliveryErrors.push('Unknown error')
    }

    message.set('deliveryErrors', deliveryErrors)

    if (message.get('deliveryErrors').length > 0) {
      message.set('status', MessageStatus.FAILED)
    } else {
      message.set('status', MessageStatus.SENT)
    }

    message.delete('to' as any) // Remove 'to' field as it is not needed anymore

    for (const provider of Object.values(providers)) {
      message.set(
        'search',
        `${message.get('search')} ${provider.get('name')} ${provider.get('provider')} ${provider.get('type')}`,
      )
    }

    message.set('deliveredTotal', deliveredTotal)
    message.set('deliveredAt', new Date().toISOString())

    await dbForProject.updateDocument('messages', message.getId(), message)
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
}

export enum MessagingJob {
  EXTERNAL = 'external',
}

export interface MessagingJobData {
  message: MessagesDoc
  project: ProjectsDoc
}
