/** Owns message validation, persistence, target lookup, and queue-backed delivery scheduling. */
import { Doc, ID, Query, type Session } from '@nuvix/db'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors'
import type { Messages, Targets } from '../../types/generated'
import { formatMessage, type MessageView } from '../formatter'

/** Optional delivery wiring for non-draft messages; omitted when persistence is tested without queues. */
export interface MessagingDeliveryDeps {
  /** Platform project id — carried in job payloads for tenant routing. */
  projectId: string
  enqueue: (
    data: {
      projectId: string
      message: string | Record<string, unknown>
      scheduleId?: string
    },
    opts?: { delay?: number },
  ) => Promise<string>
}

export interface BaseMessageInput {
  messageId?: string
  topics?: string[]
  users?: string[]
  targets?: string[]
  draft?: boolean
  scheduledAt?: string
}

export interface CreateEmailMessageInput extends BaseMessageInput {
  subject: string
  content: string
  cc?: string[]
  bcc?: string[]
  attachments?: string[]
  html?: boolean
}

export interface UpdateEmailMessageInput extends Partial<BaseMessageInput> {
  subject?: string
  content?: string
  cc?: string[]
  bcc?: string[]
  attachments?: string[]
  html?: boolean
}

export interface CreateSmsMessageInput extends BaseMessageInput {
  content: string
}

export interface UpdateSmsMessageInput extends Partial<BaseMessageInput> {
  content?: string
}

/** Validate a storage-backed push image reference and restrict it to PNG or JPEG files. */
async function validatePushImageRef(session: Session, image: string): Promise<void> {
  if (!image.includes(':')) return // absolute URL or external asset — not ours
  const [bucketId, fileId] = image.split(':') as [string, string]
  if (!bucketId || !fileId) return

  const bucket = await session.getDocument('buckets', bucketId)
  if (bucket.empty()) {
    throw new NotFoundError('Storage bucket not found', {
      code: 'storage_bucket_not_found',
    })
  }

  const file = await session.getDocument('files', fileId)
  if (file.empty() || file.get('bucketId') !== bucketId) {
    throw new NotFoundError('File not found', { code: 'storage_file_not_found' })
  }

  const allowedMimeTypes = ['image/png', 'image/jpeg']
  if (!allowedMimeTypes.includes(String(file.get('mimeType') ?? ''))) {
    throw new BadRequestError('Unsupported image type', {
      code: 'storage_file_type_unsupported',
    })
  }
}

/** Validate email attachment references and store bucket/file snapshots for delivery workers. */
async function validateAttachmentRefs(
  session: Session,
  attachments: string[],
): Promise<Array<{ bucketId: string; fileId: string }>> {
  const processed: Array<{ bucketId: string; fileId: string }> = []
  for (const attachment of attachments) {
    const [bucketId, fileId] = attachment.split(':') as [string, string]
    if (!bucketId || !fileId) {
      throw new BadRequestError('Invalid attachment reference', {
        code: 'messaging_invalid_attachment',
      })
    }

    const bucket = await session.getDocument('buckets', bucketId)
    if (bucket.empty()) {
      throw new NotFoundError('Storage bucket not found', {
        code: 'storage_bucket_not_found',
      })
    }

    const file = await session.getDocument('files', fileId)
    if (file.empty() || file.get('bucketId') !== bucketId) {
      throw new NotFoundError('File not found', {
        code: 'storage_file_not_found',
      })
    }

    processed.push({ bucketId, fileId })
  }
  return processed
}

export interface CreatePushMessageInput extends BaseMessageInput {
  title?: string
  body?: string
  data?: Record<string, unknown>
  action?: string
  image?: string
  icon?: string
  sound?: string
  color?: string
  tag?: string
  badge?: number
}

export interface UpdatePushMessageInput extends Partial<BaseMessageInput> {
  title?: string
  body?: string
  data?: Record<string, unknown>
  action?: string
  image?: string
  icon?: string
  sound?: string
  color?: string
  tag?: string
  badge?: number
}

/** Persists messaging records in one caller-scoped tenant session. */
export class MessagingService {
  constructor(
    private readonly session: Session,
    private readonly delivery?: MessagingDeliveryDeps,
  ) {}

  /**
   * Create an email message.
   */
  async createEmailMessage(input: CreateEmailMessageInput): Promise<MessageView> {
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
      scheduledAt,
    } = input

    const messageId =
      !inputMessageId || inputMessageId === 'unique()' ? ID.unique() : inputMessageId

    const existing = await this.session.getDocument('messages', messageId)
    if (!existing.empty()) {
      throw new ConflictError('Message already exists', {
        code: 'messaging_message_already_exists',
      })
    }

    const status = draft ? 'draft' : scheduledAt ? 'scheduled' : 'processing'

    if (status !== 'draft' && topics.length === 0 && users.length === 0 && targets.length === 0) {
      throw new BadRequestError('Message missing targets', {
        code: 'messaging_missing_target',
      })
    }

    if (status === 'scheduled' && !scheduledAt) {
      throw new BadRequestError('Message missing schedule', {
        code: 'messaging_missing_schedule',
      })
    }

    const processedAttachments = await validateAttachmentRefs(this.session, attachments)

    const doc = new Doc<Messages>({
      $id: messageId,
      providerType: 'email',
      topics,
      users,
      targets,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      data: {
        subject,
        content,
        html,
        cc,
        bcc,
        attachments: processedAttachments,
      },
      status,
      deliveredTotal: 0,
      search: [messageId, subject, 'email', status].join(' '),
    })

    const created = await this.session.createDocument('messages', doc)
    await this.enqueueDelivery(created, String(doc.get('status') ?? 'draft'))
    return formatMessage(created)
  }

  /**
   * Create an SMS message.
   */
  async createSmsMessage(input: CreateSmsMessageInput): Promise<MessageView> {
    const {
      messageId: inputMessageId,
      content,
      topics = [],
      users = [],
      targets = [],
      draft = false,
      scheduledAt,
    } = input

    const messageId =
      !inputMessageId || inputMessageId === 'unique()' ? ID.unique() : inputMessageId

    const existing = await this.session.getDocument('messages', messageId)
    if (!existing.empty()) {
      throw new ConflictError('Message already exists', {
        code: 'messaging_message_already_exists',
      })
    }

    const status = draft ? 'draft' : scheduledAt ? 'scheduled' : 'processing'

    if (status !== 'draft' && topics.length === 0 && users.length === 0 && targets.length === 0) {
      throw new BadRequestError('Message missing targets', {
        code: 'messaging_missing_target',
      })
    }

    if (status === 'scheduled' && !scheduledAt) {
      throw new BadRequestError('Message missing schedule', {
        code: 'messaging_missing_schedule',
      })
    }

    const doc = new Doc<Messages>({
      $id: messageId,
      providerType: 'sms',
      topics,
      users,
      targets,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      data: {
        content,
      },
      status,
      deliveredTotal: 0,
      search: [messageId, 'sms', status].join(' '),
    })

    const created = await this.session.createDocument('messages', doc)
    await this.enqueueDelivery(created, String(doc.get('status') ?? 'draft'))
    return formatMessage(created)
  }

  /**
   * Create a Push notification message.
   */
  async createPushMessage(input: CreatePushMessageInput): Promise<MessageView> {
    const {
      messageId: inputMessageId,
      title,
      body,
      data,
      action,
      image,
      icon,
      sound,
      color,
      tag,
      badge,
      topics = [],
      users = [],
      targets = [],
      draft = false,
      scheduledAt,
    } = input

    const messageId =
      !inputMessageId || inputMessageId === 'unique()' ? ID.unique() : inputMessageId

    const existing = await this.session.getDocument('messages', messageId)
    if (!existing.empty()) {
      throw new ConflictError('Message already exists', {
        code: 'messaging_message_already_exists',
      })
    }

    const status = draft ? 'draft' : scheduledAt ? 'scheduled' : 'processing'

    if (status !== 'draft' && topics.length === 0 && users.length === 0 && targets.length === 0) {
      throw new BadRequestError('Message missing targets', {
        code: 'messaging_missing_target',
      })
    }

    if (status === 'scheduled' && !scheduledAt) {
      throw new BadRequestError('Message missing schedule', {
        code: 'messaging_missing_schedule',
      })
    }

    if (image) {
      await validatePushImageRef(this.session, image)
    }

    const doc = new Doc<Messages>({
      $id: messageId,
      providerType: 'push',
      topics,
      users,
      targets,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      data: {
        title,
        body,
        data,
        action,
        image,
        icon,
        sound,
        color,
        tag,
        badge,
      },
      status,
      deliveredTotal: 0,
      search: [messageId, title ?? '', 'push', status].join(' '),
    })

    const created = await this.session.createDocument('messages', doc)
    await this.enqueueDelivery(created, String(doc.get('status') ?? 'draft'))
    return formatMessage(created)
  }

  /** Enqueue processing messages immediately and scheduled messages after their requested delay. */
  private async enqueueDelivery(created: Doc<Messages>, status: string): Promise<void> {
    if (!this.delivery || status === 'draft') return
    if (['processing', 'scheduled'].includes(status) === false) return

    if (status === 'scheduled') {
      const scheduledAt = created.get('scheduledAt')
      const when = scheduledAt ? new Date(scheduledAt as unknown as string) : null
      const delay = when ? Math.max(when.getTime() - Date.now(), 0) : 0
      await this.delivery.enqueue(
        {
          projectId: this.delivery.projectId,
          message: created.toObject() as unknown as Record<string, unknown>,
        },
        { delay },
      )
      return
    }

    await this.delivery.enqueue({
      projectId: this.delivery.projectId,
      message: created.toObject() as unknown as Record<string, unknown>,
    })
  }

  /**
   * List messages.
   */
  async listMessages(
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; messages: MessageView[] }> {
    const q = [...queries]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const docs = await this.session.find('messages', q)
    const total = await this.session.count('messages', filterQueries)

    return { total, messages: docs.map(formatMessage) }
  }

  /**
   * Get message by ID.
   */
  async getMessage(messageId: string): Promise<MessageView> {
    const doc = await this.session.getDocument('messages', messageId)
    if (doc.empty()) {
      throw new NotFoundError('Message not found', {
        code: 'messaging_message_not_found',
      })
    }
    return formatMessage(doc)
  }

  /**
   * List targets for a message.
   */
  async listTargets(
    messageId: string,
    queries: Query[] = [],
  ): Promise<{ total: number; targets: Targets[] }> {
    const message = await this.session.getDocument('messages', messageId)
    if (message.empty()) {
      throw new NotFoundError('Message not found', {
        code: 'messaging_message_not_found',
      })
    }

    const targetIds = (message.get('targets') as string[]) ?? []
    if (targetIds.length === 0) {
      return { total: 0, targets: [] }
    }

    const q = [...queries, Query.equal('$id', targetIds)]
    const filterQueries = Query.groupByType(q).filters

    const docs = await this.session.find('targets', q)
    const total = await this.session.count('targets', filterQueries)

    return {
      total,
      targets: docs.map((d) => d.toObject()),
    }
  }

  /**
   * Update an email message.
   */
  async updateEmailMessage(
    messageId: string,
    input: UpdateEmailMessageInput,
  ): Promise<MessageView> {
    const doc = await this.session.getDocument('messages', messageId)
    if (doc.empty()) {
      throw new NotFoundError('Message not found', {
        code: 'messaging_message_not_found',
      })
    }

    if (input.topics !== undefined) doc.set('topics', input.topics)
    if (input.users !== undefined) doc.set('users', input.users)
    if (input.targets !== undefined) doc.set('targets', input.targets)
    if (input.draft !== undefined) {
      doc.set('status', input.draft ? 'draft' : 'processing')
    }
    if (input.scheduledAt !== undefined) {
      doc.set('scheduledAt', input.scheduledAt ? new Date(input.scheduledAt) : undefined)
    }

    const currentData = (doc.get('data') as Record<string, unknown>) ?? {}
    if (input.subject !== undefined) currentData.subject = input.subject
    if (input.content !== undefined) currentData.content = input.content
    if (input.html !== undefined) currentData.html = input.html
    if (input.cc !== undefined) currentData.cc = input.cc
    if (input.bcc !== undefined) currentData.bcc = input.bcc
    if (input.attachments !== undefined) {
      currentData.attachments = await validateAttachmentRefs(this.session, input.attachments)
    }
    doc.set('data', currentData)

    const updated = await this.session.updateDocument('messages', messageId, doc)
    return formatMessage(updated)
  }

  /**
   * Update an SMS message.
   */
  async updateSmsMessage(messageId: string, input: UpdateSmsMessageInput): Promise<MessageView> {
    const doc = await this.session.getDocument('messages', messageId)
    if (doc.empty()) {
      throw new NotFoundError('Message not found', {
        code: 'messaging_message_not_found',
      })
    }

    if (input.topics !== undefined) doc.set('topics', input.topics)
    if (input.users !== undefined) doc.set('users', input.users)
    if (input.targets !== undefined) doc.set('targets', input.targets)
    if (input.draft !== undefined) {
      doc.set('status', input.draft ? 'draft' : 'processing')
    }
    if (input.scheduledAt !== undefined) {
      doc.set('scheduledAt', input.scheduledAt ? new Date(input.scheduledAt) : undefined)
    }

    const currentData = (doc.get('data') as Record<string, unknown>) ?? {}
    if (input.content !== undefined) currentData.content = input.content
    doc.set('data', currentData)

    const updated = await this.session.updateDocument('messages', messageId, doc)
    return formatMessage(updated)
  }

  /**
   * Update a Push notification message.
   */
  async updatePushMessage(messageId: string, input: UpdatePushMessageInput): Promise<MessageView> {
    const doc = await this.session.getDocument('messages', messageId)
    if (doc.empty()) {
      throw new NotFoundError('Message not found', {
        code: 'messaging_message_not_found',
      })
    }

    if (input.topics !== undefined) doc.set('topics', input.topics)
    if (input.users !== undefined) doc.set('users', input.users)
    if (input.targets !== undefined) doc.set('targets', input.targets)
    if (input.draft !== undefined) {
      doc.set('status', input.draft ? 'draft' : 'processing')
    }
    if (input.scheduledAt !== undefined) {
      doc.set('scheduledAt', input.scheduledAt ? new Date(input.scheduledAt) : undefined)
    }

    const currentData = (doc.get('data') as Record<string, unknown>) ?? {}
    if (input.title !== undefined) currentData.title = input.title
    if (input.body !== undefined) currentData.body = input.body
    if (input.data !== undefined) currentData.data = input.data
    if (input.action !== undefined) currentData.action = input.action
    if (input.image !== undefined) {
      if (input.image) await validatePushImageRef(this.session, input.image)
      currentData.image = input.image
    }
    if (input.icon !== undefined) currentData.icon = input.icon
    if (input.sound !== undefined) currentData.sound = input.sound
    if (input.color !== undefined) currentData.color = input.color
    if (input.tag !== undefined) currentData.tag = input.tag
    if (input.badge !== undefined) currentData.badge = input.badge
    doc.set('data', currentData)

    const updated = await this.session.updateDocument('messages', messageId, doc)
    return formatMessage(updated)
  }

  /**
   * Delete a message.
   */
  async deleteMessage(messageId: string): Promise<void> {
    const doc = await this.session.getDocument('messages', messageId)
    if (doc.empty()) {
      throw new NotFoundError('Message not found', {
        code: 'messaging_message_not_found',
      })
    }
    await this.session.deleteDocument('messages', messageId)
  }
}
