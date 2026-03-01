import { Logger } from '@nestjs/common'
import { Audit } from '@nuvix/audit'
import {
  AttributeType,
  Authorization,
  Database,
  DatabaseException,
  Doc,
  Query,
} from '@nuvix/db'
import { SchemaMeta, Status } from '@nuvix/utils'
import type {
  Attributes,
  AttributesDoc,
  CollectionsDoc,
  IndexesDoc,
} from '@nuvix/utils/types'

export class CollectionsHelper {
  private static readonly logger = new Logger(CollectionsHelper.name)

  /**
   *
   */
  static getRelatedAttrId(collectionSequence: number, key: string): string {
    return `related_${collectionSequence}_${key}`
  }

  /** @see collectionService */
  static getAttrId(collectionSequence: number, key: string): string {
    return `${collectionSequence}_${key}`
  }

  /**
   * Creates an attribute in the specified collection.
   */
  public static async createAttribute({
    db,
    collection,
    attribute,
  }: {
    db: Database
    collection: CollectionsDoc
    attribute: AttributesDoc
  }): Promise<void> {
    await Authorization.skip(async () => {
      const collectionId = collection.getId()
      const key = attribute.get('key')
      const type = attribute.get('type') as AttributeType
      const size = attribute.get('size', 0)
      const required = attribute.get('required', false)
      const defaultValue = attribute.get('default', null)
      const array = attribute.get('array', false)
      const format = attribute.get('format', '')
      const formatOptions = attribute.get('formatOptions', {})
      const filters = attribute.get('filters', [])
      const options = attribute.get('options', {})

      let relatedAttribute!: AttributesDoc
      let relatedCollection!: CollectionsDoc

      try {
        switch (type) {
          case AttributeType.Relationship:
            relatedCollection = await db.getDocument(
              SchemaMeta.collections,
              options.relatedCollection,
            )
            if (relatedCollection.empty()) {
              throw new DatabaseException(
                `Collection '${options.relatedCollection}' not found`,
              )
            }
            if (
              !(await db.createRelationship({
                collectionId: collection.getId(),
                relatedCollectionId: relatedCollection.getId(),
                type: options.relationType,
                twoWay: options.twoWay,
                id: key,
                twoWayKey: options.twoWayKey,
                onDelete: options.onDelete,
              }))
            ) {
              throw new DatabaseException('Failed to create Attribute')
            }

            if (options.twoWay) {
              relatedAttribute = await db.getDocument(
                SchemaMeta.attributes,
                CollectionsHelper.getRelatedAttrId(
                  relatedCollection.getSequence(),
                  options.twoWayKey,
                ),
              )
              await db.updateDocument(
                SchemaMeta.attributes,
                relatedAttribute.getId(),
                relatedAttribute.set('status', Status.AVAILABLE),
              )
            }
            break
          default:
            if (
              !(await db.createAttribute(collection.getId(), {
                $id: key,
                key,
                type,
                size,
                required,
                default: defaultValue,
                array,
                format,
                formatOptions,
                filters,
              }))
            ) {
              throw new DatabaseException('Failed to create Attribute')
            }
        }

        await db.updateDocument(
          SchemaMeta.attributes,
          attribute.getId(),
          attribute.set('status', Status.AVAILABLE),
        )
      } catch (e: any) {
        this.logger.error(e.message)
        if (e instanceof DatabaseException) {
          attribute.set('error', e.message)
          if (relatedAttribute) {
            relatedAttribute.set('error', e.message)
          }
        }

        await db.updateDocument(
          SchemaMeta.attributes,
          attribute.getId(),
          attribute.set('status', Status.FAILED),
        )

        if (relatedAttribute) {
          await db.updateDocument(
            SchemaMeta.attributes,
            relatedAttribute.getId(),
            relatedAttribute.set('status', Status.FAILED),
          )
        }
      }

      if (type === AttributeType.Relationship && options.twoWay) {
        await db.purgeCachedDocument(
          SchemaMeta.collections,
          relatedCollection.getId(),
        )
      }

      await db.purgeCachedDocument(SchemaMeta.collections, collectionId)
    })
  }

  /**
   * Deletes an attribute from the specified collection.
   * If the attribute is a relationship, it also deletes the related attribute.
   */
  public static async deleteAttribute({
    database,
    ...data
  }: JobData): Promise<void> {
    const collection = new Doc(data.collection)
    const attribute = new Doc(data.attribute)
    const project = new Doc(data.project)
    const { client, dbForProject } =
      await this.coreService.createProjectDatabase(project, {
        schema: database,
      })

    if (collection.empty()) {
      throw new Error('Missing collection')
    }
    if (attribute.empty()) {
      throw new Error('Missing attribute')
    }

    // const projectId = project.getId();
    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].attributes.[attributeId].delete', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   attributeId: attribute.getId()
    // });

    try {
      await Authorization.skip(async () => {
        const collectionId = collection.getId()
        const key = attribute.get('key')
        const status = attribute.get('status', '')
        const type = attribute.get('type') as AttributeType
        const options = attribute.get('options', {})

        let relatedAttribute: AttributesDoc | null = null
        let relatedCollection: CollectionsDoc | null = null

        try {
          if (status !== Status.FAILED) {
            if (type === AttributeType.Relationship) {
              if (options.twoWay) {
                relatedCollection = await db.getDocument(
                  SchemaMeta.collections,
                  options.relatedCollection,
                )
                if (relatedCollection.empty()) {
                  throw new DatabaseException('Collection not found')
                }
                relatedAttribute = await db.getDocument(
                  SchemaMeta.attributes,
                  this.getRelatedAttrId(
                    relatedCollection.getSequence(),
                    options.twoWayKey,
                  ),
                )
                if (relatedAttribute.empty()) {
                  throw new DatabaseException('Related attribute not found')
                }
              }

              if (!(await db.deleteRelationship(collection.getId(), key))) {
                await db.updateDocument(
                  SchemaMeta.attributes,
                  relatedAttribute?.getId() as string,
                  relatedAttribute?.set(
                    'status',
                    Status.STUCK,
                  ) as Doc<Attributes>,
                )
                throw new DatabaseException('Failed to delete Relationship')
              }
            } else if (!(await db.deleteAttribute(collection.getId(), key))) {
              throw new DatabaseException('Failed to delete Attribute')
            }
          }

          await db.deleteDocument(SchemaMeta.attributes, attribute.getId())

          if (relatedAttribute && !relatedAttribute.empty()) {
            await db.deleteDocument(
              SchemaMeta.attributes,
              relatedAttribute.getId(),
            )
          }
        } catch (e: any) {
          this.logger.error(e.message)

          if (e instanceof DatabaseException) {
            attribute.set('error', e.message)
            if (relatedAttribute && !relatedAttribute.empty()) {
              relatedAttribute.set('error', e.message)
            }
          }
          await db.updateDocument(
            SchemaMeta.attributes,
            attribute.getId(),
            attribute.set('status', Status.STUCK),
          )
          if (relatedAttribute && !relatedAttribute.empty()) {
            await db.updateDocument(
              SchemaMeta.attributes,
              relatedAttribute.getId(),
              relatedAttribute.set('status', Status.STUCK),
            )
          }
        } finally {
          // this.trigger(database, collection, attribute, projectDoc, projectId, events);
        }

        const indexes = collection.get(SchemaMeta.indexes, []) as IndexesDoc[]

        for (const index of indexes) {
          const attributes = index.get('attributes')
          const orders = index.get('orders')

          const found = attributes.indexOf(key)

          if (found !== -1) {
            attributes.splice(found, 1)
            if (orders[found]) {
              orders.splice(found, 1)
            }

            if (attributes.length === 0) {
              await db.deleteDocument(SchemaMeta.indexes, index.getId())
            } else {
              index.set('attributes', attributes)
              index.set('orders', orders)

              let exists = false
              for (const existing of indexes) {
                if (
                  existing.get('key') !== index.get('key') &&
                  existing.get('attributes').toString() ===
                    index.get('attributes').toString() &&
                  existing.get('orders').toString() ===
                    index.get('orders').toString()
                ) {
                  exists = true
                  break
                }
              }

              if (exists) {
                await this.deleteIndex(
                  {
                    database: database,
                    collection: data.collection,
                    index: index.toObject(),
                    project: data.project,
                  },
                  dbForProject,
                )
              } else {
                await db.updateDocument(
                  SchemaMeta.indexes,
                  index.getId(),
                  index,
                )
              }
            }
          }
        }

        await db.purgeCachedDocument(SchemaMeta.collections, collectionId)
        await db.purgeCachedCollection(collection.getId())

        if (
          relatedCollection &&
          !relatedCollection.empty() &&
          relatedAttribute &&
          !relatedAttribute.empty()
        ) {
          await db.purgeCachedDocument(
            SchemaMeta.collections,
            relatedCollection.getId(),
          )
          await db.purgeCachedCollection(relatedCollection.getId())
        }
      })
    } finally {
      await this.coreService.releaseDatabaseClient(client)
    }
  }

  /**
   * Creates an index in the specified collection.
   */
  public static async createIndex(data: JobData): Promise<void> {
    const collection = new Doc(data.collection)
    const index = new Doc(data.index)
    const project = new Doc(data.project)

    const { client, dbForProject } =
      await this.coreService.createProjectDatabase(project, {
        schema: data.database,
      })

    if (collection.empty()) {
      throw new Error('Missing collection')
    }
    if (index.empty()) {
      throw new Error('Missing index')
    }

    // const projectId = project.getId();
    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].indexes.[indexId].update', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   indexId: index.getId()
    // });

    try {
      await Authorization.skip(async () => {
        const collectionId = collection.getId()
        const key = index.get('key')
        const type = index.get('type')
        const attributes = index.get('attributes', [])
        const orders = index.get('orders', [])

        try {
          if (
            !(await db.createIndex(
              collection.getId(),
              key,
              type,
              attributes,
              orders,
            ))
          ) {
            throw new DatabaseException('Failed to create Index')
          }
          await db.updateDocument(
            SchemaMeta.indexes,
            index.getId(),
            index.set('status', Status.AVAILABLE),
          )
        } catch (e: any) {
          if (e instanceof DatabaseException) {
            index.set('error', e.message)
          }
          await db.updateDocument(
            SchemaMeta.indexes,
            index.getId(),
            index.set('status', Status.FAILED),
          )
        } finally {
          // this.trigger(database, collection, index, projectDoc, projectId, events);
        }

        await db.purgeCachedDocument(SchemaMeta.collections, collectionId)
      })
    } finally {
      await this.coreService.releaseDatabaseClient(client)
    }
  }

  /**
   * Deletes an index from the specified collection.
   * If the index is part of a collection, it also deletes the index from the collection
   */
  public static async deleteIndex(
    { database, ...data }: JobData,
    dbForProject?: Database,
  ): Promise<void> {
    const collection = new Doc(data.collection)
    const index = new Doc(data.index)
    const project = new Doc(data.project)

    let client: any = null
    if (!dbForProject) {
      const r = await this.coreService.createProjectDatabase(project, {
        schema: database,
      })
      dbForProject = r.dbForProject
      client = r.client
    }

    if (collection.empty()) {
      throw new Error('Missing collection')
    }
    if (index.empty()) {
      throw new Error('Missing index')
    }

    // const projectId = project.getId();
    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].indexes.[indexId].delete', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   indexId: index.getId()
    // });

    try {
      await Authorization.skip(async () => {
        const key = index.get('key')
        const status = index.get('status', '')

        try {
          if (
            status !== Status.FAILED &&
            !(await db.deleteIndex(collection.getId(), key))
          ) {
            throw new DatabaseException('Failed to delete index')
          }
          await db.deleteDocument(SchemaMeta.indexes, index.getId())
          index.set('status', Status.DELETED)
        } catch (e: any) {
          if (e instanceof DatabaseException) {
            index.set('error', e.message)
          }
          await db.updateDocument(
            SchemaMeta.indexes,
            index.getId(),
            index.set('status', Status.STUCK),
          )
        } finally {
          // this.trigger(database, collection, index, projectDoc, projectId, events);
        }

        await db.purgeCachedDocument(SchemaMeta.collections, collection.getId())
      })
    } finally {
      await this.coreService.releaseDatabaseClient(client)
    }
  }

  /**
   * Deletes a collection and all its attributes and indexes.
   * It also deletes all relationships associated with the collection.
   */
  public static async deleteCollection(data: JobData): Promise<void> {
    const project = new Doc(data.project)
    const collection = new Doc(data.collection)
    const { client, dbForProject } =
      await this.coreService.createProjectDatabase(project, {
        schema: data.database,
      })

    if (collection.empty()) {
      throw new Error('Missing collection')
    }

    try {
      await Authorization.skip(async () => {
        const collectionId = collection.getId()
        const collectionInternalId = collection.getSequence()

        const relationships = await db.find(SchemaMeta.attributes, qb =>
          qb
            .equal('type', AttributeType.Relationship)
            .equal('collectionInternalId', collectionInternalId)
            .equal('options->>relatedCollection' as any, collection.getId()),
        )

        for (const relationship of relationships) {
          await db.deleteDocument(
            relationship.getCollection(),
            relationship.getId(),
          )
          await db.purgeCachedDocument(
            SchemaMeta.collections,
            relationship.getCollection(),
          )
        }
        await db.deleteCollection(collection.getId())
        await db.deleteDocuments('attributes', qb =>
          qb.equal('collectionInternalId', collectionInternalId),
        )
        await db.deleteDocuments('indexes', qb =>
          qb.equal('collectionInternalId', collectionInternalId),
        )

        await this.deleteAuditLogsByResource(
          `/collection/${collectionId}`,
          project,
          dbForProject,
        )
      })
    } finally {
      await this.coreService.releaseDatabaseClient(client)
    }
  }

  private static async deleteAuditLogsByResource(
    resource: string,
    _project: ProjectsDoc,
    dbForProject: Database,
  ): Promise<void> {
    await this.deleteByGroup(
      Audit.COLLECTION,
      [Query.equal('resource', [resource])],
      dbForProject,
    )
  }

  private static async deleteByGroup(
    collection: string,
    queries: Query[],
    database: Database,
    callback?: (document: Doc) => Promise<void>,
  ): Promise<void> {
    let count = 0
    let chunk = 0
    const limit = 50
    let sum = limit

    const executionStart = Date.now()

    while (sum === limit) {
      chunk++

      const results = await database.find(collection, [
        Query.limit(limit),
        ...queries,
      ])

      sum = results.length

      this.logger.log(`Deleting chunk #${chunk}. Found ${sum} documents`)

      for (const document of results) {
        if (
          await database.deleteDocument(
            document.getCollection(),
            document.getId(),
          )
        ) {
          this.logger.log(`Deleted document "${document.getId()}" successfully`)

          if (callback) {
            await callback(document)
          }
        } else {
          this.logger.warn(`Failed to delete document: ${document.getId()}`)
        }
        count++
      }
    }

    const executionEnd = Date.now()

    this.logger.log(
      `Deleted ${count} documents by group in ${(executionEnd - executionStart) / 1000} seconds`,
    )
  }
}
