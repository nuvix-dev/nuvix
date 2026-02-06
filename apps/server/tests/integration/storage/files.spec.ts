import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildCreateBucketDTO } from '../../factories/dto/bucket.factory'
import { buildUpdateFileDTO } from '../../factories/dto/file.factory'
import { getApiKeyHeaders, getApiKeyJsonHeaders } from '../../helpers/auth'
import { getApp } from '../../setup/app'
import {
  assertDocumentShape,
  assertListResponse,
  assertStatusCode,
  parseJson,
} from '../../setup/test-utils'

describe('storage/files (integration)', () => {
  let app: NestFastifyApplication
  let testBucketId: string

  beforeAll(async () => {
    app = await getApp()

    // Create a bucket to use for file tests
    const bucketDto = buildCreateBucketDTO()
    testBucketId = bucketDto.bucketId

    const res = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(bucketDto),
    })
    assertStatusCode(res, 201)
  })

  /**
   * AUTH BOUNDARY TESTS
   * File endpoints require authentication
   */

  it('GET /v1/storage/buckets/:bucketId/files returns 401 when unauthenticated', async () => {
    // PROTECTS: File list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${testBucketId}/files`,
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/storage/buckets/:bucketId/files returns 401 when unauthenticated', async () => {
    // PROTECTS: File creation requires authentication
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW'
    const fileContent = 'Test file content'
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      'testfile123',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    const res = await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${testBucketId}/files`,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })

    assertStatusCode(res, 401)
  })

  /**
   * FILE LISTING TESTS
   */

  it('GET /v1/storage/buckets/:bucketId/files returns 200 and list shape with API key', async () => {
    // PROTECTS: File listing returns proper list format
    const res = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${testBucketId}/files`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  it('GET /v1/storage/buckets/:bucketId/files returns 404 for non-existent bucket', async () => {
    // PROTECTS: 404 for unknown bucket
    const res = await app.inject({
      method: 'GET',
      url: '/v1/storage/buckets/nonexistentbucket/files',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * FILE CREATION TESTS
   */

  it('POST /v1/storage/buckets/:bucketId/files returns 201 for valid file upload', async () => {
    // PROTECTS: File creation contract
    const fileId = `testfile${Date.now()}`
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW'
    const fileContent = 'Test file content for upload'

    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      fileId,
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    const res = await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${testBucketId}/files`,
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })

    assertStatusCode(res, 201)

    const resBody = parseJson(res.payload)
    assertDocumentShape(resBody)
    expect(resBody.$id).toBe(fileId)
  })

  it('POST /v1/storage/buckets/:bucketId/files returns 400 for missing fileId', async () => {
    // PROTECTS: Required field validation
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW'
    const fileContent = 'Test file content'

    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    const res = await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${testBucketId}/files`,
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/storage/buckets/:bucketId/files returns 404 for non-existent bucket', async () => {
    // PROTECTS: 404 for unknown bucket when uploading
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW'
    const fileContent = 'Test file content'

    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      'testfile123',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    const res = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets/nonexistentbucket/files',
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })

    assertStatusCode(res, 404)
  })

  /**
   * FILE RETRIEVAL TESTS
   */

  it('GET /v1/storage/buckets/:bucketId/files/:fileId returns 200 for existing file', async () => {
    // PROTECTS: Single file retrieval works correctly
    const fileId = `getfile${Date.now()}`
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW'
    const fileContent = 'Test file content for get'

    // Create file first
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      fileId,
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${testBucketId}/files`,
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })

    // Retrieve it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${testBucketId}/files/${fileId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const resBody = parseJson(res.payload)
    assertDocumentShape(resBody)
    expect(resBody.$id).toBe(fileId)
  })

  it('GET /v1/storage/buckets/:bucketId/files/:fileId returns 404 for non-existent file', async () => {
    // PROTECTS: 404 for unknown file ID
    const res = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${testBucketId}/files/nonexistentfile`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * FILE UPDATE TESTS
   */

  it('PUT /v1/storage/buckets/:bucketId/files/:fileId returns 200 and updates file', async () => {
    // PROTECTS: File update works correctly
    const fileId = `updatefile${Date.now()}`
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW'
    const fileContent = 'Test file content for update'

    // Create file first
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      fileId,
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${testBucketId}/files`,
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })

    // Update it
    const updateDto = buildUpdateFileDTO({ name: 'updated.txt' })
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/storage/buckets/${testBucketId}/files/${fileId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const resBody = parseJson(res.payload)
    assertDocumentShape(resBody)
    expect(resBody.$id).toBe(fileId)
  })

  it('PUT /v1/storage/buckets/:bucketId/files/:fileId returns 404 for non-existent file', async () => {
    // PROTECTS: 404 when updating non-existent file
    const updateDto = buildUpdateFileDTO()

    const res = await app.inject({
      method: 'PUT',
      url: `/v1/storage/buckets/${testBucketId}/files/nonexistentfile`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 404)
  })

  /**
   * FILE DOWNLOAD TESTS
   */

  it('GET /v1/storage/buckets/:bucketId/files/:fileId/download returns 200 for existing file', async () => {
    // PROTECTS: File download works correctly
    const fileId = `downloadfile${Date.now()}`
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW'
    const fileContent = 'Test file content for download'

    // Create file first
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      fileId,
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="download.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${testBucketId}/files`,
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })

    // Download it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${testBucketId}/files/${fileId}/download`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)
    expect(res.headers['content-type']).toBeDefined()
  })

  it('GET /v1/storage/buckets/:bucketId/files/:fileId/download returns 404 for non-existent file', async () => {
    // PROTECTS: 404 when downloading non-existent file
    const res = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${testBucketId}/files/nonexistentfile/download`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * FILE VIEW TESTS
   */

  it('GET /v1/storage/buckets/:bucketId/files/:fileId/view returns 200 for existing file', async () => {
    // PROTECTS: File view works correctly
    const fileId = `viewfile${Date.now()}`
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW'
    const fileContent = 'Test file content for view'

    // Create file first
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      fileId,
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="view.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${testBucketId}/files`,
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })

    // View it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${testBucketId}/files/${fileId}/view`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)
  })

  /**
   * FILE DELETION TESTS
   */

  it('DELETE /v1/storage/buckets/:bucketId/files/:fileId returns 204 for existing file', async () => {
    // PROTECTS: File deletion works correctly
    const fileId = `deletefile${Date.now()}`
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW'
    const fileContent = 'Test file content for delete'

    // Create file first
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileId"',
      '',
      fileId,
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="delete.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    await app.inject({
      method: 'POST',
      url: `/v1/storage/buckets/${testBucketId}/files`,
      headers: {
        ...getApiKeyHeaders(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })

    // Delete it
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${testBucketId}/files/${fileId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)

    // Verify it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${testBucketId}/files/${fileId}`,
      headers: getApiKeyHeaders(),
    })
    assertStatusCode(checkRes, 404)
  })

  it('DELETE /v1/storage/buckets/:bucketId/files/:fileId returns 404 for non-existent file', async () => {
    // PROTECTS: 404 when deleting non-existent file
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${testBucketId}/files/nonexistentfile`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })
})
