/**
 * E2E Test: Storage Flow
 *
 * This test covers the complete storage management journey:
 * 1. Authenticate with API key
 * 2. Create a storage bucket
 * 3. Upload a file to the bucket
 * 4. Get/download the file
 * 5. Delete the file
 * 6. Delete the bucket
 *
 * This flow represents how applications manage file storage.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../setup/app'
import { getApiKeyJsonHeaders, getApiKeyHeaders } from '../helpers/auth'
import { createUserAndSession } from '../helpers/auth'
import {
  buildCreateBucketDTO,
  buildUpdateBucketDTO,
} from '../factories/dto/bucket.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
  assertListResponse,
} from '../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { faker } from '@faker-js/faker'

describe('E2E: Storage Flow', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  it('completes the full bucket lifecycle (create, update, delete)', async () => {
    // =========================================================================
    // STEP 1: Create a new storage bucket
    // Buckets are containers for files with their own permissions and settings
    // =========================================================================
    const bucketDto = buildCreateBucketDTO({
      permissions: ['read("any")', 'create("any")'],
      maximumFileSize: 50 * 1024 * 1024, // 50MB
      allowedFileExtensions: ['jpg', 'png', 'gif', 'pdf', 'doc'],
      compression: 'gzip',
      encryption: true,
      antivirus: true,
    })

    const createBucketRes = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(bucketDto),
    })

    assertStatusCode(createBucketRes, 201)
    const createdBucket = parseJson(createBucketRes.payload)
    assertDocumentShape(createdBucket)

    // Verify bucket was created with correct properties
    expect(createdBucket).toMatchObject({
      $id: bucketDto.bucketId,
      name: bucketDto.name,
      enabled: bucketDto.enabled,
      maximumFileSize: bucketDto.maximumFileSize,
      encryption: bucketDto.encryption,
      antivirus: bucketDto.antivirus,
    })

    const bucketId = createdBucket.$id

    // =========================================================================
    // STEP 2: List all buckets and verify ours appears
    // =========================================================================
    const listBucketsRes = await app.inject({
      method: 'GET',
      url: '/v1/storage/buckets',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listBucketsRes, 200)
    const bucketsList = parseJson(listBucketsRes.payload)
    assertListResponse(bucketsList)

    const foundBucket = (bucketsList.data as any[]).find(
      b => b.$id === bucketId,
    )
    expect(foundBucket).toBeDefined()
    expect(foundBucket.name).toBe(bucketDto.name)

    // =========================================================================
    // STEP 3: Get bucket details
    // =========================================================================
    const getBucketRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${bucketId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getBucketRes, 200)
    const bucketDetails = parseJson(getBucketRes.payload)
    assertDocumentShape(bucketDetails)
    expect(bucketDetails.$id).toBe(bucketId)
    expect(bucketDetails.name).toBe(bucketDto.name)

    // =========================================================================
    // STEP 4: Update bucket settings
    // =========================================================================
    const updateDto = buildUpdateBucketDTO({
      name: 'Updated Bucket Name',
      maximumFileSize: 100 * 1024 * 1024, // 100MB
      enabled: true,
    })

    const updateBucketRes = await app.inject({
      method: 'PUT',
      url: `/v1/storage/buckets/${bucketId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(updateBucketRes, 200)
    const updatedBucket = parseJson(updateBucketRes.payload)
    expect(updatedBucket.name).toBe('Updated Bucket Name')
    expect(updatedBucket.maximumFileSize).toBe(100 * 1024 * 1024)

    // =========================================================================
    // STEP 5: Delete the bucket
    // =========================================================================
    const deleteBucketRes = await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${bucketId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(deleteBucketRes, 204)

    // =========================================================================
    // STEP 6: Verify bucket is gone
    // =========================================================================
    const verifyDeleteRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${bucketId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(verifyDeleteRes, 404)
  })

  it('completes the full file lifecycle (upload, get, update, delete)', async () => {
    // =========================================================================
    // STEP 1: Create a bucket for file storage
    // =========================================================================
    const bucketDto = buildCreateBucketDTO({
      permissions: [
        'read("any")',
        'create("any")',
        'update("any")',
        'delete("any")',
      ],
      maximumFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileExtensions: [], // Allow all
    })

    const createBucketRes = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(bucketDto),
    })

    assertStatusCode(createBucketRes, 201)
    const createdBucket = parseJson(createBucketRes.payload)
    const bucketId = createdBucket.$id

    // =========================================================================
    // STEP 2: Upload a file to the bucket
    // Simulating a text file upload
    // =========================================================================
    const fileContent = 'Hello, this is a test file content!'
    const fileName = 'test-document.txt'
    const fileId = faker.string.alphanumeric(12)

    // Create multipart form data for file upload
    const boundary = '----FormBoundary' + faker.string.alphanumeric(16)

    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      fileId,
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${bucketId}/files`,
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: formData,
    })

    assertStatusCode(uploadRes, 201)
    const uploadedFile = parseJson(uploadRes.payload)
    assertDocumentShape(uploadedFile)

    expect(uploadedFile.$id).toBe(fileId)
    expect(uploadedFile.name).toBe(fileName)
    expect(uploadedFile.mimeType).toBe('text/plain')
    expect(uploadedFile.sizeOriginal).toBeGreaterThan(0)

    // =========================================================================
    // STEP 3: List files in the bucket
    // =========================================================================
    const listFilesRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${bucketId}/files`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listFilesRes, 200)
    const filesList = parseJson(listFilesRes.payload)
    assertListResponse(filesList)

    const foundFile = (filesList.data as any[]).find(f => f.$id === fileId)
    expect(foundFile).toBeDefined()
    expect(foundFile.name).toBe(fileName)

    // =========================================================================
    // STEP 4: Get file metadata
    // =========================================================================
    const getFileRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${bucketId}/files/${fileId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getFileRes, 200)
    const fileMetadata = parseJson(getFileRes.payload)
    assertDocumentShape(fileMetadata)
    expect(fileMetadata.$id).toBe(fileId)
    expect(fileMetadata.name).toBe(fileName)

    // =========================================================================
    // STEP 5: Download/view the file content
    // =========================================================================
    const downloadRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${bucketId}/files/${fileId}/view`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(downloadRes, 200)
    expect(downloadRes.payload).toBe(fileContent)

    // =========================================================================
    // STEP 6: Update file metadata
    // =========================================================================
    const updateFileRes = await app.inject({
      method: 'PUT',
      url: `/v1/storage/buckets/${bucketId}/files/${fileId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        name: 'renamed-document.txt',
        permissions: ['read("any")'],
      }),
    })

    assertStatusCode(updateFileRes, 200)
    const updatedFile = parseJson(updateFileRes.payload)
    expect(updatedFile.name).toBe('renamed-document.txt')

    // =========================================================================
    // STEP 7: Delete the file
    // =========================================================================
    const deleteFileRes = await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${bucketId}/files/${fileId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(deleteFileRes, 204)

    // =========================================================================
    // STEP 8: Verify file is gone
    // =========================================================================
    const verifyFileDeleteRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${bucketId}/files/${fileId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(verifyFileDeleteRes, 404)

    // =========================================================================
    // STEP 9: Cleanup - delete the bucket
    // =========================================================================
    await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${bucketId}`,
      headers: getApiKeyHeaders(),
    })
  })

  it('handles file upload with session authentication', async () => {
    // =========================================================================
    // STEP 1: Create user session
    // =========================================================================
    const { sessionHeader, userId } = await createUserAndSession(app)

    // =========================================================================
    // STEP 2: Create a bucket with user-specific permissions
    // =========================================================================
    const bucketDto = buildCreateBucketDTO({
      permissions: [`read("user:${userId}")`, `create("user:${userId}")`],
      fileSecurity: true,
    })

    const createBucketRes = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(bucketDto),
    })

    assertStatusCode(createBucketRes, 201)
    const bucket = parseJson(createBucketRes.payload)
    const bucketId = bucket.$id

    // =========================================================================
    // STEP 3: Upload file using session auth
    // =========================================================================
    const fileName = 'user-file.txt'
    const fileContent = 'User uploaded content'
    const fileId = faker.string.alphanumeric(12)
    const boundary = '----FormBoundary' + faker.string.alphanumeric(16)

    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      fileId,
      `--${boundary}`,
      `Content-Disposition: form-data; name="permissions[]"`,
      '',
      `read("user:${userId}")`,
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${bucketId}/files`,
      headers: {
        'x-nuvix-session': sessionHeader,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: formData,
    })

    assertStatusCode(uploadRes, 201)
    const uploadedFile = parseJson(uploadRes.payload)
    expect(uploadedFile.name).toBe(fileName)

    // =========================================================================
    // STEP 4: User can access their own file
    // =========================================================================
    const getFileRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${bucketId}/files/${fileId}`,
      headers: {
        'x-nuvix-session': sessionHeader,
      },
    })

    assertStatusCode(getFileRes, 200)
    const fileData = parseJson(getFileRes.payload)
    expect(fileData.$id).toBe(fileId)

    // =========================================================================
    // Cleanup
    // =========================================================================
    await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${bucketId}/files/${fileId}`,
      headers: getApiKeyHeaders(),
    })

    await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${bucketId}`,
      headers: getApiKeyHeaders(),
    })
  })

  it('enforces bucket-level file size limits', async () => {
    // =========================================================================
    // Create bucket with small file size limit
    // =========================================================================
    const bucketDto = buildCreateBucketDTO({
      maximumFileSize: 100, // 100 bytes max
      permissions: ['create("any")'],
    })

    const createBucketRes = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(bucketDto),
    })

    assertStatusCode(createBucketRes, 201)
    const bucket = parseJson(createBucketRes.payload)
    const bucketId = bucket.$id

    // =========================================================================
    // Try to upload a file that exceeds the limit
    // =========================================================================
    const largeContent = 'x'.repeat(200) // 200 bytes
    const fileId = faker.string.alphanumeric(12)
    const boundary = '----FormBoundary' + faker.string.alphanumeric(16)

    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      fileId,
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="large-file.txt"`,
      'Content-Type: text/plain',
      '',
      largeContent,
      `--${boundary}--`,
    ].join('\r\n')

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${bucketId}/files`,
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: formData,
    })

    // Should fail due to size limit
    assertStatusCode(uploadRes, 400)

    // =========================================================================
    // Cleanup
    // =========================================================================
    await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${bucketId}`,
      headers: getApiKeyHeaders(),
    })
  })

  it('requires authentication for all storage operations', async () => {
    // =========================================================================
    // List buckets without auth
    // =========================================================================
    const listBucketsRes = await app.inject({
      method: 'GET',
      url: '/v1/storage/buckets',
    })

    assertStatusCode(listBucketsRes, 401)

    // =========================================================================
    // Create bucket without auth
    // =========================================================================
    const createBucketRes = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(buildCreateBucketDTO()),
    })

    assertStatusCode(createBucketRes, 401)
  })

  it('handles non-existent bucket gracefully', async () => {
    const nonExistentId = 'nonexistent_bucket_id'

    // =========================================================================
    // Get non-existent bucket
    // =========================================================================
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${nonExistentId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getRes, 404)

    // =========================================================================
    // Update non-existent bucket
    // =========================================================================
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/storage/buckets/${nonExistentId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({ name: 'New Name' }),
    })

    assertStatusCode(updateRes, 404)

    // =========================================================================
    // Delete non-existent bucket
    // =========================================================================
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${nonExistentId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(deleteRes, 404)
  })
})
