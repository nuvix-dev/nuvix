import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildCreateFcmProviderDTO,
  buildCreateSmtpProviderDTO,
} from '../../factories/dto/provider.factory'
import { getApiKeyHeaders, getApiKeyJsonHeaders } from '../../helpers/auth'
import { getApp } from '../../setup/app'
import {
  assertDocumentShape,
  assertListResponse,
  assertStatusCode,
  parseJson,
} from '../../setup/test-utils'

describe('messaging/providers (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * AUTH BOUNDARY TESTS
   * Provider endpoints require ADMIN or KEY auth
   */

  it('GET /v1/messaging/providers returns 401 when unauthenticated', async () => {
    // PROTECTS: Provider list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/messaging/providers',
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/messaging/providers/smtp returns 401 when unauthenticated', async () => {
    // PROTECTS: SMTP provider creation requires authentication
    const dto = buildCreateSmtpProviderDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  /**
   * PROVIDER LISTING TESTS
   */

  it('GET /v1/messaging/providers returns 200 and list shape with API key', async () => {
    // PROTECTS: Provider listing returns proper list format
    const res = await app.inject({
      method: 'GET',
      url: '/v1/messaging/providers',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  /**
   * SMTP PROVIDER CREATION TESTS
   */

  it('POST /v1/messaging/providers/smtp returns 201 with complete provider shape', async () => {
    // PROTECTS: SMTP provider creation contract
    const dto = buildCreateSmtpProviderDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: dto.providerId,
      name: dto.name,
      provider: 'smtp',
    })
  })

  it('POST /v1/messaging/providers/smtp returns 400 for invalid providerId', async () => {
    // PROTECTS: Provider ID validation is enforced
    const dto = buildCreateSmtpProviderDTO({ providerId: '@@invalid@@' })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/messaging/providers/smtp returns 400 for missing name', async () => {
    // PROTECTS: Required field validation for SMTP provider
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        providerId: 'test-smtp',
        host: 'smtp.example.com',
        port: 587,
        // Missing name
      }),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/messaging/providers/smtp returns 409 for duplicate providerId', async () => {
    // PROTECTS: Provider ID uniqueness constraint
    const dto = buildCreateSmtpProviderDTO()

    // Create first provider
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Try to create second provider with same ID
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 409)
  })

  /**
   * FCM PROVIDER CREATION TESTS
   */

  it('POST /v1/messaging/providers/fcm returns 201 with complete provider shape', async () => {
    // PROTECTS: FCM provider creation contract
    const dto = buildCreateFcmProviderDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/fcm',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: dto.providerId,
      name: dto.name,
      type: 'push',
      provider: 'fcm',
    })
  })

  it('POST /v1/messaging/providers/fcm returns 400 for missing serviceAccountJSON', async () => {
    // PROTECTS: Required field validation for FCM provider
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/fcm',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        providerId: 'test-fcm',
        name: 'Test FCM',
        // Missing serviceAccountJSON
      }),
    })

    assertStatusCode(res, 400)
  })

  /**
   * PROVIDER RETRIEVAL TESTS
   */

  it('GET /v1/messaging/providers/:providerId returns 200 for existing provider', async () => {
    // PROTECTS: Single provider retrieval works correctly
    const dto = buildCreateSmtpProviderDTO()

    // Create provider first
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Retrieve it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/messaging/providers/${dto.providerId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(dto.providerId)
    expect(body.name).toBe(dto.name)
  })

  it('GET /v1/messaging/providers/:providerId returns 404 for non-existent provider', async () => {
    // PROTECTS: 404 for unknown provider ID
    const res = await app.inject({
      method: 'GET',
      url: '/v1/messaging/providers/nonexistentprovider',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * SMTP PROVIDER UPDATE TESTS
   */

  it('PATCH /v1/messaging/providers/smtp/:providerId returns 200 and updates provider', async () => {
    // PROTECTS: SMTP provider update works correctly
    const createDto = buildCreateSmtpProviderDTO()

    // Create provider first
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update it
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/messaging/providers/smtp/${createDto.providerId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({ name: 'Updated SMTP Provider' }),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(createDto.providerId)
    expect(body.name).toBe('Updated SMTP Provider')
  })

  it('PATCH /v1/messaging/providers/smtp/:providerId returns 404 for non-existent provider', async () => {
    // PROTECTS: 404 when updating non-existent SMTP provider
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/messaging/providers/smtp/nonexistentprovider',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({ name: 'Test' }),
    })

    assertStatusCode(res, 404)
  })

  /**
   * FCM PROVIDER UPDATE TESTS
   */

  it('PATCH /v1/messaging/providers/fcm/:providerId returns 200 and updates provider', async () => {
    // PROTECTS: FCM provider update works correctly
    const createDto = buildCreateFcmProviderDTO()

    // Create provider first
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/fcm',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update it
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/messaging/providers/fcm/${createDto.providerId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({ name: 'Updated FCM Provider' }),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(createDto.providerId)
    expect(body.name).toBe('Updated FCM Provider')
  })

  /**
   * PROVIDER DELETION TESTS
   */

  it('DELETE /v1/messaging/providers/:providerId returns 204 for existing provider', async () => {
    // PROTECTS: Provider deletion works correctly
    const dto = buildCreateSmtpProviderDTO()

    // Create provider first
    await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Delete it
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/providers/${dto.providerId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)

    // Verify it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/providers/${dto.providerId}`,
      headers: getApiKeyHeaders(),
    })
    assertStatusCode(checkRes, 404)
  })

  it('DELETE /v1/messaging/providers/:providerId returns 404 for non-existent provider', async () => {
    // PROTECTS: 404 when deleting non-existent provider
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/messaging/providers/nonexistentprovider',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })
})
