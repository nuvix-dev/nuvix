import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildCreateUserDTO } from '../../factories/dto/user.factory'
import { getApiKeyHeaders, getApiKeyJsonHeaders } from '../../helpers/auth'
import { getApp } from '../../setup/app'
import {
  assertListResponse,
  assertStatusCode,
  parseJson,
} from '../../setup/test-utils'

describe('users/sessions (integration)', () => {
  let app: NestFastifyApplication
  let testUserId: string

  beforeAll(async () => {
    app = await getApp()

    // Create a user to test sessions with
    const userDto = buildCreateUserDTO()
    testUserId = userDto.userId as string

    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(userDto),
    })
  })

  /**
   * AUTH BOUNDARY TESTS
   * User session admin endpoints require ADMIN or KEY auth
   */

  it('GET /v1/users/:userId/sessions returns 401 when unauthenticated', async () => {
    // PROTECTS: Session list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${testUserId}/sessions`,
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/users/:userId/sessions returns 401 when unauthenticated', async () => {
    // PROTECTS: Session creation requires authentication
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/sessions`,
    })

    assertStatusCode(res, 401)
  })

  /**
   * SESSION LISTING TESTS
   */

  it('GET /v1/users/:userId/sessions returns 200 and list shape with API key', async () => {
    // PROTECTS: Session listing returns proper list format
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${testUserId}/sessions`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  it('GET /v1/users/:userId/sessions returns 404 for non-existent user', async () => {
    // PROTECTS: 404 for unknown user
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/nonexistentuser/sessions',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * SESSION CREATION TESTS
   */

  it('POST /v1/users/:userId/sessions returns 201 when creating session for user', async () => {
    // PROTECTS: Admin can create session for a user
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/sessions`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    expect(body.userId).toBe(testUserId)
  })

  it('POST /v1/users/:userId/sessions returns 404 for non-existent user', async () => {
    // PROTECTS: 404 when creating session for unknown user
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users/nonexistentuser/sessions',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * SESSION DELETION TESTS
   */

  it('DELETE /v1/users/:userId/sessions returns 204 when deleting all sessions', async () => {
    // PROTECTS: Bulk session deletion works correctly
    // First create a session
    await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/sessions`,
      headers: getApiKeyHeaders(),
    })

    // Delete all sessions
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${testUserId}/sessions`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)
  })

  it('DELETE /v1/users/:userId/sessions/:sessionId returns 204 for existing session', async () => {
    // PROTECTS: Single session deletion works correctly
    // First create a session
    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/users/${testUserId}/sessions`,
      headers: getApiKeyHeaders(),
    })

    const session = parseJson(createRes.payload)

    // Delete the specific session
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${testUserId}/sessions/${session.$id}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)
  })

  it('DELETE /v1/users/:userId/sessions/:sessionId returns 404 for non-existent session', async () => {
    // PROTECTS: 404 when deleting non-existent session
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${testUserId}/sessions/nonexistentsession`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  it('DELETE /v1/users/:userId/sessions returns 404 for non-existent user', async () => {
    // PROTECTS: 404 when deleting sessions for unknown user
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/users/nonexistentuser/sessions',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })
})
