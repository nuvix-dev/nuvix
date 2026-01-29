import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../../setup/app'
import { getApiKeyJsonHeaders, getApiKeyHeaders } from '../../helpers/auth'
import {
  buildCreateEmailMessageDTO,
  buildCreateSmsMessageDTO,
  buildCreatePushMessageDTO,
} from '../../factories/dto/message.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
  assertListResponse,
} from '../../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('messaging/messages (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * AUTH BOUNDARY TESTS
   * Messaging endpoints require ADMIN or KEY auth
   */

  it('GET /v1/messaging/messages returns 401 when unauthenticated', async () => {
    // PROTECTS: Message list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/messaging/messages',
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/messaging/messages/email returns 401 when unauthenticated', async () => {
    // PROTECTS: Email message creation requires authentication
    const dto = buildCreateEmailMessageDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/email',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  /**
   * MESSAGE LISTING TESTS
   */

  it('GET /v1/messaging/messages returns 200 and list shape with API key', async () => {
    // PROTECTS: Message listing returns proper list format
    const res = await app.inject({
      method: 'GET',
      url: '/v1/messaging/messages',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  /**
   * EMAIL MESSAGE CREATION TESTS
   */

  it('POST /v1/messaging/messages/email returns 201 with complete message shape', async () => {
    // PROTECTS: Email message creation contract
    const dto = buildCreateEmailMessageDTO({ draft: true })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/email',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: dto.messageId,
      status: 'draft',
    })
  })

  it('POST /v1/messaging/messages/email returns 400 for missing subject', async () => {
    // PROTECTS: Required field validation for email
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/email',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        messageId: 'test-msg',
        content: 'Test content',
        // Missing subject
      }),
    })

    assertStatusCode(res, 400)
  })

  /**
   * SMS MESSAGE CREATION TESTS
   */

  it('POST /v1/messaging/messages/sms returns 201 with complete message shape', async () => {
    // PROTECTS: SMS message creation contract
    const dto = buildCreateSmsMessageDTO({ draft: true })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/sms',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: dto.messageId,
      status: 'draft',
    })
  })

  it('POST /v1/messaging/messages/sms returns 400 for missing content', async () => {
    // PROTECTS: Required field validation for SMS
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/sms',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        messageId: 'test-sms',
        // Missing content
      }),
    })

    assertStatusCode(res, 400)
  })

  /**
   * PUSH MESSAGE CREATION TESTS
   */

  it('POST /v1/messaging/messages/push returns 201 with complete message shape', async () => {
    // PROTECTS: Push message creation contract
    const dto = buildCreatePushMessageDTO({ draft: true })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/push',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: dto.messageId,
      status: 'draft',
    })
  })

  it('POST /v1/messaging/messages/push returns 400 for missing title', async () => {
    // PROTECTS: Required field validation for push
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/push',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        messageId: 'test-push',
        body: 'Test body',
        // Missing title
      }),
    })

    assertStatusCode(res, 400)
  })

  /**
   * MESSAGE RETRIEVAL TESTS
   */

  it('GET /v1/messaging/messages/:messageId returns 200 for existing message', async () => {
    // PROTECTS: Single message retrieval works correctly
    const dto = buildCreateEmailMessageDTO({ draft: true })

    // Create message first
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/email',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Retrieve it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/messaging/messages/${dto.messageId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(dto.messageId)
  })

  it('GET /v1/messaging/messages/:messageId returns 404 for non-existent message', async () => {
    // PROTECTS: 404 for unknown message ID
    const res = await app.inject({
      method: 'GET',
      url: '/v1/messaging/messages/nonexistentmessage',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * MESSAGE DELETION TESTS
   */

  it('DELETE /v1/messaging/messages/:messageId returns 204 for existing message', async () => {
    // PROTECTS: Message deletion works correctly
    const dto = buildCreateEmailMessageDTO({ draft: true })

    // Create message first
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/email',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Delete it
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/messages/${dto.messageId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)

    // Verify it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/messages/${dto.messageId}`,
      headers: getApiKeyHeaders(),
    })
    assertStatusCode(checkRes, 404)
  })

  it('DELETE /v1/messaging/messages/:messageId returns 404 for non-existent message', async () => {
    // PROTECTS: 404 when deleting non-existent message
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/messaging/messages/nonexistentmessage',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })
})
