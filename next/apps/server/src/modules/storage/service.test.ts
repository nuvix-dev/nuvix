import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import type { Device } from '@nuvix/storage'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { FilesService } from './files.service'
import { StorageService } from './service'

function createInMemorySession(roles: string[] = ['role:all', 'user:user_1']) {
  const store = new Map<string, Map<string, Doc>>()

  const getCollection = (name: string) => {
    let col = store.get(name)
    if (!col) {
      col = new Map()
      store.set(name, col)
    }
    return col
  }

  const session = {
    ctx: { roles },
    find: async (collection: string, queries: Array<{ values?: unknown[] }> = []) => {
      const col = getCollection(collection)
      const all = [...col.values()]
      if (queries.length === 0) return all
      return all.filter((doc) => {
        for (const q of queries) {
          if (q.values && q.values.length > 0) {
            const val = q.values[0]
            const match =
              doc.get('bucketId') === val || doc.get('name') === val || doc.getId() === val
            if (!match) return false
          }
        }
        return true
      })
    },
    getDocument: async (collection: string, id: string) => {
      const col = getCollection(collection)
      return col.get(id) ?? new Doc({})
    },
    createDocument: async (collection: string, doc: Doc) => {
      const col = getCollection(collection)
      col.set(doc.getId(), doc)
      return doc
    },
    updateDocument: async (collection: string, id: string, doc: Doc) => {
      const col = getCollection(collection)
      col.set(id, doc)
      return doc
    },
    deleteDocument: async (collection: string, id: string) => {
      const col = getCollection(collection)
      col.delete(id)
      return true
    },
    count: async (collection: string) => {
      return getCollection(collection).size
    },
    sum: async (collection: string, attribute: string) => {
      const col = getCollection(collection)
      let total = 0
      for (const doc of col.values()) {
        total += Number(doc.get(attribute) ?? 0)
      }
      return total
    },
  } as unknown as Session

  return { store, session }
}

const mockDevice: Device = {
  getPath: (filename: string) => `/tmp/storage/${filename}`,
  createDirectory: async () => true,
  deletePath: async () => true,
  delete: async () => true,
  exists: async () => true,
  read: async () => Buffer.from('test content'),
  write: async () => true,
  upload: async () => 1,
  getFileHash: async () => 'hash_abc123',
  abort: async () => true,
} as unknown as Device

describe('Storage Module Services', () => {
  describe('StorageService (Buckets)', () => {
    it('creates a bucket', async () => {
      const { session } = createInMemorySession()
      const service = new StorageService(session, mockDevice)

      const bucket = await service.createBucket({
        name: 'Images',
        enabled: true,
        maximumFileSize: 10_000_000,
      })

      expect(bucket.name).toBe('Images')
      expect(bucket.enabled).toBe(true)
      expect(bucket.maximumFileSize).toBe(10_000_000)
      expect(bucket.$id).toBeDefined()
    })

    it('rejects duplicate bucket creation', async () => {
      const { session } = createInMemorySession()
      const service = new StorageService(session, mockDevice)

      await service.createBucket({
        bucketId: 'unique_b1',
        name: 'Images',
      })

      await expect(
        service.createBucket({
          bucketId: 'unique_b1',
          name: 'Images Duplicate',
        }),
      ).rejects.toThrow(ConflictError)
    })

    it('gets a bucket by id', async () => {
      const { session } = createInMemorySession()
      const service = new StorageService(session, mockDevice)

      const created = await service.createBucket({
        bucketId: 'b_test',
        name: 'Test Bucket',
      })

      const fetched = await service.getBucket(created.$id)
      expect(fetched.name).toBe('Test Bucket')
    })

    it('throws NotFoundError for non-existent bucket', async () => {
      const { session } = createInMemorySession()
      const service = new StorageService(session, mockDevice)

      await expect(service.getBucket('missing')).rejects.toThrow(NotFoundError)
    })

    it('updates a bucket', async () => {
      const { session } = createInMemorySession()
      const service = new StorageService(session, mockDevice)

      const created = await service.createBucket({
        bucketId: 'b_update',
        name: 'Initial Name',
      })

      const updated = await service.updateBucket(created.$id, {
        name: 'Updated Name',
        fileSecurity: true,
      })

      expect(updated.name).toBe('Updated Name')
      expect(updated.fileSecurity).toBe(true)
    })

    it('deletes a bucket', async () => {
      const { session } = createInMemorySession()
      const service = new StorageService(session, mockDevice)

      const created = await service.createBucket({
        bucketId: 'b_delete',
        name: 'To Delete',
      })

      await service.deleteBucket(created.$id)
      await expect(service.getBucket(created.$id)).rejects.toThrow(NotFoundError)
    })

    it('returns storage usage stats', async () => {
      const { session } = createInMemorySession()
      const service = new StorageService(session, mockDevice)

      await service.createBucket({ bucketId: 'b1', name: 'Bucket 1' })
      const usage = await service.getStorageUsage('30d')

      expect(usage.range).toBe('30d')
      expect(usage.bucketsTotal).toBe(1)
      expect(usage.filesTotal).toBe(0)
    })
  })

  describe('FilesService', () => {
    it('lists files in a bucket', async () => {
      const { session: scopedSession } = createInMemorySession()
      const { session: systemSession } = createInMemorySession()
      const filesService = new FilesService(scopedSession, systemSession, mockDevice)

      // Create bucket in system session
      await systemSession.createDocument(
        'buckets',
        new Doc({
          $id: 'b1',
          name: 'Public Bucket',
          enabled: true,
          $permissions: ['read("role:all")'],
        }),
      )

      const result = await filesService.getFiles('b1', { isAPIUser: false, isAdmin: false })
      expect(result.total).toBe(0)
      expect(result.files).toHaveLength(0)
    })

    it('creates and serves a file', async () => {
      const { session: scopedSession } = createInMemorySession()
      const { session: systemSession } = createInMemorySession()
      const filesService = new FilesService(scopedSession, systemSession, mockDevice)

      await systemSession.createDocument(
        'buckets',
        new Doc({
          $id: 'b1',
          name: 'Files Bucket',
          enabled: true,
          maximumFileSize: 30_000_000,
          $permissions: ['create("role:all")', 'read("role:all")', 'delete("role:all")'],
        }),
      )

      // Create a small temp file for upload test
      const tmpPath = `/tmp/test-upload-${Date.now()}.txt`
      await Bun.write(tmpPath, 'Hello Nuvix Storage')

      const file = await filesService.createFile(
        'b1',
        { fileId: 'f1' },
        { filepath: tmpPath, filename: 'hello.txt', mimetype: 'text/plain' },
        { isAPIUser: false, isAdmin: false },
        undefined,
        undefined,
        'user_1',
      )

      expect(file.$id).toBe('f1')
      expect(file.name).toBe('hello.txt')
      expect(file.mimeType).toBe('text/plain')

      // Serve file
      const served = await filesService.serveFile(
        'b1',
        'f1',
        { isAPIUser: false, isAdmin: false },
        'attachment',
      )
      expect(served.fileName).toBe('hello.txt')
      expect(served.mimeType).toBe('text/plain')

      // Delete file
      await filesService.deleteFile('b1', 'f1', { isAPIUser: false, isAdmin: false })
    })

    it('throws NotFoundError for file in non-existent bucket', async () => {
      const { session: scopedSession } = createInMemorySession()
      const { session: systemSession } = createInMemorySession()
      const filesService = new FilesService(scopedSession, systemSession, mockDevice)

      await expect(
        filesService.getFile('missing_b', 'f1', { isAPIUser: false, isAdmin: false }),
      ).rejects.toThrow(NotFoundError)
    })
  })
})
