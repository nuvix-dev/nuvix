import { describe, expect, test } from 'bun:test'
import { Doc, DuplicateException, type Query, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { DocumentsService } from './service'

describe('DocumentsService', () => {
  const documentsStore = new Map<string, Doc>()

  const mockSession = {
    find: async (_collectionId: string, _queries: Query[] = []) => {
      return Array.from(documentsStore.values())
    },
    count: async (_collectionId: string, _queries: Query[] = []) => {
      return documentsStore.size
    },
    getDocument: async (_collectionId: string, id: string) => {
      return documentsStore.get(id) ?? new Doc({})
    },
    createDocument: async (_collectionId: string, doc: Doc) => {
      if (documentsStore.has(doc.getId())) {
        throw new DuplicateException('Document already exists')
      }
      documentsStore.set(doc.getId(), doc)
      return doc
    },
    updateDocument: async (_collectionId: string, id: string, doc: Doc) => {
      documentsStore.set(id, doc)
      return doc
    },
    deleteDocument: async (_collectionId: string, id: string) => {
      documentsStore.delete(id)
    },
  } as unknown as Session

  test('creates a document and handles duplicate error', async () => {
    const service = new DocumentsService()
    const user = new Doc({ $id: 'user_1' })

    const created = await service.createDocument(
      mockSession,
      'notes',
      {
        documentId: 'note_1',
        data: { title: 'First Note', content: 'Hello World' },
      },
      user,
    )

    expect(created.getId()).toBe('note_1')
    expect(created.get('title')).toBe('First Note')
    expect(created.getPermissions().length).toBeGreaterThan(0)

    await expect(
      service.createDocument(
        mockSession,
        'notes',
        {
          documentId: 'note_1',
          data: { title: 'Duplicate' },
        },
        user,
      ),
    ).rejects.toThrow(ConflictError)
  })

  test('lists documents and retrieves single document', async () => {
    const service = new DocumentsService()
    const list = await service.getDocuments(mockSession, 'notes')
    expect(list.total).toBe(1)
    expect(list.data[0]?.getId()).toBe('note_1')

    const doc = await service.getDocument(mockSession, 'notes', 'note_1')
    expect(doc.get('title')).toBe('First Note')

    await expect(service.getDocument(mockSession, 'notes', 'nonexistent')).rejects.toThrow(
      NotFoundError,
    )
  })

  test('updates and deletes document', async () => {
    const service = new DocumentsService()
    const updated = await service.updateDocument(mockSession, 'notes', 'note_1', {
      data: { title: 'Updated Title' },
    })
    expect(updated.get('title')).toBe('Updated Title')

    await service.deleteDocument(mockSession, 'notes', 'note_1')
    expect(documentsStore.has('note_1')).toBe(false)

    await expect(service.deleteDocument(mockSession, 'notes', 'note_1')).rejects.toThrow(
      NotFoundError,
    )
  })
})
