import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildCreateTopicDTO,
  buildUpdateTopicDTO,
} from '../../factories/dto/topic.factory'
import { getApiKeyHeaders, getApiKeyJsonHeaders } from '../../helpers/auth'
import { getApp } from '../../setup/app'
import {
  assertDocumentShape,
  assertListResponse,
  assertStatusCode,
  parseJson,
} from '../../setup/test-utils'

describe('messaging/topics (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * AUTH BOUNDARY TESTS
   * Topics endpoints require ADMIN or KEY auth
   */

  it('GET /v1/messaging/topics returns 401 when unauthenticated', async () => {
    // PROTECTS: Topic list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/messaging/topics',
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/messaging/topics returns 401 when unauthenticated', async () => {
    // PROTECTS: Topic creation requires authentication
    const dto = buildCreateTopicDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  /**
   * TOPIC LISTING TESTS
   */

  it('GET /v1/messaging/topics returns 200 and list shape with API key', async () => {
    // PROTECTS: Topic listing returns proper list format
    const res = await app.inject({
      method: 'GET',
      url: '/v1/messaging/topics',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  /**
   * TOPIC CREATION TESTS
   */

  it('POST /v1/messaging/topics returns 201 with complete topic shape', async () => {
    // PROTECTS: Topic creation contract - status code and all required fields
    const dto = buildCreateTopicDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: dto.topicId,
      name: dto.name,
    })
  })

  it('POST /v1/messaging/topics returns 400 for invalid topicId', async () => {
    // PROTECTS: Topic ID validation is enforced
    const dto = buildCreateTopicDTO({ topicId: '@@invalid@@' })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/messaging/topics returns 400 for missing name', async () => {
    // PROTECTS: Required field validation
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({ topicId: 'test-topic' }),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/messaging/topics returns 409 for duplicate topicId', async () => {
    // PROTECTS: Topic ID uniqueness constraint
    const dto = buildCreateTopicDTO()

    // Create first topic
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Try to create second topic with same ID
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 409)
  })

  /**
   * TOPIC RETRIEVAL TESTS
   */

  it('GET /v1/messaging/topics/:topicId returns 200 for existing topic', async () => {
    // PROTECTS: Single topic retrieval works correctly
    const dto = buildCreateTopicDTO()

    // Create topic first
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Retrieve it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/messaging/topics/${dto.topicId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(dto.topicId)
    expect(body.name).toBe(dto.name)
  })

  it('GET /v1/messaging/topics/:topicId returns 404 for non-existent topic', async () => {
    // PROTECTS: 404 for unknown topic ID
    const res = await app.inject({
      method: 'GET',
      url: '/v1/messaging/topics/nonexistenttopic',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * TOPIC UPDATE TESTS
   */

  it('PATCH /v1/messaging/topics/:topicId returns 200 and updates topic', async () => {
    // PROTECTS: Topic update modifies the topic correctly
    const createDto = buildCreateTopicDTO()
    const updateDto = buildUpdateTopicDTO({ name: 'Updated Topic Name' })

    // Create topic first
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update it
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/messaging/topics/${createDto.topicId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(createDto.topicId)
    expect(body.name).toBe('Updated Topic Name')
  })

  it('PATCH /v1/messaging/topics/:topicId returns 404 for non-existent topic', async () => {
    // PROTECTS: 404 when updating non-existent topic
    const updateDto = buildUpdateTopicDTO()

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/messaging/topics/nonexistenttopic',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 404)
  })

  /**
   * TOPIC DELETION TESTS
   */

  it('DELETE /v1/messaging/topics/:topicId returns 204 for existing topic', async () => {
    // PROTECTS: Topic deletion works correctly
    const dto = buildCreateTopicDTO()

    // Create topic first
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Delete it
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/topics/${dto.topicId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)

    // Verify it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/topics/${dto.topicId}`,
      headers: getApiKeyHeaders(),
    })
    assertStatusCode(checkRes, 404)
  })

  it('DELETE /v1/messaging/topics/:topicId returns 404 for non-existent topic', async () => {
    // PROTECTS: 404 when deleting non-existent topic
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/messaging/topics/nonexistenttopic',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })
})
