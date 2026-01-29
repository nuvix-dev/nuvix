import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../../setup/app'
import { getApiKeyJsonHeaders, getApiKeyHeaders } from '../../helpers/auth'
import {
  buildCreateBucketDTO,
  buildUpdateBucketDTO,
} from '../../factories/dto/bucket.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
  assertListResponse,
} from '../../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('storage/buckets (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * AUTH BOUNDARY TESTS
   * Storage endpoints require ADMIN or KEY auth
   */

  it('GET /v1/storage/buckets returns 401 when unauthenticated', async () => {
    // PROTECTS: Bucket list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/storage/buckets',
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/storage/buckets returns 401 when unauthenticated', async () => {
    // PROTECTS: Bucket creation requires authentication
    const dto = buildCreateBucketDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  /**
   * BUCKET LISTING TESTS
   */

  it('GET /v1/storage/buckets returns 200 and list shape with API key', async () => {
    // PROTECTS: Bucket listing returns proper list format
    const res = await app.inject({
      method: 'GET',
      url: '/v1/storage/buckets',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  /**
   * BUCKET CREATION TESTS
   */

  it('POST /v1/storage/buckets returns 201 with complete bucket shape', async () => {
    // PROTECTS: Bucket creation contract - status code and all required fields
    const dto = buildCreateBucketDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: dto.bucketId,
      name: dto.name,
      enabled: dto.enabled,
      fileSecurity: dto.fileSecurity,
      maximumFileSize: dto.maximumFileSize,
    })
  })

  it('POST /v1/storage/buckets returns 400 for invalid bucketId', async () => {
    // PROTECTS: Bucket ID validation is enforced
    const dto = buildCreateBucketDTO({ bucketId: '@@invalid@@' })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/storage/buckets returns 400 for missing name', async () => {
    // PROTECTS: Required field validation
    const res = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({ bucketId: 'test-bucket' }),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/storage/buckets returns 409 for duplicate bucketId', async () => {
    // PROTECTS: Bucket ID uniqueness constraint
    const dto = buildCreateBucketDTO()

    // Create first bucket
    await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Try to create second bucket with same ID
    const res = await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 409)
  })

  /**
   * BUCKET RETRIEVAL TESTS
   */

  it('GET /v1/storage/buckets/:bucketId returns 200 for existing bucket', async () => {
    // PROTECTS: Single bucket retrieval works correctly
    const dto = buildCreateBucketDTO()

    // Create bucket first
    await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Retrieve it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${dto.bucketId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(dto.bucketId)
    expect(body.name).toBe(dto.name)
  })

  it('GET /v1/storage/buckets/:bucketId returns 404 for non-existent bucket', async () => {
    // PROTECTS: 404 for unknown bucket ID
    const res = await app.inject({
      method: 'GET',
      url: '/v1/storage/buckets/nonexistentbucket',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * BUCKET UPDATE TESTS
   */

  it('PUT /v1/storage/buckets/:bucketId returns 200 and updates bucket', async () => {
    // PROTECTS: Bucket update modifies the bucket correctly
    const createDto = buildCreateBucketDTO()
    const updateDto = buildUpdateBucketDTO({ name: 'Updated Bucket Name' })

    // Create bucket first
    await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update it
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/storage/buckets/${createDto.bucketId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(createDto.bucketId)
    expect(body.name).toBe('Updated Bucket Name')
  })

  it('PUT /v1/storage/buckets/:bucketId returns 404 for non-existent bucket', async () => {
    // PROTECTS: 404 when updating non-existent bucket
    const updateDto = buildUpdateBucketDTO()

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/storage/buckets/nonexistentbucket',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 404)
  })

  /**
   * BUCKET DELETION TESTS
   */

  it('DELETE /v1/storage/buckets/:bucketId returns 204 for existing bucket', async () => {
    // PROTECTS: Bucket deletion works correctly
    const dto = buildCreateBucketDTO()

    // Create bucket first
    await app.inject({
      method: 'POST',
      url: '/v1/storage/buckets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Delete it
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/storage/buckets/${dto.bucketId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)

    // Verify it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/storage/buckets/${dto.bucketId}`,
      headers: getApiKeyHeaders(),
    })
    assertStatusCode(checkRes, 404)
  })

  it('DELETE /v1/storage/buckets/:bucketId returns 404 for non-existent bucket', async () => {
    // PROTECTS: 404 when deleting non-existent bucket
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/storage/buckets/nonexistentbucket',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })
})
