import { ID } from '@nuvix/core'
import { Doc, Permission, Query, Role, type Session } from '@nuvix/db'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors'
import type { Subscribers } from '../../types/generated'
import { formatSubscriber } from './formatter'
import type { CreateSubscriberInput, MessagingCallerAuth, SubscriberView } from './types'

export class SubscribersService {
  constructor(private readonly session: Session) {}

  async createSubscriber(
    topicId: string,
    input: CreateSubscriberInput,
    caller: MessagingCallerAuth,
  ): Promise<SubscriberView> {
    const subscriberId =
      input.subscriberId && input.subscriberId !== 'unique()' ? input.subscriberId : ID.unique()

    // Load topic (system-level: check subscription permissions)
    const topic = await this.session.getDocument('topics', topicId).catch(() => null)
    if (!topic || topic.empty()) {
      throw new NotFoundError('Topic not found', { code: 'topic_not_found' })
    }

    // Non-admin callers must satisfy topic's subscribe roles
    if (!caller.isAdmin && !caller.isKey) {
      const subscribeRoles: string[] = (topic.get('subscribe') as string[]) ?? []
      const allowed =
        subscribeRoles.includes('any') ||
        (subscribeRoles.includes('users') && !!caller.userId) ||
        subscribeRoles.some((r) => caller.roles.includes(r))

      if (!allowed) {
        throw new ForbiddenError('Not authorized to subscribe to this topic', {
          code: 'topic_subscribe_unauthorized',
        })
      }
    }

    // Load the target to get userId and providerType
    const target = await this.session.getDocument('targets', input.targetId).catch(() => null)
    if (!target || target.empty()) {
      throw new NotFoundError('Target not found', { code: 'user_target_not_found' })
    }

    const userId = String(target.get('userId') ?? '')
    const providerType = String(target.get('providerType') ?? '')

    if (!providerType) {
      throw new BadRequestError('Target has no provider type', { code: 'target_provider_mismatch' })
    }

    const doc = new Doc<Subscribers>({
      $id: subscriberId,
      $permissions: [Permission.read(Role.user(userId)), Permission.delete(Role.user(userId))],
      topicId,
      targetId: input.targetId,
      userId,
      providerType,
    })

    try {
      const created = await this.session.createDocument('subscribers', doc)

      // Increment topic counter for this channel type
      const counterField =
        providerType === 'email' ? 'emailTotal' : providerType === 'sms' ? 'smsTotal' : 'pushTotal'
      await this.session.increaseDocumentAttribute('topics', topicId, counterField)

      const view = formatSubscriber(created)
      return {
        ...view,
        userName: '',
        target: {
          $id: target.getId(),
          providerType,
          identifier: String(target.get('identifier') ?? ''),
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) {
        throw new ConflictError('Subscriber already exists for this topic/target', {
          code: 'subscriber_already_exists',
        })
      }
      throw err
    }
  }

  async listSubscribers(
    topicId: string,
    opts: { limit?: number; offset?: number },
  ): Promise<{ subscribers: SubscriberView[]; total: number }> {
    const limit = opts.limit ?? 25
    const offset = opts.offset ?? 0

    // Verify topic exists
    const topic = await this.session.getDocument('topics', topicId).catch(() => null)
    if (!topic || topic.empty()) {
      throw new NotFoundError('Topic not found', { code: 'topic_not_found' })
    }

    const queries = [
      Query.limit(limit),
      Query.offset(offset),
      Query.equal('topicId', [topicId]),
      Query.orderDesc('$createdAt'),
    ]

    const docs = await this.session.find('subscribers', queries)
    const total = await this.session.count('subscribers', [Query.equal('topicId', [topicId])])

    return { subscribers: docs.map(formatSubscriber), total }
  }

  async getSubscriber(topicId: string, subscriberId: string): Promise<SubscriberView> {
    const doc = await this.session.getDocument('subscribers', subscriberId).catch(() => null)
    if (!doc || doc.empty() || doc.get('topicId') !== topicId) {
      throw new NotFoundError('Subscriber not found', { code: 'subscriber_not_found' })
    }
    return formatSubscriber(doc)
  }

  async deleteSubscriber(
    topicId: string,
    subscriberId: string,
    caller: MessagingCallerAuth,
  ): Promise<void> {
    const doc = await this.session.getDocument('subscribers', subscriberId).catch(() => null)
    if (!doc || doc.empty() || doc.get('topicId') !== topicId) {
      throw new NotFoundError('Subscriber not found', { code: 'subscriber_not_found' })
    }

    // Non-admin: only allow deleting own subscription
    if (!caller.isAdmin && !caller.isKey) {
      const subUserId = doc.get('userId')
      if (subUserId !== caller.userId) {
        throw new ForbiddenError('Not authorized to delete this subscription', {
          code: 'general_access_forbidden',
        })
      }
    }

    await this.session.deleteDocument('subscribers', subscriberId)

    // Decrement topic counter
    const providerType = String(doc.get('providerType') ?? '')
    const counterField =
      providerType === 'email' ? 'emailTotal' : providerType === 'sms' ? 'smsTotal' : 'pushTotal'
    await this.session.decreaseDocumentAttribute('topics', topicId, counterField)
  }
}
