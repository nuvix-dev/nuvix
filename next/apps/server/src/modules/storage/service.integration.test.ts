import { describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { bootstrapAuthSchema } from '@nuvix/core/tenant-auth'
import { DockerTenantProvisioner, TenantResource } from '@nuvix/core/tenants'
import { Local } from '@nuvix/storage'
import { StorageService } from './service'

async function dockerAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['docker', 'image', 'inspect', 'nuvix/postgres:18.1'], {
      stdout: 'ignore',
      stderr: 'ignore',
    })
    return (await proc.exited) === 0
  } catch {
    return false
  }
}

const hasDocker = await dockerAvailable()

describe.skipIf(!hasDocker)('StorageService live integration (nuvix/postgres:18.1 + Local)', () => {
  it('executes full bucket and file lifecycle against real PostgreSQL 18 and local disk', async () => {
    const provisioner = new DockerTenantProvisioner()
    const projectId = `it-storage-${crypto.randomUUID().slice(0, 8)}`
    const { handle, target } = await provisioner.provision({ projectId })

    const tempDir = path.join(import.meta.dir, `../../../../../.tmp/test-storage-${projectId}`)
    await fs.mkdir(tempDir, { recursive: true })

    try {
      await provisioner.waitUntilReady(target, { timeoutMs: 30_000 })
      await bootstrapAuthSchema(target)

      const resource = new TenantResource(projectId, target)
      try {
        const authSession = resource.authSession(['any', 'users', 'role:admin'])
        const device = new Local(tempDir)
        const service = new StorageService(authSession, device)

        // 1. Create a bucket
        const bucket = await service.createBucket({
          bucketId: 'it_bucket',
          name: 'Integration Bucket',
          maximumFileSize: 5 * 1024 * 1024,
          allowedFileExtensions: ['txt', 'png', 'jpg'],
        })
        expect(bucket.$id).toBe('it_bucket')
        expect(bucket.name).toBe('Integration Bucket')

        // 2. Upload a file
        const content = Buffer.from('Integration test file content')
        const file = await service.createFile('it_bucket', {
          fileId: 'it_file',
          name: 'hello.txt',
          mimeType: 'text/plain',
          buffer: content,
        })
        expect(file.$id).toBe('it_file')
        expect(file.sizeOriginal).toBe(content.length)

        // 3. Read back file content
        const readBack = await service.readFile('it_bucket', 'it_file')
        expect(readBack.buffer.toString('utf-8')).toBe('Integration test file content')

        // 4. List files
        const fileList = await service.listFiles('it_bucket')
        expect(fileList.total).toBe(1)
        expect(fileList.files[0]?.$id).toBe('it_file')

        // 5. Delete file
        await service.deleteFile('it_bucket', 'it_file')
        const emptyFileList = await service.listFiles('it_bucket')
        expect(emptyFileList.total).toBe(0)

        // 6. Delete bucket
        await service.deleteBucket('it_bucket')
        const bucketList = await service.listBuckets()
        expect(bucketList.buckets.some((b) => b.$id === 'it_bucket')).toBe(false)
      } finally {
        await resource.close()
      }
    } finally {
      await provisioner.deprovision(handle, { purge: true })
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  }, 60_000)
})
