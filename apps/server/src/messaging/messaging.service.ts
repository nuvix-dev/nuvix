import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService, CoreService } from '@nuvix/core'
import { Exception } from '@nuvix/core/extend/exception'
import { MessagingJob, MessagingJobData } from '@nuvix/core/resolvers'
import { Database, Doc, ID, Query } from '@nuvix/db'
import {
  MessageStatus,
  MessageType,
  QueueFor,
  ScheduleResourceType,
  Schemas,
} from '@nuvix/utils'
import type { Messages, Schedules } from '@nuvix/utils/types'
import { Queue } from 'bullmq'
import type {
  CreateEmailMessage,
  CreatePushMessage,
  CreateSmsMessage,
  ListMessages,
  ListTargets,
  UpdateEmailMessage,
  UpdatePushMessage,
  UpdateSmsMessage,
} from './messaging.types'

@Injectable()
export class MessagingService {
  private readonly dbForPlatform: Database

  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
    private readonly jwtService: JwtService,
    @InjectQueue(QueueFor.MESSAGING)
    private readonly queue: Queue<MessagingJobData, any, MessagingJob>,
  ) {
    this.dbForPlatform = this.coreService.getPlatformDb()
  }

  /**
   * Create Email Message
   */
  async createEmailMessage({ input, project }: CreateEmailMessage) {
    const {
      messageId: inputMessageId,
      subject,
      content,
      topics = [],
      users = [],
      targets = [],
      cc = [],
      bcc = [],
      attachments = [],
      draft = false,
      html = false,
      scheduledAt = null,
    } = input

    const messageId =
      inputMessageId === 'unique()' ? ID.unique() : inputMessageId

    const status = draft
      ? MessageStatus.DRAFT
      : scheduledAt
        ? MessageStatus.SCHEDULED
        : MessageStatus.PROCESSING

    if (
      status !== MessageStatus.DRAFT &&
      topics.length === 0 &&
      users.length === 0 &&
      targets.length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET)
    }

    if (status === MessageStatus.SCHEDULED && !scheduledAt) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE)
    }

    const mergedTargets = [...targets, ...cc, ...bcc]

    if (mergedTargets.length > 0) {
      const foundTargets = await db.withSchema(Schemas.Auth, () =>
        db.find('targets', qb =>
          qb
            .equal('$id', ...mergedTargets)
            .equal('providerType', MessageType.EMAIL)
            .limit(mergedTargets.length),
        ),
      )

      if (foundTargets.length !== mergedTargets.length) {
        throw new Exception(Exception.MESSAGE_TARGET_NOT_EMAIL)
      }

      for (const target of foundTargets) {
        if (target.empty()) {
          throw new Exception(Exception.USER_TARGET_NOT_FOUND)
        }
      }
    }

    const processedAttachments = []
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        const [bucketId, fileId] = attachment.split(':') as [string, string]

        const bucket = await db.getDocument('buckets', bucketId)
        if (bucket.empty()) {
          throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND)
        }

        const file = await db.getDocument(
          `bucket_${bucket.getSequence()}`,
          fileId,
        )
        if (file.empty()) {
          throw new Exception(Exception.STORAGE_FILE_NOT_FOUND)
        }

        processedAttachments.push({
          bucketId,
          fileId,
        })
      }
    }

    const message = new Doc<Messages>({
      $id: messageId,
      providerType: MessageType.EMAIL,
      topics,
      users,
      targets,
      scheduledAt,
      data: {
        subject,
        content,
        html,
        cc,
        bcc,
        attachments: processedAttachments,
      },
      status,
    })

    const createdMessage = await db.createDocument('messages', message)

    switch (status) {
      case MessageStatus.PROCESSING:
        await this.queue.add(MessagingJob.EXTERNAL, {
          project,
          message: createdMessage,
        })
        break
      case MessageStatus.SCHEDULED: {
        const schedule = new Doc<Schedules>({
          region: project.get('region'),
          resourceType: ScheduleResourceType.MESSAGE,
          resourceId: createdMessage.getId(),
          resourceInternalId: createdMessage.getSequence(),
          resourceUpdatedAt: new Date().toISOString(),
          projectId: project.getId(),
          schedule: scheduledAt,
          active: true,
        })

        const createdSchedule = await this.dbForPlatform.createDocument(
          'schedules',
          schedule,
        )
        createdMessage.set('scheduleId', createdSchedule.getId())
        await db.updateDocument(
          'messages',
          createdMessage.getId(),
          createdMessage,
        )
        break
      }
    }

    return createdMessage
  }

  /**
   * Create SMS Message
   */
  async createSmsMessage({ input, project }: CreateSmsMessage) {
    const {
      messageId: inputMessageId,
      content,
      topics = [],
      users = [],
      targets = [],
      draft = false,
      scheduledAt = null,
    } = input

    const messageId =
      inputMessageId === 'unique()' ? ID.unique() : inputMessageId

    const status = draft
      ? MessageStatus.DRAFT
      : scheduledAt
        ? MessageStatus.SCHEDULED
        : MessageStatus.PROCESSING

    if (
      status !== MessageStatus.DRAFT &&
      topics.length === 0 &&
      users.length === 0 &&
      targets.length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET)
    }

    if (status === MessageStatus.SCHEDULED && !scheduledAt) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE)
    }

    if (targets.length > 0) {
      const foundTargets = await db.withSchema(Schemas.Auth, () =>
        db.find('targets', qb =>
          qb
            .equal('$id', ...targets)
            .equal('providerType', MessageType.SMS)
            .limit(targets.length),
        ),
      )

      if (foundTargets.length !== targets.length) {
        throw new Exception(Exception.MESSAGE_TARGET_NOT_SMS)
      }

      for (const target of foundTargets) {
        if (target.empty()) {
          throw new Exception(Exception.USER_TARGET_NOT_FOUND)
        }
      }
    }

    const message = new Doc<Messages>({
      $id: messageId,
      providerType: MessageType.SMS,
      topics,
      users,
      targets,
      scheduledAt,
      data: {
        content,
      },
      status,
    })

    const createdMessage = await db.createDocument('messages', message)

    switch (status) {
      case MessageStatus.PROCESSING:
        await this.queue.add(MessagingJob.EXTERNAL, {
          project,
          message: createdMessage,
        })
        break
      case MessageStatus.SCHEDULED: {
        const schedule = new Doc<Schedules>({
          region: project.get('region'),
          resourceType: ScheduleResourceType.MESSAGE,
          resourceId: createdMessage.getId(),
          resourceInternalId: createdMessage.getSequence(),
          resourceUpdatedAt: new Date().toISOString(),
          projectId: project.getId(),
          schedule: scheduledAt,
          active: true,
        })

        const createdSchedule = await this.dbForPlatform.createDocument(
          'schedules',
          schedule,
        )
        createdMessage.set('scheduleId', createdSchedule.getId())
        await db.updateDocument(
          'messages',
          createdMessage.getId(),
          createdMessage,
        )
        break
      }
    }

    return createdMessage
  }

  /**
   * Create Push Message
   */
  async createPushMessage({ input, project }: CreatePushMessage) {
    const {
      messageId: inputMessageId,
      title = '',
      body = '',
      topics = [],
      users = [],
      targets = [],
      data = null,
      action = '',
      image = '',
      icon = '',
      sound = '',
      color = '',
      tag = '',
      badge = -1,
      draft = false,
      scheduledAt = null,
      contentAvailable = false,
      critical = false,
      priority = 'high',
    } = input

    const messageId =
      inputMessageId === 'unique()' ? ID.unique() : inputMessageId

    const status = draft
      ? MessageStatus.DRAFT
      : scheduledAt
        ? MessageStatus.SCHEDULED
        : MessageStatus.PROCESSING

    if (
      status !== MessageStatus.DRAFT &&
      topics.length === 0 &&
      users.length === 0 &&
      targets.length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET)
    }

    if (status === MessageStatus.SCHEDULED && !scheduledAt) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE)
    }

    if (targets.length > 0) {
      const foundTargets = await db.withSchema(Schemas.Auth, () =>
        db.find('targets', qb =>
          qb
            .equal('$id', ...targets)
            .equal('providerType', MessageType.PUSH)
            .limit(targets.length),
        ),
      )

      if (foundTargets.length !== targets.length) {
        throw new Exception(Exception.MESSAGE_TARGET_NOT_PUSH)
      }

      for (const target of foundTargets) {
        if (target.empty()) {
          throw new Exception(Exception.USER_TARGET_NOT_FOUND)
        }
      }
    }

    let processedImage: any = null
    if (image) {
      const [bucketId, fileId] = image.split(':') as [string, string]

      const bucket = await db.getDocument('buckets', bucketId)
      if (bucket.empty()) {
        throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND)
      }

      const file = await db.getDocument(
        `bucket_${bucket.getSequence()}`,
        fileId,
      )
      if (file.empty()) {
        throw new Exception(Exception.STORAGE_FILE_NOT_FOUND)
      }

      const allowedMimeTypes = ['image/png', 'image/jpeg']
      if (!allowedMimeTypes.includes(file.get('mimeType'))) {
        throw new Exception(Exception.STORAGE_FILE_TYPE_UNSUPPORTED)
      }

      const host = this.appConfig.get('app').domain || 'localhost'
      const protocol = this.appConfig.get('app').forceHttps ? 'https' : 'http'
      const scheduleTime = scheduledAt

      // Set expiry to 15 days from now
      let expiry: number
      if (scheduleTime) {
        const expiryDate = new Date(scheduleTime)
        expiryDate.setDate(expiryDate.getDate() + 15)
        expiry = Math.floor(expiryDate.getTime() / 1000)
      } else {
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + 15)
        expiry = Math.floor(expiryDate.getTime() / 1000)
      }

      const jwt = this.jwtService.sign(
        {
          bucketId: bucket.getId(),
          fileId: file.getId(),
          projectId: project.getId(),
        },
        {
          expiresIn: expiry,
          algorithm: 'HS256',
        },
      )

      processedImage = {
        bucketId: bucket.getId(),
        fileId: file.getId(),
        url: `${protocol}://${host}/v1/storage/buckets/${bucket.getId()}/files/${file.getId()}/push?project=${project.getId()}&jwt=${jwt}`,
      }
    }

    const pushData: Record<string, any> = {}

    if (title) {
      pushData.title = title
    }
    if (body) {
      pushData.body = body
    }
    if (data) {
      pushData.data = data
    }
    if (action) {
      pushData.action = action
    }
    if (processedImage) {
      pushData.image = processedImage
    }
    if (icon) {
      pushData.icon = icon
    }
    if (sound) {
      pushData.sound = sound
    }
    if (color) {
      pushData.color = color
    }
    if (tag) {
      pushData.tag = tag
    }
    if (badge >= 0) {
      pushData.badge = badge
    }
    if (contentAvailable) {
      pushData.contentAvailable = true
    }
    if (critical) {
      pushData.critical = true
    }
    if (priority) {
      pushData.priority = priority
    }

    const message = new Doc<Messages>({
      $id: messageId,
      providerType: MessageType.PUSH,
      topics,
      users,
      targets,
      scheduledAt,
      data: pushData,
      status,
    })

    const createdMessage = await db.createDocument('messages', message)

    switch (status) {
      case MessageStatus.PROCESSING:
        await this.queue.add(MessagingJob.EXTERNAL, {
          project,
          message: createdMessage,
        })
        break
      case MessageStatus.SCHEDULED: {
        const schedule = new Doc({
          region: project.get('region'),
          resourceType: ScheduleResourceType.MESSAGE,
          resourceId: createdMessage.getId(),
          resourceInternalId: createdMessage.getSequence(),
          resourceUpdatedAt: new Date().toISOString(),
          projectId: project.getId(),
          schedule: scheduledAt,
          active: true,
        })

        const createdSchedule = await this.dbForPlatform.createDocument(
          'schedules',
          schedule,
        )
        createdMessage.set('scheduleId', createdSchedule.getId())
        await db.updateDocument(
          'messages',
          createdMessage.getId(),
          createdMessage,
        )
        break
      }
    }

    return createdMessage
  }

  /**
   * Lists all messages.
   */
  async listMessages({ queries = [], search }: ListMessages) {
    if (search) {
      queries.push(Query.search('search', search))
    }

    const { filters } = Query.groupByType(queries)

    const messages = await db.find('messages', queries)
    const total = await db.count('messages', filters)

    return {
      data: messages,
      total,
    }
  }

  /**
   * Get Message
   */
  async getMessage(id: string) {
    const message = await db.getDocument('messages', id)

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND)
    }

    return message
  }

  /**
   *  List targets for a message.
   */
  async listTargets({ messageId, queries = [] }: ListTargets) {
    const message = await db.getDocument('messages', messageId)

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND)
    }

    const targetIDs = message.get('targets')
    if (!targetIDs || targetIDs.length === 0) {
      return {
        data: [],
        total: 0,
      }
    }

    const { filters } = Query.groupByType(queries)

    queries.push(Query.equal('$id', targetIDs))
    const { targets, total } = await db.withSchema(Schemas.Auth, async () => {
      const targets = await db.find('targets', queries)
      const total = await db.count('targets', filters)
      return { targets, total }
    })

    return {
      data: targets,
      total,
    }
  }

  /**
   * Update Email Message
   */
  async updateEmailMessage({
    messageId,
    input,

    project,
  }: UpdateEmailMessage) {
    const message = await db.getDocument('messages', messageId)

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND)
    }

    let status: string
    if (input.draft !== undefined || input.scheduledAt !== undefined) {
      if (input.draft) {
        status = MessageStatus.DRAFT
      } else {
        status = input.scheduledAt
          ? MessageStatus.SCHEDULED
          : MessageStatus.PROCESSING
      }
    } else {
      status = message.get('status')
    }

    if (
      status !== MessageStatus.DRAFT &&
      (input.topics ?? message.get('topics', [])).length === 0 &&
      (input.users ?? message.get('users', [])).length === 0 &&
      (input.targets ?? message.get('targets', [])).length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET)
    }

    const currentScheduledAt = message.get('scheduledAt')

    switch (message.get('status')) {
      case MessageStatus.PROCESSING:
        throw new Exception(Exception.MESSAGE_ALREADY_PROCESSING)
      case MessageStatus.SENT:
        throw new Exception(Exception.MESSAGE_ALREADY_SENT)
      case MessageStatus.FAILED:
        throw new Exception(Exception.MESSAGE_ALREADY_FAILED)
    }

    if (
      status === MessageStatus.SCHEDULED &&
      !input.scheduledAt &&
      !currentScheduledAt
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE)
    }

    if (
      currentScheduledAt &&
      new Date(currentScheduledAt as string) < new Date()
    ) {
      throw new Exception(Exception.MESSAGE_ALREADY_SCHEDULED)
    }

    if (!currentScheduledAt && input.scheduledAt) {
      const schedule = new Doc<Schedules>({
        region: project.get('region'),
        resourceType: 'message',
        resourceId: message.getId(),
        resourceInternalId: message.getSequence(),
        resourceUpdatedAt: new Date().toISOString(),
        projectId: project.getId(),
        schedule: input.scheduledAt,
        active: status === MessageStatus.SCHEDULED,
      })

      const createdSchedule = await this.dbForPlatform.createDocument(
        'schedules',
        schedule,
      )
      message.set('scheduleId', createdSchedule.getId())
    }

    if (currentScheduledAt) {
      const schedule = await this.dbForPlatform.getDocument(
        'schedules',
        message.get('scheduleId'),
      )
      const scheduledStatus = status === MessageStatus.SCHEDULED

      if (schedule.empty()) {
        throw new Exception(Exception.SCHEDULE_NOT_FOUND)
      }

      schedule
        .set('resourceUpdatedAt', new Date().toISOString())
        .set('active', scheduledStatus)

      if (input.scheduledAt) {
        schedule.set('schedule', input.scheduledAt)
      }

      await this.dbForPlatform.updateDocument(
        'schedules',
        schedule.getId(),
        schedule,
      )
    }

    if (input.scheduledAt) {
      message.set('scheduledAt', input.scheduledAt)
    }

    if (input.topics !== undefined) {
      message.set('topics', input.topics)
    }

    if (input.users !== undefined) {
      message.set('users', input.users)
    }

    if (input.targets !== undefined) {
      message.set('targets', input.targets)
    }

    const data = message.get('data')

    if (input.subject !== undefined) {
      data.subject = input.subject
    }

    if (input.content !== undefined) {
      data.content = input.content
    }

    if (input.attachments !== undefined) {
      const processedAttachments = []
      for (const attachment of input.attachments) {
        const [bucketId, fileId] = attachment.split(':') as [string, string]

        const bucket = await db.getDocument('buckets', bucketId)
        if (bucket.empty()) {
          throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND)
        }

        const file = await db.getDocument(
          `bucket_${bucket.getSequence()}`,
          fileId,
        )
        if (file.empty()) {
          throw new Exception(Exception.STORAGE_FILE_NOT_FOUND)
        }

        processedAttachments.push({
          bucketId,
          fileId,
        })
      }
      data.attachments = processedAttachments
    }

    if (input.html !== undefined) {
      data.html = input.html
    }

    if (input.cc !== undefined) {
      data.cc = input.cc
    }

    if (input.bcc !== undefined) {
      data.bcc = input.bcc
    }

    message.set('data', data)
    if (status) {
      message.set('status', status)
    }

    const updatedMessage = await db.updateDocument(
      'messages',
      message.getId(),
      message,
    )

    if (status === MessageStatus.PROCESSING) {
      await this.queue.add(MessagingJob.EXTERNAL, {
        project,
        message: updatedMessage,
      })
    }

    return updatedMessage
  }

  /**
   * Update SMS Message
   */
  async updateSmsMessage({ messageId, input, project }: UpdateSmsMessage) {
    const message = await db.getDocument('messages', messageId)

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND)
    }

    let status: string
    if (input.draft !== undefined || input.scheduledAt !== undefined) {
      if (input.draft) {
        status = MessageStatus.DRAFT
      } else {
        status = input.scheduledAt
          ? MessageStatus.SCHEDULED
          : MessageStatus.PROCESSING
      }
    } else {
      status = message.get('status')
    }

    if (
      status !== MessageStatus.DRAFT &&
      (input.topics ?? message.get('topics', [])).length === 0 &&
      (input.users ?? message.get('users', [])).length === 0 &&
      (input.targets ?? message.get('targets', [])).length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET)
    }

    const currentScheduledAt = message.get('scheduledAt')

    switch (message.get('status')) {
      case MessageStatus.PROCESSING:
        throw new Exception(Exception.MESSAGE_ALREADY_PROCESSING)
      case MessageStatus.SENT:
        throw new Exception(Exception.MESSAGE_ALREADY_SENT)
      case MessageStatus.FAILED:
        throw new Exception(Exception.MESSAGE_ALREADY_FAILED)
    }

    if (
      status === MessageStatus.SCHEDULED &&
      !input.scheduledAt &&
      !currentScheduledAt
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE)
    }

    if (
      currentScheduledAt &&
      new Date(currentScheduledAt as string) < new Date()
    ) {
      throw new Exception(Exception.MESSAGE_ALREADY_SCHEDULED)
    }

    if (!currentScheduledAt && input.scheduledAt) {
      const schedule = new Doc<Schedules>({
        region: project.get('region'),
        resourceType: 'message',
        resourceId: message.getId(),
        resourceInternalId: message.getSequence(),
        resourceUpdatedAt: new Date().toISOString(),
        projectId: project.getId(),
        schedule: input.scheduledAt,
        active: status === MessageStatus.SCHEDULED,
      })

      const createdSchedule = await this.dbForPlatform.createDocument(
        'schedules',
        schedule,
      )
      message.set('scheduleId', createdSchedule.getId())
    }

    if (currentScheduledAt) {
      const schedule = await this.dbForPlatform.getDocument(
        'schedules',
        message.get('scheduleId'),
      )
      const scheduledStatus = status === MessageStatus.SCHEDULED

      if (schedule.empty()) {
        throw new Exception(Exception.SCHEDULE_NOT_FOUND)
      }

      schedule
        .set('resourceUpdatedAt', new Date().toISOString())
        .set('active', scheduledStatus)

      if (input.scheduledAt) {
        schedule.set('schedule', input.scheduledAt)
      }

      await this.dbForPlatform.updateDocument(
        'schedules',
        schedule.getId(),
        schedule,
      )
    }

    if (input.scheduledAt) {
      message.set('scheduledAt', input.scheduledAt)
    }

    if (input.topics !== undefined) {
      message.set('topics', input.topics)
    }

    if (input.users !== undefined) {
      message.set('users', input.users)
    }

    if (input.targets !== undefined) {
      message.set('targets', input.targets)
    }

    const data = message.get('data')

    if (input.content !== undefined) {
      data.content = input.content
    }

    message.set('data', data)

    if (status) {
      message.set('status', status)
    }

    const updatedMessage = await db.updateDocument(
      'messages',
      message.getId(),
      message,
    )

    if (status === MessageStatus.PROCESSING) {
      await this.queue.add(MessagingJob.EXTERNAL, {
        project,
        message: updatedMessage,
      })
    }

    return updatedMessage
  }

  /**
   * Update Push Message
   */
  async updatePushMessage({
    messageId,
    input,

    project,
  }: UpdatePushMessage) {
    const message = await db.getDocument('messages', messageId)

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND)
    }

    let status: string
    if (input.draft !== undefined || input.scheduledAt !== undefined) {
      if (input.draft) {
        status = MessageStatus.DRAFT
      } else {
        status = input.scheduledAt
          ? MessageStatus.SCHEDULED
          : MessageStatus.PROCESSING
      }
    } else {
      status = message.get('status')
    }

    if (
      status !== MessageStatus.DRAFT &&
      (input.topics ?? message.get('topics', [])).length === 0 &&
      (input.users ?? message.get('users', [])).length === 0 &&
      (input.targets ?? message.get('targets', [])).length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET)
    }

    const currentScheduledAt = message.get('scheduledAt')

    switch (message.get('status')) {
      case MessageStatus.PROCESSING:
        throw new Exception(Exception.MESSAGE_ALREADY_PROCESSING)
      case MessageStatus.SENT:
        throw new Exception(Exception.MESSAGE_ALREADY_SENT)
      case MessageStatus.FAILED:
        throw new Exception(Exception.MESSAGE_ALREADY_FAILED)
    }

    if (
      status === MessageStatus.SCHEDULED &&
      !input.scheduledAt &&
      !currentScheduledAt
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE)
    }

    if (
      currentScheduledAt &&
      new Date(currentScheduledAt as string) < new Date()
    ) {
      throw new Exception(Exception.MESSAGE_ALREADY_SCHEDULED)
    }

    if (!currentScheduledAt && input.scheduledAt) {
      const schedule = new Doc<Schedules>({
        region: project.get('region'),
        resourceType: 'message',
        resourceId: message.getId(),
        resourceInternalId: message.getSequence(),
        resourceUpdatedAt: new Date().toISOString(),
        projectId: project.getId(),
        schedule: input.scheduledAt,
        active: status === MessageStatus.SCHEDULED,
      })

      const createdSchedule = await this.dbForPlatform.createDocument(
        'schedules',
        schedule,
      )
      message.set('scheduleId', createdSchedule.getId())
    }

    // Handle schedule updates
    if (currentScheduledAt) {
      const schedule = await this.dbForPlatform.getDocument(
        'schedules',
        message.get('scheduleId'),
      )
      const scheduledStatus = status === MessageStatus.SCHEDULED

      if (schedule.empty()) {
        throw new Exception(Exception.SCHEDULE_NOT_FOUND)
      }

      schedule
        .set('resourceUpdatedAt', new Date().toISOString())
        .set('active', scheduledStatus)

      if (input.scheduledAt) {
        schedule.set('schedule', input.scheduledAt)
      }

      await this.dbForPlatform.updateDocument(
        'schedules',
        schedule.getId(),
        schedule,
      )
    }

    if (input.scheduledAt) {
      message.set('scheduledAt', input.scheduledAt)
    }

    if (input.topics !== undefined) {
      message.set('topics', input.topics)
    }

    if (input.users !== undefined) {
      message.set('users', input.users)
    }

    if (input.targets !== undefined) {
      message.set('targets', input.targets)
    }

    const pushData = message.get('data')
    if (input.title !== undefined) {
      pushData.title = input.title
    }

    if (input.body !== undefined) {
      pushData.body = input.body
    }

    if (input.data !== undefined) {
      pushData.data = input.data
    }

    if (input.action !== undefined) {
      pushData.action = input.action
    }

    if (input.icon !== undefined) {
      pushData.icon = input.icon
    }

    if (input.sound !== undefined) {
      pushData.sound = input.sound
    }

    if (input.color !== undefined) {
      pushData.color = input.color
    }

    if (input.tag !== undefined) {
      pushData.tag = input.tag
    }

    if (input.badge !== undefined) {
      pushData.badge = input.badge
    }

    if (input.contentAvailable !== undefined) {
      pushData.contentAvailable = input.contentAvailable
    }

    if (input.critical !== undefined) {
      pushData.critical = input.critical
    }

    if (input.priority !== undefined) {
      pushData.priority = input.priority
    }

    if (input.image !== undefined) {
      const [bucketId, fileId] = input.image.split(':') as [string, string]

      const bucket = await db.getDocument('buckets', bucketId)
      if (bucket.empty()) {
        throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND)
      }

      const file = await db.getDocument(
        `bucket_${bucket.getSequence()}`,
        fileId,
      )
      if (file.empty()) {
        throw new Exception(Exception.STORAGE_FILE_NOT_FOUND)
      }

      const allowedMimeTypes = ['image/png', 'image/jpeg']
      if (!allowedMimeTypes.includes(file.get('mimeType'))) {
        throw new Exception(Exception.STORAGE_FILE_TYPE_UNSUPPORTED)
      }

      const host = this.appConfig.get('app').domain || 'localhost'
      const protocol = this.appConfig.get('app').forceHttps ? 'https' : 'http'

      const scheduleTime = currentScheduledAt || input.scheduledAt
      let expiry: number
      if (scheduleTime) {
        const expiryDate = new Date(scheduleTime as string)
        expiryDate.setDate(expiryDate.getDate() + 15)
        expiry = Math.floor(expiryDate.getTime() / 1000)
      } else {
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + 15)
        expiry = Math.floor(expiryDate.getTime() / 1000)
      }

      const jwt = this.jwtService.sign(
        {
          bucketId: bucket.getId(),
          fileId: file.getId(),
          projectId: project.getId(),
        },
        {
          expiresIn: expiry,
          algorithm: 'HS256',
        },
      )

      pushData.image = {
        bucketId: bucket.getId(),
        fileId: file.getId(),
        url: `${protocol}://${host}/v1/storage/buckets/${bucket.getId()}/files/${file.getId()}/push?project=${project.getId()}&jwt=${jwt}`,
      }
    }

    message.set('data', pushData)

    if (status) {
      message.set('status', status)
    }

    const updatedMessage = await db.updateDocument(
      'messages',
      message.getId(),
      message,
    )

    if (status === MessageStatus.PROCESSING) {
      await this.queue.add(MessagingJob.EXTERNAL, {
        project,
        message: updatedMessage,
      })
    }

    return updatedMessage
  }

  /**
   * Deletes a message.
   */
  async deleteMessage(messageId: string) {
    const message = await db.getDocument('messages', messageId)

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND)
    }

    switch (message.get('status')) {
      case MessageStatus.PROCESSING:
        throw new Exception(Exception.MESSAGE_ALREADY_PROCESSING)
      case MessageStatus.SCHEDULED: {
        const scheduleId = message.get('scheduleId')
        const scheduledAt = message.get('scheduledAt')
        const now = new Date()
        const scheduledDate = new Date(scheduledAt as string)
        if (now > scheduledDate) {
          throw new Exception(Exception.MESSAGE_ALREADY_SCHEDULED)
        }

        if (scheduleId) {
          try {
            await this.dbForPlatform.deleteDocument('schedules', scheduleId)
          } catch {
            // Ignore
          }
        }
        break
      }
      default:
        break
    }

    await db.deleteDocument('messages', message.getId())
  }
}
