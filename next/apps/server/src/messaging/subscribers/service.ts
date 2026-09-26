import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError, UnauthorizedError } from '../../shared/errors'
import type { Subscribers } from '../../types/generated'
import { formatSubscriber, type SubscriberView } from '../formatter'

export interface CreateSubscriberInput {
  subscriberId?: string
  targetId: string
}

export class SubscribersService {
  constructor(private readonly session: Session) {}

  /**
   * Create a new subscriber on a topic.
   */
  async createSubscriber(topicId: string, input: CreateSubscriberInput): Promise<SubscriberView> {
    const topic = await this.session.getDocument('topics', topicId)
    if (topic.empty()) {
      throw new NotFoundError('Topic not found', {
        code: 'messaging_topic_not_found',
      })
    }

    // Role check against topic's subscribe permissions
    const subscribeRoles = (topic.get('subscribe') as string[]) ?? []
    if (subscribeRoles.length > 0) {
      const authorized = this.session.ctx.roles.some((role) => subscribeRoles.includes(role))
      if (!authorized) {
        throw new UnauthorizedError('Unauthorized to subscribe to topic', {
          code: 'user_unauthorized',
        })
      }
    }

    const target = await this.session.getDocument('targets', input.targetId)
    if (target.empty()) {
      throw new NotFoundError('User target not found', {
        code: 'user_target_not_found',
      })
    }

    const userId = target.get('userId') ?? ''
    const user = await this.session.getDocument('users', userId)

    const subscriberId =
      !input.subscriberId || input.subscriberId === 'unique()' ? ID.unique() : input.subscriberId

    const existing = await this.session.getDocument('subscribers', subscriberId)
    if (!existing.empty()) {
      throw new ConflictError('Subscriber already exists', {
        code: 'messaging_subscriber_already_exists',
      })
    }

    const providerType = (target.get('providerType') as string) ?? 'email'

    const subscriberDoc = new Doc<Subscribers>({
      $id: subscriberId,
      $permissions: userId
        ? [Permission.read(Role.user(userId)), Permission.delete(Role.user(userId))]
        : [],
      topicId,
      topicInternalId: topic.getSequence(),
      targetId: input.targetId,
      targetInternalId: target.getSequence(),
      userId,
      userInternalId: user.empty() ? 0 : user.getSequence(),
      providerType,
      search: [subscriberId, input.targetId, userId, providerType].join(' '),
    })

    const created = await this.session.createDocument('subscribers', subscriberDoc)

    // Increment topic count attribute
    const totalAttr =
      providerType === 'email'
        ? 'emailTotal'
        : providerType === 'sms'
          ? 'smsTotal'
          : providerType === 'push'
            ? 'pushTotal'
            : null

    if (totalAttr) {
      topic.set(totalAttr, (topic.get(totalAttr) ?? 0) + 1)
      await this.session.updateDocument('topics', topicId, topic)
    }

    return formatSubscriber(created, {
      target: target.toObject(),
      userName: user.empty() ? undefined : (user.get('name') ?? ''),
    })
  }

  /**
   * List subscribers for a topic.
   */
  async listSubscribers(
    topicId: string,
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; subscribers: SubscriberView[] }> {
    const topic = await this.session.getDocument('topics', topicId)
    if (topic.empty()) {
      throw new NotFoundError('Topic not found', {
        code: 'messaging_topic_not_found',
      })
    }

    const q = [...queries, Query.equal('topicId', [topicId])]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const docs = await this.session.find('subscribers', q)
    const total = await this.session.count('subscribers', filterQueries)

    // Enrich subscribers with target and user data
    const enriched = await Promise.all(
      docs.map(async (doc) => {
        const targetId = doc.get('targetId') ?? ''
        const userId = doc.get('userId') ?? ''
        const [target, user] = await Promise.all([
          targetId ? this.session.getDocument('targets', targetId) : Promise.resolve(new Doc({})),
          userId ? this.session.getDocument('users', userId) : Promise.resolve(new Doc({})),
        ])
        return formatSubscriber(doc, {
          target: target.empty() ? undefined : target.toObject(),
          userName: user.empty() ? undefined : (user.get('name') ?? ''),
        })
      }),
    )

    return { total, subscribers: enriched }
  }

  /**
   * Get a single subscriber.
   */
  async getSubscriber(topicId: string, subscriberId: string): Promise<SubscriberView> {
    const topic = await this.session.getDocument('topics', topicId)
    if (topic.empty()) {
      throw new NotFoundError('Topic not found', {
        code: 'messaging_topic_not_found',
      })
    }

    const subscriber = await this.session.getDocument('subscribers', subscriberId)
    if (subscriber.empty() || subscriber.get('topicId') !== topicId) {
      throw new NotFoundError('Subscriber not found', {
        code: 'messaging_subscriber_not_found',
      })
    }

    const targetId = subscriber.get('targetId') ?? ''
    const userId = subscriber.get('userId') ?? ''
    const [target, user] = await Promise.all([
      targetId ? this.session.getDocument('targets', targetId) : Promise.resolve(new Doc({})),
      userId ? this.session.getDocument('users', userId) : Promise.resolve(new Doc({})),
    ])

    return formatSubscriber(subscriber, {
      target: target.empty() ? undefined : target.toObject(),
      userName: user.empty() ? undefined : (user.get('name') ?? ''),
    })
  }

  /**
   * Delete a subscriber and decrement topic total.
   */
  async deleteSubscriber(topicId: string, subscriberId: string): Promise<void> {
    const topic = await this.session.getDocument('topics', topicId)
    if (topic.empty()) {
      throw new NotFoundError('Topic not found', {
        code: 'messaging_topic_not_found',
      })
    }

    const subscriber = await this.session.getDocument('subscribers', subscriberId)
    if (subscriber.empty() || subscriber.get('topicId') !== topicId) {
      throw new NotFoundError('Subscriber not found', {
        code: 'messaging_subscriber_not_found',
      })
    }

    const providerType = (subscriber.get('providerType') as string) ?? 'email'

    await this.session.deleteDocument('subscribers', subscriberId)

    // Decrement topic count attribute
    const totalAttr =
      providerType === 'email'
        ? 'emailTotal'
        : providerType === 'sms'
          ? 'smsTotal'
          : providerType === 'push'
            ? 'pushTotal'
            : null

    if (totalAttr) {
      const current = topic.get(totalAttr) ?? 0
      topic.set(totalAttr, Math.max(0, current - 1))
      await this.session.updateDocument('topics', topicId, topic)
    }
  }
}
