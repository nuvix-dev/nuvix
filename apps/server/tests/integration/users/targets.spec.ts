import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildCreateSmtpProviderDTO } from '../../factories/dto/provider.factory'
import { buildCreateUserDTO } from '../../factories/dto/user.factory'
import {
  buildCreateUserTargetDTO,
  buildUpdateUserTargetDTO,
} from '../../factories/dto/userTarget.factory'
import { getApiKeyHeaders, getApiKeyJsonHeaders } from '../../helpers/auth'
import { getApp } from '../../setup/app'
import {
  assertDocumentShape,
  assertListResponse,
  assertStatusCode,
  parseJson,
} from '../../setup/test-utils'

describe('users/targets (integration)', () => {
  let app: NestFastifyApplication
  let testUserId: string
  let testProviderId: string

  beforeAll(async () => {
    app = await getApp()

    // Create a user to test targets with
    const userDto = buildCreateUserDTO()
    testUserId = userDto.userId as string

    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(userDto),
    })

    // Create a provider to use for targets
    const providerDto = buildCreateSmtpProviderDTO()
    testProviderId = providerDto.providerId

    await app.inject({
      method: 'POST',
      url: '/v1/messaging/providers/smtp',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(providerDto),
    })
  })

  /**
   * AUTH BOUNDARY TESTS
   * User target endpoints require ADMIN or KEY auth
   */

  it('GET /v1/users/:userId/targets returns 401 when unauthenticated', async () => {
    // PROTECTS: Target list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${testUserId}/targets`,
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/users/:userId/targets returns 401 when unauthenticated', async () => {
    // PROTECTS: Target creation requires authentication
    const dto = buildCreateUserTargetDTO({ providerId: testProviderId })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/targets`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  /**
   * TARGET LISTING TESTS
   */

  it('GET /v1/users/:userId/targets returns 200 and list shape with API key', async () => {
    // PROTECTS: Target listing returns proper list format
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${testUserId}/targets`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  it('GET /v1/users/:userId/targets returns 404 for non-existent user', async () => {
    // PROTECTS: 404 for unknown user
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/nonexistentuser/targets',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * TARGET CREATION TESTS
   */

  it('POST /v1/users/:userId/targets returns 201 with complete target shape', async () => {
    // PROTECTS: Target creation contract
    const dto = buildCreateUserTargetDTO({ providerId: testProviderId })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/targets`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(dto.targetId)
    expect(body.providerId).toBe(testProviderId)
  })

  it('POST /v1/users/:userId/targets returns 400 for invalid targetId', async () => {
    // PROTECTS: Target ID validation is enforced
    const dto = buildCreateUserTargetDTO({
      targetId: '@@invalid@@',
      providerId: testProviderId,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/targets`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/users/:userId/targets returns 400 for missing providerId', async () => {
    // PROTECTS: Required field validation
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/targets`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        targetId: 'test-target',
        identifier: 'test@example.com',
        // Missing providerId
      }),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/users/:userId/targets returns 404 for non-existent user', async () => {
    // PROTECTS: 404 for unknown user
    const dto = buildCreateUserTargetDTO({ providerId: testProviderId })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/users/nonexistentuser/targets',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 404)
  })

  it('POST /v1/users/:userId/targets returns 409 for duplicate targetId', async () => {
    // PROTECTS: Target ID uniqueness constraint
    const dto = buildCreateUserTargetDTO({ providerId: testProviderId })

    // Create first target
    await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/targets`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Try to create second target with same ID
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/targets`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 409)
  })

  /**
   * TARGET RETRIEVAL TESTS
   */

  it('GET /v1/users/:userId/targets/:targetId returns 200 for existing target', async () => {
    // PROTECTS: Single target retrieval works correctly
    const dto = buildCreateUserTargetDTO({ providerId: testProviderId })

    // Create target first
    await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/targets`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Retrieve it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${testUserId}/targets/${dto.targetId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(dto.targetId)
  })

  it('GET /v1/users/:userId/targets/:targetId returns 404 for non-existent target', async () => {
    // PROTECTS: 404 for unknown target ID
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${testUserId}/targets/nonexistenttarget`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * TARGET UPDATE TESTS
   */

  it('PATCH /v1/users/:userId/targets/:targetId returns 200 and updates target', async () => {
    // PROTECTS: Target update works correctly
    const createDto = buildCreateUserTargetDTO({ providerId: testProviderId })
    const updateDto = buildUpdateUserTargetDTO({ name: 'Updated Target Name' })

    // Create target first
    await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/targets`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update it
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${testUserId}/targets/${createDto.targetId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(createDto.targetId)
    expect(body.name).toBe('Updated Target Name')
  })

  it('PATCH /v1/users/:userId/targets/:targetId returns 404 for non-existent target', async () => {
    // PROTECTS: 404 when updating non-existent target
    const updateDto = buildUpdateUserTargetDTO()

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${testUserId}/targets/nonexistenttarget`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 404)
  })

  /**
   * TARGET DELETION TESTS
   */

  it('DELETE /v1/users/:userId/targets/:targetId returns 204 for existing target', async () => {
    // PROTECTS: Target deletion works correctly
    const dto = buildCreateUserTargetDTO({ providerId: testProviderId })

    // Create target first
    await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/targets`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Delete it
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${testUserId}/targets/${dto.targetId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)

    // Verify it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/users/${testUserId}/targets/${dto.targetId}`,
      headers: getApiKeyHeaders(),
    })
    assertStatusCode(checkRes, 404)
  })

  it('DELETE /v1/users/:userId/targets/:targetId returns 404 for non-existent target', async () => {
    // PROTECTS: 404 when deleting non-existent target
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${testUserId}/targets/nonexistenttarget`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })
})
