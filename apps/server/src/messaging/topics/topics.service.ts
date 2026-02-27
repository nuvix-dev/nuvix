import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import type { DeletesJobData } from '@nuvix/core/resolvers'
import { Database, Doc, DuplicateException, ID, Query } from '@nuvix/db'
import { DeleteType, QueueFor, Schemas } from '@nuvix/utils'
import type { ProjectsDoc, Topics } from '@nuvix/utils/types'
import { Queue } from 'bullmq'
import type { CreateTopic, ListTopics, UpdateTopic } from './topics.types'

@Injectable()
export class TopicsService {
  constructor(
    @InjectQueue(QueueFor.DELETES)
    private readonly deletesQueue: Queue<DeletesJobData, unknown, DeleteType>,
  ) {}
  /**
   * Create Topic
   */
  async createTopic({ input, db }: CreateTopic) {
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
    const data = await this.populateTargets(topics)
    const total = await this.db.count('topics', filters)

    return {
      data,
      total,
    }
  }

  private populateTargets(topics: Doc<Topics>[]) {
    return this.db.withSchema(Schemas.Auth, () =>
      this.db.skipValidation(() =>
        Promise.all(
          topics.map(async topic => {
            const targetIds = topic.get('targets', [])
            if (targetIds.length > 0) {
              const targets = await this.db.find('targets', [
                Query.equal('$sequence', [...targetIds]),
              ])
              topic.set('targets', targets)
            }
            return topic
          }),
        ),
      ),
    )
  }

  /**
   * Get Topic
   */
  async getTopic(id: string) {
    const topic = await this.db.getDocument('topics', id)

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND)
    }

    const populatedTopic = await this.populateTargets([topic]).then(
      ([populated]) => populated!,
    )
    return populatedTopic
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

    const populatedTopic = await this.populateTargets([updatedTopic]).then(
      ([populated]) => populated!,
    )
    return populatedTopic
  }

  /**
   * Deletes a topic.
   */
  async deleteTopic(topicId: string, project: ProjectsDoc) {
    const topic = await this.db.getDocument('topics', topicId)

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND)
    }

    await this.db.deleteDocument('topics', topicId)

    await this.deletesQueue.add(DeleteType.TOPIC, {
      project,
      document: topic.clone(),
    })
    return
  }
}
