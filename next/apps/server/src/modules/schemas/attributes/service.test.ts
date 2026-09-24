import { describe, expect, test } from 'bun:test'
import { type Attribute, AttributeType, type Database, Doc, RelationType } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../../shared/errors'
import { AttributesService, type CreateRelationAttributeInput } from './service'

describe('AttributesService', () => {
  const collectionDoc = new Doc({
    $id: 'articles',
    name: 'Articles',
    attributes: [] as Doc<Attribute>[],
  })

  const mockDb = {
    getCollection: async (id: string) => {
      if (id === 'articles' || id === 'authors') {
        return collectionDoc
      }
      return new Doc({})
    },
    createAttribute: async (_colId: string, attr: Attribute) => {
      const attrs = (collectionDoc.get('attributes') ?? []) as Doc<Attribute>[]
      const attrDoc = new Doc<Attribute>(attr)
      attrs.push(attrDoc)
      collectionDoc.set('attributes', attrs)
      return attrDoc
    },
    createRelationship: async (rel: CreateRelationAttributeInput) => {
      const attrs = (collectionDoc.get('attributes') ?? []) as Doc<Attribute>[]
      const relDoc = new Doc<Attribute>({
        $id: rel.key,
        key: rel.key,
        type: AttributeType.Relationship,
        options: {
          relationType: rel.relationType,
          side: 'parent',
          relatedCollection: rel.relatedCollection,
          twoWay: rel.twoWay,
          twoWayKey: rel.twoWayKey,
          onDelete: rel.onDelete ?? 'restrict',
        },
      })
      attrs.push(relDoc)
      collectionDoc.set('attributes', attrs)
      return true
    },
    updateAttributeRequired: async (_colId: string, key: string, req: boolean) => {
      const attrs = (collectionDoc.get('attributes') ?? []) as Doc<Attribute>[]
      const found = attrs.find((a) => a.get('key') === key)
      if (found) found.set('required', req)
    },
    deleteAttribute: async (_colId: string, key: string) => {
      const attrs = (collectionDoc.get('attributes') ?? []) as Doc<Attribute>[]
      collectionDoc.set(
        'attributes',
        attrs.filter((a) => a.get('key') !== key),
      )
    },
    deleteRelationship: async (_colId: string, key: string) => {
      const attrs = (collectionDoc.get('attributes') ?? []) as Doc<Attribute>[]
      collectionDoc.set(
        'attributes',
        attrs.filter((a) => a.get('key') !== key),
      )
    },
  } as unknown as Database

  test('creates various attribute types and prevents duplicate keys', async () => {
    const service = new AttributesService()

    // 1. String
    const titleAttr = await service.createStringAttribute(mockDb, 'articles', {
      key: 'title',
      size: 500,
      required: true,
    })
    expect(titleAttr.get('key')).toBe('title')
    expect(titleAttr.get('type')).toBe(AttributeType.String)

    // Duplicate check
    await expect(
      service.createStringAttribute(mockDb, 'articles', { key: 'title' }),
    ).rejects.toThrow(ConflictError)

    // 2. Email
    const emailAttr = await service.createEmailAttribute(mockDb, 'articles', {
      key: 'authorEmail',
    })
    expect(emailAttr.get('format')).toBe('email')

    // 3. Enum
    const statusAttr = await service.createEnumAttribute(mockDb, 'articles', {
      key: 'status',
      elements: ['draft', 'published', 'archived'],
    })
    expect(statusAttr.get('format')).toBe('enum')

    // 4. Integer
    const viewsAttr = await service.createIntegerAttribute(mockDb, 'articles', {
      key: 'views',
      min: 0,
      default: 0,
    })
    expect(viewsAttr.get('type')).toBe(AttributeType.Integer)

    // 5. Relationship
    const relAttr = await service.createRelationshipAttribute(mockDb, 'articles', {
      key: 'author',
      relatedCollection: 'authors',
      relationType: RelationType.ManyToOne,
    })
    expect(relAttr.get('type')).toBe(AttributeType.Relationship)
  })

  test('lists and gets attributes', async () => {
    const service = new AttributesService()
    const list = await service.getAttributes(mockDb, 'articles')
    expect(list.total).toBeGreaterThanOrEqual(5)

    const title = await service.getAttribute(mockDb, 'articles', 'title')
    expect(title.get('key')).toBe('title')

    await expect(service.getAttribute(mockDb, 'articles', 'nonexistent')).rejects.toThrow(
      NotFoundError,
    )
  })

  test('updates and deletes attributes', async () => {
    const service = new AttributesService()
    const updated = await service.updateAttribute(mockDb, 'articles', 'title', {
      required: false,
    })
    expect(updated.get('required')).toBe(false)

    await service.deleteAttribute(mockDb, 'articles', 'title')
    await expect(service.getAttribute(mockDb, 'articles', 'title')).rejects.toThrow(NotFoundError)
  })
})
