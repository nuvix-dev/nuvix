import { ID } from '@nuvix/core'
import { Doc, Permission, Query, Role, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'
import type { Topics } from '../../types/generated'
import { formatTopic } from './formatter'
import type { CreateTopicInput, TopicView, UpdateTopicInput } from './types'

export class TopicsService {
  constructor(private readonly session: Session) {}

  async listTopics(opts: {
    limit?: number
    offset?: number
    search?: string
  }): Promise<{ topics: TopicView[]; total: number }> {
    const limit = opts.limit ?? 25
    const offset = opts.offset ?? 0
    const queries: Query[] = [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc('$createdAt'),
    ]

    const countQueries: Query[] = []
    if (opts.search) {
      queries.push(Query.search('name', opts.search))
      countQueries.push(Query.search('name', opts.search))
    }

    const docs = await this.session.find('topics', queries)
    const total = await this.session.count('topics', countQueries)

    return { topics: docs.map(formatTopic), total }
  }

  async getTopic(topicId: string): Promise<TopicView> {
    const doc = await this.session.getDocument('topics', topicId).catch(() => null)
    if (!doc || doc.empty()) {
      throw new NotFoundError('Topic not found', { code: 'topic_not_found' })
    }
    return formatTopic(doc)
  }

  async createTopic(input: CreateTopicInput): Promise<TopicView> {
    const topicId = input.topicId && input.topicId !== 'unique()' ? input.topicId : ID.unique()

    const doc = new Doc<Topics>({
      $id: topicId,
      $permissions: [Permission.read(Role.any()), Permission.update(Role.any())],
      name: input.name,
      subscribe: input.subscribe ?? ['users'],
      emailTotal: 0,
      smsTotal: 0,
      pushTotal: 0,
    })

    try {
      const created = await this.session.createDocument('topics', doc)
      return formatTopic(created)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) {
        throw new ConflictError('Topic already exists', { code: 'topic_already_exists' })
      }
      throw err
    }
  }

  async updateTopic(topicId: string, input: UpdateTopicInput): Promise<TopicView> {
    const doc = await this.session.getDocument('topics', topicId).catch(() => null)
    if (!doc || doc.empty()) {
      throw new NotFoundError('Topic not found', { code: 'topic_not_found' })
    }

    if (input.name !== undefined) doc.set('name', input.name)
    if (input.subscribe !== undefined) doc.set('subscribe', input.subscribe)

    const updated = await this.session.updateDocument('topics', topicId, doc)
    return formatTopic(updated)
  }

  async deleteTopic(topicId: string): Promise<void> {
    const doc = await this.session.getDocument('topics', topicId).catch(() => null)
    if (!doc || doc.empty()) {
      throw new NotFoundError('Topic not found', { code: 'topic_not_found' })
    }
    await this.session.deleteDocument('topics', topicId)
  }
}
