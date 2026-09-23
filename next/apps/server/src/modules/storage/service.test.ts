import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import type { Device } from '@nuvix/storage'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors'
import { StorageService } from './service'

describe('StorageService', () => {
  const bucketsStore = new Map<string, Doc<Record<string, unknown>>>()
  const filesStore = new Map<string, Doc<Record<string, unknown>>>()
  const storageFiles = new Map<string, Buffer>()

  const mockDevice: Device = {
    write: (path: string, data: string | Buffer) => {
      storageFiles.set(path, Buffer.isBuffer(data) ? data : Buffer.from(data))
      return Promise.resolve(true)
    },
    read: (path: string) => {
      const buf = storageFiles.get(path)
      if (!buf) return Promise.reject(new Error('File not found'))
      return Promise.resolve(buf)
    },
    delete: (path: string) => {
      storageFiles.delete(path)
      return Promise.resolve(true)
    },
    exists: (path: string) => Promise.resolve(storageFiles.has(path)),
  } as unknown as Device

  const mockSession: Session = {
    find: (col: string) => {
      if (col === 'buckets') return Promise.resolve(Array.from(bucketsStore.values()))
      if (col === 'files') return Promise.resolve(Array.from(filesStore.values()))
      return Promise.resolve([])
    },
    count: (col: string) => {
      if (col === 'buckets') return Promise.resolve(bucketsStore.size)
      if (col === 'files') return Promise.resolve(filesStore.size)
      return Promise.resolve(0)
    },
    getDocument: (col: string, id: string) => {
      const store = col === 'buckets' ? bucketsStore : filesStore
      const doc = store.get(id)
      if (!doc) return Promise.resolve(new Doc({}))
      return Promise.resolve(doc)
    },
    createDocument: (col: string, doc: Doc<Record<string, unknown>>) => {
      const store = col === 'buckets' ? bucketsStore : filesStore
      store.set(doc.getId(), doc)
      return Promise.resolve(doc)
    },
    updateDocument: (col: string, id: string, doc: Doc<Record<string, unknown>>) => {
      const store = col === 'buckets' ? bucketsStore : filesStore
      store.set(id, doc)
      return Promise.resolve(doc)
    },
    deleteDocument: (col: string, id: string) => {
      const store = col === 'buckets' ? bucketsStore : filesStore
      store.delete(id)
      return Promise.resolve(true)
    },
  } as unknown as Session

  const service = new StorageService(mockSession, mockDevice)

  it('creates and retrieves a bucket', async () => {
    const bucket = await service.createBucket(
      {
        bucketId: 'b_test',
        name: 'Test Bucket',
        allowedFileExtensions: ['png', 'jpg'],
        maximumFileSize: 1024 * 1024,
      },
      'u_owner',
    )

    expect(bucket.$id).toBe('b_test')
    expect(bucket.name).toBe('Test Bucket')
    expect(bucket.allowedFileExtensions).toEqual(['png', 'jpg'])

    const fetched = await service.getBucket('b_test')
    expect(fetched.$id).toBe('b_test')
    expect(fetched.name).toBe('Test Bucket')
  })

  it('rejects duplicate bucket creation', async () => {
    await expect(
      service.createBucket({
        bucketId: 'b_test',
        name: 'Duplicate',
      }),
    ).rejects.toThrow(ConflictError)
  })

  it('updates bucket properties', async () => {
    const updated = await service.updateBucket('b_test', {
      name: 'Updated Name',
      maximumFileSize: 2 * 1024 * 1024,
    })

    expect(updated.name).toBe('Updated Name')
    expect(updated.maximumFileSize).toBe(2 * 1024 * 1024)
  })

  it('lists buckets with total', async () => {
    const list = await service.listBuckets()
    expect(list.total).toBe(1)
    expect(list.buckets[0]?.name).toBe('Updated Name')
  })

  it('creates and uploads a file to bucket', async () => {
    const content = Buffer.from('hello storage')
    const file = await service.createFile(
      'b_test',
      {
        fileId: 'f_test',
        name: 'greeting.png',
        mimeType: 'image/png',
        buffer: content,
      },
      'u_owner',
    )

    expect(file.$id).toBe('f_test')
    expect(file.bucketId).toBe('b_test')
    expect(file.name).toBe('greeting.png')
    expect(file.sizeOriginal).toBe(content.length)
    expect(storageFiles.has('b_test/f_test')).toBe(true)
  })

  it('rejects file upload exceeding max size', async () => {
    const largeContent = Buffer.alloc(3 * 1024 * 1024)
    await expect(
      service.createFile('b_test', {
        name: 'large.png',
        mimeType: 'image/png',
        buffer: largeContent,
      }),
    ).rejects.toThrow(BadRequestError)
  })

  it('rejects file upload with disallowed extension', async () => {
    const content = Buffer.from('evil script')
    await expect(
      service.createFile('b_test', {
        name: 'script.exe',
        mimeType: 'application/x-msdownload',
        buffer: content,
      }),
    ).rejects.toThrow(BadRequestError)
  })

  it('reads file content back from storage', async () => {
    const { file, buffer } = await service.readFile('b_test', 'f_test')
    expect(file.$id).toBe('f_test')
    expect(buffer.toString('utf-8')).toBe('hello storage')
  })

  it('updates file metadata', async () => {
    const updated = await service.updateFile('b_test', 'f_test', {
      name: 'new_greeting.png',
    })
    expect(updated.name).toBe('new_greeting.png')
  })

  it('deletes file from storage and database', async () => {
    await service.deleteFile('b_test', 'f_test')
    expect(storageFiles.has('b_test/f_test')).toBe(false)
    await expect(service.getFile('b_test', 'f_test')).rejects.toThrow(NotFoundError)
  })

  it('deletes bucket and cascades file cleanup', async () => {
    // create a file again
    await service.createFile('b_test', {
      fileId: 'f_cascade',
      name: 'cascade.png',
      mimeType: 'image/png',
      buffer: Buffer.from('cascade file'),
    })
    expect(storageFiles.has('b_test/f_cascade')).toBe(true)

    await service.deleteBucket('b_test')
    expect(storageFiles.has('b_test/f_cascade')).toBe(false)
    await expect(service.getBucket('b_test')).rejects.toThrow(NotFoundError)
  })
})
