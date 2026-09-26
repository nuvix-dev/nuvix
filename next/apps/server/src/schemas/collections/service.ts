import {
  type Collection,
  Database,
  Doc,
  DuplicateException,
  ID,
  LimitException,
  Permission,
  type Query,
  Role,
} from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'

export interface CreateCollectionInput {
  collectionId?: string
  name: string
  permissions?: string[]
  documentSecurity?: boolean
  enabled?: boolean
}

export interface UpdateCollectionInput {
  name?: string
  permissions?: string[]
  documentSecurity?: boolean
  enabled?: boolean
}

export interface CollectionUsage {
  range: string
  documentsTotal: number
  documents: Array<{ date: string; value: number }>
}

export class CollectionsService {
  /**
   * Create a new collection in the schema.
   */
  async createCollection(db: Database, input: CreateCollectionInput): Promise<Doc<Collection>> {
    const collectionId =
      !input.collectionId || input.collectionId === 'unique()' ? ID.unique() : input.collectionId

    const permissions =
      input.permissions && input.permissions.length > 0
        ? (Permission.aggregate(input.permissions) ?? [])
        : [
            Permission.create(Role.any()),
            Permission.read(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any()),
          ]

    try {
      const collection = await db.createCollection({
        id: collectionId,
        permissions,
        documentSecurity: input.documentSecurity ?? true,
        enabled: input.enabled ?? true,
      })

      if (input.name) {
        collection.set('name', input.name)
        await db.system().updateDocument(Database.METADATA, collectionId, collection)
      }

      return collection
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new ConflictError('Collection already exists', {
          code: 'collection_already_exists',
        })
      }
      if (error instanceof LimitException) {
        throw new ConflictError('Collection limit exceeded', {
          code: 'collection_limit_exceeded',
        })
      }
      throw error
    }
  }

  /**
   * Get all collections in the schema.
   */
  async getCollections(
    db: Database,
    queries: Query[] = [],
    _search?: string,
  ): Promise<{ data: Doc<Collection>[]; total: number }> {
    const collections = await db.system().find<Collection>(Database.METADATA, queries)
    const total = await db.system().count(Database.METADATA)

    return {
      data: collections,
      total,
    }
  }

  /**
   * Get a single collection by ID.
   */
  async getCollection(db: Database, collectionId: string): Promise<Doc<Collection>> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }
    return collection
  }

  /**
   * Update a collection.
   */
  async updateCollection(
    db: Database,
    collectionId: string,
    input: UpdateCollectionInput,
  ): Promise<Doc<Collection>> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    const permissions = input.permissions
      ? (Permission.aggregate(input.permissions) ?? [])
      : collection.getPermissions()

    const documentSecurity = input.documentSecurity ?? collection.get('documentSecurity') ?? false
    const enabled = input.enabled ?? collection.get('enabled') ?? true

    const updated = await db.updateCollection({
      id: collectionId,
      permissions,
      documentSecurity,
      enabled,
    })

    if (input.name) {
      updated.set('name', input.name)
      await db.system().updateDocument(Database.METADATA, collectionId, updated)
    }

    return updated
  }

  /**
   * Remove a collection and all associated tables.
   */
  async removeCollection(db: Database, collectionId: string): Promise<void> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    await db.deleteCollection(collectionId)
  }

  /**
   * Get collection usage statistics.
   */
  async getCollectionUsage(
    db: Database,
    collectionId: string,
    range = '7d',
  ): Promise<Doc<CollectionUsage>> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    const total = await db.system().count(collectionId)

    return new Doc<CollectionUsage>({
      range,
      documentsTotal: total,
      documents: [{ date: new Date().toISOString(), value: total }],
    })
  }
}
