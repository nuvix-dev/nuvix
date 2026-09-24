import { describe, expect, test } from 'bun:test'
import { type Collection, Database, Doc, DuplicateException, type Permission } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../../shared/errors'
import { CollectionsService } from './service'

describe('CollectionsService', () => {
  const collectionsStore = new Map<string, Doc<Collection>>()

  const mockDb = {
    createCollection: async ({
      id,
      permissions,
      documentSecurity,
      enabled,
    }: {
      id: string
      permissions?: (string | Permission)[]
      documentSecurity?: boolean
      enabled?: boolean
    }) => {
      if (collectionsStore.has(id)) {
        throw new DuplicateException('Collection already exists')
      }
      const doc = new Doc<Collection>({
        $id: id,
        $collection: Database.METADATA,
        name: id,
        $permissions: (permissions ?? []).map((p) => p.toString()),
        documentSecurity: documentSecurity ?? true,
        enabled: enabled ?? true,
        attributes: [],
        indexes: [],
      })
      collectionsStore.set(id, doc)
      return doc
    },
    getCollection: async (id: string) => {
      return collectionsStore.get(id) ?? new Doc<Collection>()
    },
    updateCollection: async ({
      id,
      permissions,
      documentSecurity,
      enabled,
    }: {
      id: string
      permissions?: (string | Permission)[]
      documentSecurity?: boolean
      enabled?: boolean
    }) => {
      const existing = collectionsStore.get(id)
      if (!existing) {
        return new Doc<Collection>()
      }
      if (permissions !== undefined) existing.set('permissions', permissions)
      if (documentSecurity !== undefined) existing.set('documentSecurity', documentSecurity)
      if (enabled !== undefined) existing.set('enabled', enabled)
      return existing
    },
    deleteCollection: async (id: string) => {
      collectionsStore.delete(id)
    },
    system: () => ({
      find: async () => Array.from(collectionsStore.values()),
      count: async () => collectionsStore.size,
      updateDocument: async (_col: string, id: string, doc: Doc<Collection>) => {
        collectionsStore.set(id, doc)
        return doc
      },
    }),
  } as unknown as Database

  test('creates a collection and throws ConflictError on duplicate', async () => {
    const service = new CollectionsService()
    const col = await service.createCollection(mockDb, {
      collectionId: 'posts',
      name: 'Blog Posts',
      documentSecurity: true,
      enabled: true,
    })

    expect(col.getId()).toBe('posts')
    expect(col.get('name')).toBe('Blog Posts')

    await expect(
      service.createCollection(mockDb, {
        collectionId: 'posts',
        name: 'Duplicate',
      }),
    ).rejects.toThrow(ConflictError)
  })

  test('lists collections and gets single collection', async () => {
    const service = new CollectionsService()
    const list = await service.getCollections(mockDb)
    expect(list.total).toBe(1)
    expect(list.data[0]?.getId()).toBe('posts')

    const found = await service.getCollection(mockDb, 'posts')
    expect(found.getId()).toBe('posts')

    await expect(service.getCollection(mockDb, 'nonexistent')).rejects.toThrow(NotFoundError)
  })

  test('updates collection properties and removes collection', async () => {
    const service = new CollectionsService()
    const updated = await service.updateCollection(mockDb, 'posts', {
      name: 'Updated Posts',
      enabled: false,
    })
    expect(updated.get('name')).toBe('Updated Posts')
    expect(updated.get('enabled')).toBe(false)

    await service.removeCollection(mockDb, 'posts')
    expect(collectionsStore.has('posts')).toBe(false)

    await expect(service.removeCollection(mockDb, 'posts')).rejects.toThrow(NotFoundError)
  })
})
