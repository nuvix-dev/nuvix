import { ID } from '@nuvix/core'
import { Doc, Query, type Session } from '@nuvix/db'
import { BadRequestError, NotFoundError } from '../../shared/errors'
import type { Messages } from '../../types/generated'
import { formatMessage } from './formatter'
import type {
  CreateEmailMessageInput,
  CreatePushMessageInput,
  CreateSmsMessageInput,
  MessageView,
  UpdateEmailMessageInput,
  UpdatePushMessageInput,
  UpdateSmsMessageInput,
} from './types'

const MESSAGE_SENT_STATUSES = new Set(['delivered', 'failed', 'processing'])

export class MessagesService {
  constructor(private readonly session: Session) {}

  async listMessages(opts: { limit?: number; offset?: number }): Promise<{
    messages: MessageView[]
    total: number
  }> {
    const limit = opts.limit ?? 25
    const offset = opts.offset ?? 0
    const docs = await this.session.find('messages', [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc('$createdAt'),
    ])
    const total = await this.session.count('messages', [])
    return { messages: docs.map(formatMessage), total }
  }

  async getMessage(messageId: string): Promise<MessageView> {
    const doc = await this.session.getDocument('messages', messageId).catch(() => null)
    if (!doc || doc.empty()) {
      throw new NotFoundError('Message not found', { code: 'message_not_found' })
    }
    return formatMessage(doc)
  }

  async deleteMessage(messageId: string): Promise<void> {
    const doc = await this.session.getDocument('messages', messageId).catch(() => null)
    if (!doc || doc.empty()) {
      throw new NotFoundError('Message not found', { code: 'message_not_found' })
    }
    await this.session.deleteDocument('messages', messageId)
  }

  // ---- Validation helpers ----

  private validateTargets(
    topics: string[],
    users: string[],
    targets: string[],
    draft: boolean,
  ): void {
    if (!draft && topics.length === 0 && users.length === 0 && targets.length === 0) {
      throw new BadRequestError(
        'Message requires at least one topic, user, or target when not a draft',
        { code: 'message_missing_target' },
      )
    }
  }

  private validateSchedule(
    draft: boolean,
    scheduledAt?: string,
  ): 'draft' | 'scheduled' | 'processing' {
    if (draft) return 'draft'
    if (scheduledAt) {
      const scheduled = new Date(scheduledAt)
      if (Number.isNaN(scheduled.getTime())) {
        throw new BadRequestError('scheduledAt must be a valid ISO timestamp', {
          code: 'message_missing_schedule',
        })
      }
      return 'scheduled'
    }
    return 'processing'
  }

  private assertMutable(doc: Doc<Messages>): void {
    const status = String(doc.get('status'))
    if (MESSAGE_SENT_STATUSES.has(status)) {
      throw new BadRequestError('Message has already been dispatched and cannot be modified', {
        code: 'message_already_sent',
      })
    }
  }

  // ---- Create ----

  async createEmail(input: CreateEmailMessageInput): Promise<MessageView> {
    const messageId =
      input.messageId && input.messageId !== 'unique()' ? input.messageId : ID.unique()
    const topics = input.topics ?? []
    const users = input.users ?? []
    const targets = input.targets ?? []
    const draft = input.draft ?? false
    this.validateTargets(topics, users, targets, draft)
    const status = this.validateSchedule(draft, input.scheduledAt)

    const doc = new Doc<Messages>({
      $id: messageId,
      providerType: 'email',
      status,
      data: {
        subject: input.subject,
        content: input.content,
        html: input.html ?? false,
        cc: input.cc ?? [],
        bcc: input.bcc ?? [],
        attachments: input.attachments ?? [],
      },
      topics,
      users,
      targets,
      scheduledAt: input.scheduledAt,
    })

    const created = await this.session.createDocument('messages', doc)
    return formatMessage(created)
  }

  async createSms(input: CreateSmsMessageInput): Promise<MessageView> {
    const messageId =
      input.messageId && input.messageId !== 'unique()' ? input.messageId : ID.unique()
    const topics = input.topics ?? []
    const users = input.users ?? []
    const targets = input.targets ?? []
    const draft = input.draft ?? false
    this.validateTargets(topics, users, targets, draft)
    const status = this.validateSchedule(draft, input.scheduledAt)

    const doc = new Doc<Messages>({
      $id: messageId,
      providerType: 'sms',
      status,
      data: { content: input.content },
      topics,
      users,
      targets,
      scheduledAt: input.scheduledAt,
    })

    const created = await this.session.createDocument('messages', doc)
    return formatMessage(created)
  }

  async createPush(input: CreatePushMessageInput): Promise<MessageView> {
    const messageId =
      input.messageId && input.messageId !== 'unique()' ? input.messageId : ID.unique()
    const topics = input.topics ?? []
    const users = input.users ?? []
    const targets = input.targets ?? []
    const draft = input.draft ?? false
    this.validateTargets(topics, users, targets, draft)
    const status = this.validateSchedule(draft, input.scheduledAt)

    const doc = new Doc<Messages>({
      $id: messageId,
      providerType: 'push',
      status,
      data: {
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        action: input.action,
        icon: input.icon,
        badge: input.badge,
        tag: input.tag,
        color: input.color,
        sound: input.sound,
        critical: input.critical ?? false,
      },
      topics,
      users,
      targets,
      scheduledAt: input.scheduledAt,
    })

    const created = await this.session.createDocument('messages', doc)
    return formatMessage(created)
  }

  // ---- Update (draft/scheduled only) ----

  async updateEmail(messageId: string, input: UpdateEmailMessageInput): Promise<MessageView> {
    const doc = await this.session.getDocument('messages', messageId).catch(() => null)
    if (!doc || doc.empty())
      throw new NotFoundError('Message not found', { code: 'message_not_found' })
    this.assertMutable(doc)

    const data = (doc.get('data') as Record<string, unknown>) ?? {}
    if (input.subject !== undefined) data.subject = input.subject
    if (input.content !== undefined) data.content = input.content
    if (input.html !== undefined) data.html = input.html
    if (input.cc !== undefined) data.cc = input.cc
    if (input.bcc !== undefined) data.bcc = input.bcc
    if (input.attachments !== undefined) data.attachments = input.attachments
    doc.set('data', data)

    if (input.topics !== undefined) doc.set('topics', input.topics)
    if (input.users !== undefined) doc.set('users', input.users)
    if (input.targets !== undefined) doc.set('targets', input.targets)
    if (input.draft !== undefined) {
      const status = this.validateSchedule(
        input.draft,
        input.scheduledAt ?? (doc.get('scheduledAt') as string | undefined),
      )
      doc.set('status', status)
    }
    if (input.scheduledAt !== undefined) doc.set('scheduledAt', input.scheduledAt)

    const updated = await this.session.updateDocument('messages', messageId, doc)
    return formatMessage(updated)
  }

  async updateSms(messageId: string, input: UpdateSmsMessageInput): Promise<MessageView> {
    const doc = await this.session.getDocument('messages', messageId).catch(() => null)
    if (!doc || doc.empty())
      throw new NotFoundError('Message not found', { code: 'message_not_found' })
    this.assertMutable(doc)

    const data = (doc.get('data') as Record<string, unknown>) ?? {}
    if (input.content !== undefined) data.content = input.content
    doc.set('data', data)

    if (input.topics !== undefined) doc.set('topics', input.topics)
    if (input.users !== undefined) doc.set('users', input.users)
    if (input.targets !== undefined) doc.set('targets', input.targets)
    if (input.draft !== undefined) {
      const status = this.validateSchedule(
        input.draft,
        input.scheduledAt ?? (doc.get('scheduledAt') as string | undefined),
      )
      doc.set('status', status)
    }
    if (input.scheduledAt !== undefined) doc.set('scheduledAt', input.scheduledAt)

    const updated = await this.session.updateDocument('messages', messageId, doc)
    return formatMessage(updated)
  }

  async updatePush(messageId: string, input: UpdatePushMessageInput): Promise<MessageView> {
    const doc = await this.session.getDocument('messages', messageId).catch(() => null)
    if (!doc || doc.empty())
      throw new NotFoundError('Message not found', { code: 'message_not_found' })
    this.assertMutable(doc)

    const data = (doc.get('data') as Record<string, unknown>) ?? {}
    if (input.title !== undefined) data.title = input.title
    if (input.body !== undefined) data.body = input.body
    if (input.data !== undefined) data.data = input.data
    if (input.action !== undefined) data.action = input.action
    if (input.icon !== undefined) data.icon = input.icon
    if (input.badge !== undefined) data.badge = input.badge
    if (input.tag !== undefined) data.tag = input.tag
    if (input.color !== undefined) data.color = input.color
    if (input.sound !== undefined) data.sound = input.sound
    if (input.critical !== undefined) data.critical = input.critical
    doc.set('data', data)

    if (input.topics !== undefined) doc.set('topics', input.topics)
    if (input.users !== undefined) doc.set('users', input.users)
    if (input.targets !== undefined) doc.set('targets', input.targets)
    if (input.draft !== undefined) {
      const status = this.validateSchedule(
        input.draft,
        input.scheduledAt ?? (doc.get('scheduledAt') as string | undefined),
      )
      doc.set('status', status)
    }
    if (input.scheduledAt !== undefined) doc.set('scheduledAt', input.scheduledAt)

    const updated = await this.session.updateDocument('messages', messageId, doc)
    return formatMessage(updated)
  }
}
