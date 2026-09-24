import { type Database, Doc, DuplicateException, type Index, type IndexType } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../../shared/errors'

export interface CreateIndexInput {
  key: string
  type: IndexType
  attributes: string[]
  orders?: string[]
}

export class IndexesService {
  /**
   * List all indexes for a collection.
   */
  async getIndexes(
    db: Database,
    collectionId: string,
  ): Promise<{ data: Doc<Index>[]; total: number }> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    const rawIndexes = (collection.get('indexes') ?? []) as Array<
      Record<string, unknown> | Doc<Index>
    >
    const indexes: Doc<Index>[] = rawIndexes.map((idx) =>
      idx instanceof Doc ? idx : new Doc<Index>(idx as unknown as Index),
    )

    return {
      data: indexes,
      total: indexes.length,
    }
  }

  /**
   * Get an index by key.
   */
  async getIndex(db: Database, collectionId: string, key: string): Promise<Doc<Index>> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    const rawIndexes = (collection.get('indexes') ?? []) as Array<
      Record<string, unknown> | Doc<Index>
    >
    const found = rawIndexes.find((idx) => {
      const k = idx instanceof Doc ? idx.get('key') : idx.key
      const id = idx instanceof Doc ? idx.getId() : idx.$id
      return k === key || id === key
    })

    if (!found) {
      throw new NotFoundError('Index not found', { code: 'index_not_found' })
    }

    return found instanceof Doc ? found : new Doc<Index>(found as unknown as Index)
  }

  /**
   * Create an index on a collection.
   */
  async createIndex(
    db: Database,
    collectionId: string,
    input: CreateIndexInput,
  ): Promise<Doc<Index>> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    const rawIndexes = (collection.get('indexes') ?? []) as Array<
      Record<string, unknown> | Doc<Index>
    >
    const exists = rawIndexes.some((idx) => {
      const k = idx instanceof Doc ? idx.get('key') : idx.key
      return k === input.key
    })

    if (exists) {
      throw new ConflictError('Index already exists', { code: 'index_already_exists' })
    }

    try {
      await db.createIndex(
        collectionId,
        input.key,
        input.type,
        input.attributes,
        input.orders ?? [],
      )

      return new Doc<Index>({
        $id: input.key,
        key: input.key,
        type: input.type,
        attributes: input.attributes,
        orders: input.orders ?? [],
      })
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new ConflictError('Index already exists', {
          code: 'index_already_exists',
        })
      }
      throw error
    }
  }

  /**
   * Delete an index from a collection.
   */
  async deleteIndex(db: Database, collectionId: string, key: string): Promise<void> {
    await this.getIndex(db, collectionId, key)
    await db.deleteIndex(collectionId, key)
  }
}
