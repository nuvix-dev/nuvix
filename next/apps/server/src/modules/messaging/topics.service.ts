import { Doc, ID, Query, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'
import type { Topics } from '../../types/generated'
import { formatTopic, type TopicView } from './formatter'

export interface CreateTopicInput {
  topicId?: string
  name: string
  subscribe?: string[]
}

export interface UpdateTopicInput {
  name?: string
  subscribe?: string[]
}

export class TopicsService {
  constructor(private readonly session: Session) {}

  /**
   * Create a new topic.
   */
  async createTopic(input: CreateTopicInput): Promise<TopicView> {
    const topicId = !input.topicId || input.topicId === 'unique()' ? ID.unique() : input.topicId

    const existing = await this.session.getDocument('topics', topicId)
    if (!existing.empty()) {
      throw new ConflictError('Topic already exists', {
        code: 'messaging_topic_already_exists',
      })
    }

    const doc = new Doc<Topics>({
      $id: topicId,
      name: input.name,
      subscribe: input.subscribe ?? [],
      emailTotal: 0,
      smsTotal: 0,
      pushTotal: 0,
      search: [topicId, input.name].join(' '),
    })

    const created = await this.session.createDocument('topics', doc)
    return formatTopic(created)
  }

  /**
   * List all topics.
   */
  async listTopics(
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; topics: TopicView[] }> {
    const q = [...queries]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const docs = await this.session.find('topics', q)
    const total = await this.session.count('topics', filterQueries)

    return {
      total,
      topics: docs.map(formatTopic),
    }
  }

  /**
   * Get topic by ID.
   */
  async getTopic(topicId: string): Promise<TopicView> {
    const doc = await this.session.getDocument('topics', topicId)
    if (doc.empty()) {
      throw new NotFoundError('Topic not found', {
        code: 'messaging_topic_not_found',
      })
    }
    return formatTopic(doc)
  }

  /**
   * Update topic settings.
   */
  async updateTopic(topicId: string, input: UpdateTopicInput): Promise<TopicView> {
    const doc = await this.session.getDocument('topics', topicId)
    if (doc.empty()) {
      throw new NotFoundError('Topic not found', {
        code: 'messaging_topic_not_found',
      })
    }

    if (input.name !== undefined) {
      doc.set('name', input.name)
      doc.set('search', [topicId, input.name].join(' '))
    }
    if (input.subscribe !== undefined) {
      doc.set('subscribe', input.subscribe)
    }

    const updated = await this.session.updateDocument('topics', topicId, doc)
    return formatTopic(updated)
  }

  /**
   * Delete a topic and its subscribers.
   */
  async deleteTopic(topicId: string): Promise<void> {
    const doc = await this.session.getDocument('topics', topicId)
    if (doc.empty()) {
      throw new NotFoundError('Topic not found', {
        code: 'messaging_topic_not_found',
      })
    }

    // Delete all subscriber records for this topic
    const subscribers = await this.session.find('subscribers', [Query.equal('topicId', [topicId])])
    for (const sub of subscribers) {
      await this.session.deleteDocument('subscribers', sub.getId())
    }

    await this.session.deleteDocument('topics', topicId)
  }
}
