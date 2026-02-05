import { Injectable } from '@nestjs/common'
import type { CreateTopic, ListTopics, UpdateTopic } from './topics.types'
import { Database, Doc, DuplicateException, ID, Query } from '@nuvix/db'
import { Exception } from '@nuvix/core/extend/exception'
import type { ProjectsDoc, Topics } from '@nuvix/utils/types'
import { InjectQueue } from '@nestjs/bullmq'
import type { DeletesJobData } from '@nuvix/core/resolvers'
import { QueueFor, DeleteType, Schemas } from '@nuvix/utils'
import { Queue } from 'bullmq'

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
      const createdTopic = await db.createDocument('topics', topic)

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
  async listTopics({ db, queries = [], search }: ListTopics) {
    if (search) {
      queries.push(Query.search('search', search))
    }

    const { filters } = Query.groupByType(queries)

    const topics = await db.find('topics', queries)
    const data = await this.populateTargets(db, topics)
    const total = await db.count('topics', filters)

    return {
      data,
      total,
    }
  }

  private populateTargets(db: Database, topics: Doc<Topics>[]) {
    return db.withSchema(Schemas.Auth, () =>
      db.skipValidation(() =>
        Promise.all(
          topics.map(async topic => {
            const targetIds = topic.get('targets', [])
            if (targetIds.length > 0) {
              const targets = await db.find('targets', [
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
  async getTopic(db: Database, id: string) {
    const topic = await db.getDocument('topics', id)

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND)
    }

    const populatedTopic = await this.populateTargets(db, [topic]).then(
      ([populated]) => populated!,
    )
    return populatedTopic
  }

  /**
   * Updates a topic.
   */
  async updateTopic({ topicId, db, input }: UpdateTopic) {
    const topic = await db.getDocument('topics', topicId)

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND)
    }

    if (input.name !== undefined && input.name !== null) {
      topic.set('name', input.name)
    }

    if (input.subscribe !== undefined && input.subscribe !== null) {
      topic.set('subscribe', input.subscribe)
    }

    const updatedTopic = await db.updateDocument('topics', topicId, topic)

    const populatedTopic = await this.populateTargets(db, [updatedTopic]).then(
      ([populated]) => populated!,
    )
    return populatedTopic
  }

  /**
   * Deletes a topic.
   */
  async deleteTopic(db: Database, topicId: string, project: ProjectsDoc) {
    const topic = await db.getDocument('topics', topicId)

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND)
    }

    await db.deleteDocument('topics', topicId)

    await this.deletesQueue.add(DeleteType.TOPIC, {
      project,
      document: topic.clone(),
    })
    return
  }
}
