import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Exception } from '@nuvix/core/extend/exception'
import { CollectionsJob, CollectionsJobData } from '@nuvix/core/resolvers'
import {
  AttributeType,
  Database,
  Doc,
  DuplicateException,
  ID,
  IndexValidator,
  Query,
} from '@nuvix/db'
import { configuration, QueueFor, SchemaMeta, Status } from '@nuvix/utils'
import type {
  Attributes,
  AttributesDoc,
  Indexes,
  IndexesDoc,
  ProjectsDoc,
} from '@nuvix/utils/types'
import type { Queue } from 'bullmq'
import type { CreateIndexDTO } from './DTO/indexes.dto'

@Injectable()
export class IndexesService {
  constructor(
    @InjectQueue(QueueFor.COLLECTIONS)
    private readonly collectionsQueue: Queue<
      CollectionsJobData,
      unknown,
      CollectionsJob
    >,
    readonly _event: EventEmitter2,
  ) {}

  getRelatedAttrId(collectionSequence: number, key: string): string {
    return `related_${collectionSequence}_${key}`
  }

  getAttrId(collectionSequence: number, key: string): string {
    return `${collectionSequence}_${key}`
  }

  /**
   * Create a Index.
   */
  async createIndex(collectionId: string, input: CreateIndexDTO) {
    const { key, type, attributes, orders } = input

    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    )

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND)
    }

    const count = await db.count(
      SchemaMeta.indexes,
      [Query.equal('collectionInternalId', [collection.getSequence()])],
      61,
    )

    const limit = db.getAdapter().$limitForIndexes
    if (count >= limit) {
      throw new Exception(
        Exception.INDEX_LIMIT_EXCEEDED,
        'Index limit exceeded',
      )
    }

    const oldAttributes = (collection.get('attributes') as AttributesDoc[]).map(
      a => a.toObject(),
    )

    oldAttributes.push(
      {
        key: '$id',
        type: AttributeType.String,
        status: Status.AVAILABLE,
        required: true,
        size: 36,
      } as Attributes,
      {
        key: '$createdAt',
        type: AttributeType.Timestamptz,
        status: Status.AVAILABLE,
      } as Attributes,
      {
        key: '$updatedAt',
        type: AttributeType.Timestamptz,
        status: Status.AVAILABLE,
      } as Attributes,
    )

    for (const [i, attribute] of attributes.entries()) {
      const attributeIndex = oldAttributes.findIndex(a => a.key === attribute)

      if (attributeIndex === -1) {
        throw new Exception(
          Exception.ATTRIBUTE_UNKNOWN,
          `Unknown attribute: ${attribute}. Verify the attribute name or create the attribute.`,
        )
      }

      const {
        status: attributeStatus,
        type: attributeType,
        array: attributeArray = false,
      } = oldAttributes[attributeIndex]!
      if (attributeType === AttributeType.Relationship) {
        throw new Exception(
          Exception.ATTRIBUTE_TYPE_INVALID,
          `Cannot create an index for a relationship attribute: ${oldAttributes[attributeIndex]?.key}`,
        )
      }

      if (attributeStatus !== Status.AVAILABLE) {
        throw new Exception(
          Exception.ATTRIBUTE_NOT_AVAILABLE,
          `Attribute not available: ${oldAttributes[attributeIndex]?.key}`,
        )
      }

      if (attributeArray) {
        orders[i] = null
      }
    }

    let index = new Doc<Indexes>({
      $id: ID.custom(this.getAttrId(collection.getSequence(), key)),
      key,
      status: Status.PENDING,
      collectionInternalId: collection.getSequence(),
      collectionId,
      type,
      attributes,
      orders,
    })

    const validator = new IndexValidator(
      collection.get('attributes'),
      db.getAdapter().$maxIndexLength,
    )

    if (!validator.$valid(index as any)) {
      throw new Exception(Exception.INDEX_INVALID, validator.$description)
    }

    try {
      index = await db.createDocument(SchemaMeta.indexes, index)
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.INDEX_ALREADY_EXISTS)
      }
      throw error
    }

    await db.purgeCachedDocument(SchemaMeta.collections, collectionId)

    await this.collectionsQueue.add(CollectionsJob.CREATE_INDEX, {
      database: db.schema,
      collection,
      index,
      project,
    })

    return index
  }

  /**
   * Get all indexes.
   */
  async getIndexes(collectionId: string, queries: Query[] = []) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    )

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND)
    }
    queries.push(
      Query.equal('collectionInternalId', [collection.getSequence()]),
    )

    const filterQueries = Query.groupByType(queries).filters
    const indexes = await db.find(SchemaMeta.indexes, queries)
    const total = await db.count(
      SchemaMeta.indexes,
      filterQueries,
      configuration.limits.limitCount,
    )

    return {
      data: indexes,
      total,
    }
  }

  /**
   * Get an index.
   */
  async getIndex(collectionId: string, key: string) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    )

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND)
    }
    const index = collection.findWhere(
      'indexes',
      (i: IndexesDoc) => i.get('key') === key,
    )

    if (!index) {
      throw new Exception(Exception.INDEX_NOT_FOUND)
    }

    return index
  }

  /**
   * Delete an index.
   */
  async deleteIndex(collectionId: string, key: string) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    )

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND)
    }

    const index = await db.getDocument(
      SchemaMeta.indexes,
      this.getAttrId(collection.getSequence(), key),
    )

    if (index.empty()) {
      throw new Exception(Exception.INDEX_NOT_FOUND)
    }

    // Only update status if removing available index
    if (index.get('status') === Status.AVAILABLE) {
      await db.updateDocument(
        SchemaMeta.indexes,
        index.getId(),
        index.set('status', Status.DELETING),
      )
    }

    await db.purgeCachedDocument(SchemaMeta.collections, collectionId)

    await this.collectionsQueue.add(CollectionsJob.DELETE_INDEX, {
      database: db.schema,
      collection,
      index,
      project,
    })

    return index
  }
}
