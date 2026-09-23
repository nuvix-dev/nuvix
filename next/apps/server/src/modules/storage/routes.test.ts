import { describe, expect, it } from 'bun:test'
import { treaty } from '@elysia/eden'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { storageRoutes } from './routes'
import type { StorageService } from './service'
import type {
  BucketView,
  CreateBucketInput,
  CreateFileInput,
  FileView,
  StorageCallerAuth,
  UpdateBucketInput,
  UpdateFileInput,
} from './types'

describe('storage routes', () => {
  let currentAuth: StorageCallerAuth = {
    isAdmin: true,
    isApiKey: false,
    roles: ['admin'],
    userId: 'u_admin',
  }

  const bucketsStore = new Map<string, BucketView>()
  const filesStore = new Map<string, FileView>()
  const fileContents = new Map<string, Buffer>()

  const mockService: StorageService = {
    listBuckets: () =>
      Promise.resolve({
        buckets: Array.from(bucketsStore.values()),
        total: bucketsStore.size,
      }),
    getBucket: (bucketId: string) => {
      const b = bucketsStore.get(bucketId)
      if (!b) return Promise.reject(new Error('Bucket not found'))
      return Promise.resolve(b)
    },
    createBucket: (input: CreateBucketInput) => {
      const bucket: BucketView = {
        $id: input.bucketId || 'b_created',
        name: input.name,
        permissions: input.permissions || [],
        fileSecurity: input.fileSecurity !== false,
        enabled: input.enabled !== false,
        maximumFileSize: input.maximumFileSize || 31457280,
        allowedFileExtensions: input.allowedFileExtensions || [],
        compression: input.compression || 'none',
        encryption: input.encryption || false,
        antivirus: input.antivirus || false,
      }
      bucketsStore.set(bucket.$id, bucket)
      return Promise.resolve(bucket)
    },
    updateBucket: (bucketId: string, input: UpdateBucketInput) => {
      const b = bucketsStore.get(bucketId)
      if (!b) return Promise.reject(new Error('Bucket not found'))
      const updated = { ...b, name: input.name }
      bucketsStore.set(bucketId, updated)
      return Promise.resolve(updated)
    },
    deleteBucket: (bucketId: string) => {
      bucketsStore.delete(bucketId)
      return Promise.resolve()
    },
    listFiles: (bucketId: string) => {
      const files = Array.from(filesStore.values()).filter((f) => f.bucketId === bucketId)
      return Promise.resolve({ files, total: files.length })
    },
    getFile: (bucketId: string, fileId: string) => {
      const f = filesStore.get(fileId)
      if (!f || f.bucketId !== bucketId) return Promise.reject(new Error('File not found'))
      return Promise.resolve(f)
    },
    createFile: (bucketId: string, input: CreateFileInput) => {
      const fileId = input.fileId || 'f_created'
      const file: FileView = {
        $id: fileId,
        bucketId,
        name: input.name,
        signature: 'sig123',
        mimeType: input.mimeType,
        sizeOriginal: input.buffer.length,
        chunksTotal: 1,
        chunksUploaded: 1,
        permissions: input.permissions || [],
      }
      filesStore.set(fileId, file)
      fileContents.set(`${bucketId}/${fileId}`, input.buffer)
      return Promise.resolve(file)
    },
    readFile: (bucketId: string, fileId: string) => {
      const file = filesStore.get(fileId)
      if (!file || file.bucketId !== bucketId) return Promise.reject(new Error('File not found'))
      const buffer = fileContents.get(`${bucketId}/${fileId}`) || Buffer.from('')
      return Promise.resolve({ file, buffer })
    },
    previewFile: (bucketId: string, fileId: string) => {
      const file = filesStore.get(fileId)
      if (!file || file.bucketId !== bucketId) return Promise.reject(new Error('File not found'))
      const buffer = fileContents.get(`${bucketId}/${fileId}`) || Buffer.from('')
      return Promise.resolve({ buffer, mimeType: file.mimeType })
    },
    updateFile: (bucketId: string, fileId: string, input: UpdateFileInput) => {
      const file = filesStore.get(fileId)
      if (!file || file.bucketId !== bucketId) return Promise.reject(new Error('File not found'))
      const updated = { ...file, ...(input.name ? { name: input.name } : {}) }
      filesStore.set(fileId, updated)
      return Promise.resolve(updated)
    },
    deleteFile: (bucketId: string, fileId: string) => {
      filesStore.delete(fileId)
      fileContents.delete(`${bucketId}/${fileId}`)
      return Promise.resolve()
    },
  } as unknown as StorageService

  const app = new Elysia({ prefix: '/v2' })
    .use(
      problemErrors({
        getTranslator: () =>
          Promise.resolve({
            format: (k: string) => k,
          }) as never,
      }),
    )
    .use(storageRoutes(mockService, () => currentAuth))

  const client = treaty(app)

  it('POST /storage/buckets creates a bucket', async () => {
    currentAuth = { isAdmin: true, isApiKey: false, roles: ['admin'] }
    const { data, status } = await client.v2.storage.buckets.post({
      bucketId: 'b_main',
      name: 'Main Bucket',
      maximumFileSize: 1048576,
    })

    expect(status).toBe(200)
    expect(data?.$id).toBe('b_main')
    expect(data?.name).toBe('Main Bucket')
  })

  it('POST /storage/buckets rejects non-admin with 403', async () => {
    currentAuth = { isAdmin: false, isApiKey: false, roles: ['users'] }
    const { status } = await client.v2.storage.buckets.post({
      name: 'Hacker Bucket',
    })
    expect(status).toBe(403)
  })

  it('GET /storage/buckets lists buckets', async () => {
    currentAuth = { isAdmin: false, roles: ['users'] }
    const { data, status } = await client.v2.storage.buckets.get()
    expect(status).toBe(200)
    expect(data?.meta.total).toBe(1)
    expect(data?.data[0]?.name).toBe('Main Bucket')
  })

  it('GET /storage/buckets/:bucketId gets bucket', async () => {
    const { data, status } = await client.v2.storage.buckets({ bucketId: 'b_main' }).get()
    expect(status).toBe(200)
    expect(data?.name).toBe('Main Bucket')
  })

  it('PUT /storage/buckets/:bucketId updates bucket', async () => {
    currentAuth = { isAdmin: true, roles: ['admin'] }
    const { data, status } = await client.v2.storage
      .buckets({ bucketId: 'b_main' })
      .put({ name: 'Renamed Bucket' })
    expect(status).toBe(200)
    expect(data?.name).toBe('Renamed Bucket')
  })

  it('POST /storage/buckets/:bucketId/files uploads a file', async () => {
    currentAuth = { isAdmin: false, roles: ['users'], userId: 'u_user' }
    const file = new File([Buffer.from('test file data')], 'document.pdf', {
      type: 'application/pdf',
    })

    const { data, status } = await client.v2.storage.buckets({ bucketId: 'b_main' }).files.post({
      fileId: 'f_doc',
      file,
    })

    expect(status).toBe(200)
    expect(data?.$id).toBe('f_doc')
    expect(data?.name).toBe('document.pdf')
    expect(data?.sizeOriginal).toBe(14)
  })

  it('GET /storage/buckets/:bucketId/files lists files in bucket', async () => {
    const { data, status } = await client.v2.storage.buckets({ bucketId: 'b_main' }).files.get()
    expect(status).toBe(200)
    expect(data?.meta.total).toBe(1)
    expect(data?.data[0]?.name).toBe('document.pdf')
  })

  it('GET /storage/buckets/:bucketId/files/:fileId gets file metadata', async () => {
    const { data, status } = await client.v2.storage
      .buckets({ bucketId: 'b_main' })
      .files({ fileId: 'f_doc' })
      .get()
    expect(status).toBe(200)
    expect(data?.$id).toBe('f_doc')
    expect(data?.name).toBe('document.pdf')
  })

  it('GET /storage/buckets/:bucketId/files/:fileId/download downloads file', async () => {
    const res = await app.handle(
      new Request('http://localhost/v2/storage/buckets/b_main/files/f_doc/download'),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('attachment;')
    const text = await res.text()
    expect(text).toBe('test file data')
  })

  it('GET /storage/buckets/:bucketId/files/:fileId/view views file inline', async () => {
    const res = await app.handle(
      new Request('http://localhost/v2/storage/buckets/b_main/files/f_doc/view'),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toBe('inline')
    const text = await res.text()
    expect(text).toBe('test file data')
  })

  it('PUT /storage/buckets/:bucketId/files/:fileId updates file', async () => {
    const { data, status } = await client.v2.storage
      .buckets({ bucketId: 'b_main' })
      .files({ fileId: 'f_doc' })
      .put({ name: 'renamed.pdf' })
    expect(status).toBe(200)
    expect(data?.name).toBe('renamed.pdf')
  })

  it('DELETE /storage/buckets/:bucketId/files/:fileId deletes file', async () => {
    const { status } = await client.v2.storage
      .buckets({ bucketId: 'b_main' })
      .files({ fileId: 'f_doc' })
      .delete()
    expect(status).toBe(204)
  })

  it('DELETE /storage/buckets/:bucketId deletes bucket', async () => {
    currentAuth = { isAdmin: true, roles: ['admin'] }
    const { status } = await client.v2.storage.buckets({ bucketId: 'b_main' }).delete()
    expect(status).toBe(204)
  })
})
