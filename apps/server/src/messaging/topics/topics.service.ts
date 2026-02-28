import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import type { DeletesJobData } from '@nuvix/core/resolvers'
import { Database, Doc, DuplicateException, ID, Query } from '@nuvix/db'
import { DeleteType, QueueFor } from '@nuvix/utils'
import type { Topics } from '@nuvix/utils/types'
import { Queue } from 'bullmq'
import type { CreateTopic, ListTopics, UpdateTopic } from './topics.types'
import { CoreService } from '@nuvix/core/core.service'

@Injectable()
export class TopicsService {
  private readonly db: Database

  constructor(
    private readonly coreService: CoreService,
    @InjectQueue(QueueFor.DELETES)
    private readonly deletesQueue: Queue<DeletesJobData, unknown, DeleteType>,
  ) {
    this.db = this.coreService.getDatabase()
  }

  /**
   * Create Topic
   */
  async createTopic({ input }: CreateTopic) {
    const { topicId: inputTopicId, name, subscribe } = input
    const topicId = inputTopicId === 'unique()' ? ID.unique() : inputTopicId

    const topic = new Doc<Topics>({
      $id: topicId,
      name,
      subscribe,
    })

    try {
      const createdTopic = await this.db.createDocument('topics', topic)

      return createdTopic
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.TOPIC_ALREADY_EXISTS)
      }
      throw error
    }
  }

  /**
   * Lists all topics.
   */
  async listTopics({ queries = [], search }: ListTopics) {
    if (search) {
      queries.push(Query.search('search', search))
    }

    const { filters } = Query.groupByType(queries)

    const topics = await this.db.find('topics', queries)
    const total = await this.db.count('topics', filters)

    return {
      data: topics,
      total,
    }
  }

  /**
   * Get Topic
   */
  async getTopic(id: string) {
    const topic = await this.db.getDocument('topics', id)

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND)
    }

    return topic
  }

  /**
   * Updates a topic.
   */
  async updateTopic({ topicId, input }: UpdateTopic) {
    const topic = await this.db.getDocument('topics', topicId)

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND)
    }

    if (input.name !== undefined && input.name !== null) {
      topic.set('name', input.name)
    }

    if (input.subscribe !== undefined && input.subscribe !== null) {
      topic.set('subscribe', input.subscribe)
    }

    const updatedTopic = await this.db.updateDocument('topics', topicId, topic)

    return updatedTopic
  }

  /**
   * Deletes a topic.
   */
  async deleteTopic(topicId: string) {
    const topic = await this.db.getDocument('topics', topicId)

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND)
    }

    await this.db.deleteDocument('topics', topicId)

    await this.deletesQueue.add(DeleteType.TOPIC, {
      document: topic.clone(),
    })
    return
  }
}
