import { describe, expect, test } from 'bun:test'
import { type Database, Doc, type Index, IndexType, Order } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { IndexesService } from './service'

describe('IndexesService', () => {
  const collectionDoc = new Doc({
    $id: 'products',
    name: 'Products',
    indexes: [] as Doc<Index>[],
  })

  const mockDb = {
    getCollection: async (id: string) => {
      if (id === 'products') return collectionDoc
      return new Doc({})
    },
    createIndex: async (
      _colId: string,
      key: string,
      type: IndexType,
      attributes: string[],
      orders: string[],
    ) => {
      const idxs = (collectionDoc.get('indexes') ?? []) as Doc<Index>[]
      const idxDoc = new Doc<Index>({ $id: key, key, type, attributes, orders })
      idxs.push(idxDoc)
      collectionDoc.set('indexes', idxs)
      return idxDoc
    },
    deleteIndex: async (_colId: string, key: string) => {
      const idxs = (collectionDoc.get('indexes') ?? []) as Doc<Index>[]
      collectionDoc.set(
        'indexes',
        idxs.filter((i) => i.get('key') !== key),
      )
    },
  } as unknown as Database

  test('creates index and prevents duplicates with ConflictError', async () => {
    const service = new IndexesService()

    const created = await service.createIndex(mockDb, 'products', {
      key: 'idx_sku',
      type: IndexType.Unique,
      attributes: ['sku'],
      orders: [Order.Asc],
    })

    expect(created.get('key')).toBe('idx_sku')
    expect(created.get('type')).toBe(IndexType.Unique)

    await expect(
      service.createIndex(mockDb, 'products', {
        key: 'idx_sku',
        type: IndexType.Key,
        attributes: ['sku'],
      }),
    ).rejects.toThrow(ConflictError)
  })

  test('lists, gets, and deletes indexes', async () => {
    const service = new IndexesService()
    const list = await service.getIndexes(mockDb, 'products')
    expect(list.total).toBe(1)
    expect(list.data[0]!.get('key')).toBe('idx_sku')

    const found = await service.getIndex(mockDb, 'products', 'idx_sku')
    expect(found.get('key')).toBe('idx_sku')

    await expect(service.getIndex(mockDb, 'products', 'nonexistent')).rejects.toThrow(NotFoundError)

    await service.deleteIndex(mockDb, 'products', 'idx_sku')
    await expect(service.getIndex(mockDb, 'products', 'idx_sku')).rejects.toThrow(NotFoundError)
  })
})
