import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildCreateUserDTO,
  buildUpdateUserEmailDTO,
  buildUpdateUserLabelsDTO,
  buildUpdateUserNameDTO,
  buildUpdateUserPasswordDTO,
  buildUpdateUserPrefsDTO,
  buildUpdateUserStatusDTO,
} from '../../factories/dto/user.factory'
import { getApiKeyHeaders, getApiKeyJsonHeaders } from '../../helpers/auth'
import { getApp } from '../../setup/app'
import {
  assertDocumentShape,
  assertListResponse,
  assertStatusCode,
  parseJson,
} from '../../setup/test-utils'

describe('users (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * AUTH BOUNDARY TESTS
   * Users endpoints require ADMIN or KEY auth
   */

  it('GET /v1/users returns 401 when unauthenticated', async () => {
    // PROTECTS: User list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users',
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/users returns 401 when unauthenticated', async () => {
    // PROTECTS: User creation requires authentication
    const dto = buildCreateUserDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  /**
   * USER LISTING TESTS
   */

  it('GET /v1/users returns 200 and list shape with API key', async () => {
    // PROTECTS: User listing returns proper list format
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  /**
   * USER CREATION TESTS
   */

  it('POST /v1/users returns 201 with complete user shape', async () => {
    // PROTECTS: User creation contract - status code and all required fields
    const dto = buildCreateUserDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: dto.userId,
      name: dto.name,
      email: dto.email,
    })
  })

  it('POST /v1/users returns 400 for invalid userId', async () => {
    // PROTECTS: User ID validation is enforced
    const dto = buildCreateUserDTO({ userId: '@@invalid@@' })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/users returns 400 for invalid email format', async () => {
    // PROTECTS: Email format validation
    const dto = buildCreateUserDTO({ email: 'notanemail' })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/users returns 409 for duplicate email', async () => {
    // PROTECTS: Email uniqueness constraint
    const dto = buildCreateUserDTO()

    // Create first user
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Try to create second user with same email
    const duplicateDto = buildCreateUserDTO({ email: dto.email })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(duplicateDto),
    })

    assertStatusCode(res, 409)
  })

  /**
   * USER RETRIEVAL TESTS
   */

  it('GET /v1/users/:userId returns 200 for existing user', async () => {
    // PROTECTS: Single user retrieval works correctly
    const dto = buildCreateUserDTO()

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Retrieve it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${dto.userId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(dto.userId)
    expect(body.email).toBe(dto.email)
  })

  it('GET /v1/users/:userId returns 404 for non-existent user', async () => {
    // PROTECTS: 404 for unknown user ID
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/nonexistentuser123',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * USER UPDATE TESTS
   */

  it('PATCH /v1/users/:userId/name returns 200 and updates user name', async () => {
    // PROTECTS: User name update works correctly
    const createDto = buildCreateUserDTO()
    const updateDto = buildUpdateUserNameDTO({ name: 'Updated Name' })

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update name
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${createDto.userId}/name`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.name).toBe('Updated Name')
  })

  it('PATCH /v1/users/:userId/email returns 200 and updates user email', async () => {
    // PROTECTS: User email update works correctly
    const createDto = buildCreateUserDTO()
    const newEmail = `newemail${Date.now()}@example.com`
    const updateDto = buildUpdateUserEmailDTO({ email: newEmail })

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update email
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${createDto.userId}/email`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.email).toBe(newEmail)
  })

  it('PATCH /v1/users/:userId/password returns 200 when updating password', async () => {
    // PROTECTS: User password update works correctly
    const createDto = buildCreateUserDTO()
    const updateDto = buildUpdateUserPasswordDTO({
      password: 'NewSecurePassword123!',
    })

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update password
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${createDto.userId}/password`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
  })

  it('PATCH /v1/users/:userId/status returns 200 and updates user status', async () => {
    // PROTECTS: User status update works correctly
    const createDto = buildCreateUserDTO()
    const updateDto = buildUpdateUserStatusDTO({ status: false })

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update status
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${createDto.userId}/status`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.status).toBe(false)
  })

  it('PUT /v1/users/:userId/labels returns 200 and updates user labels', async () => {
    // PROTECTS: User labels update works correctly
    const createDto = buildCreateUserDTO()
    const updateDto = buildUpdateUserLabelsDTO({
      labels: ['admin', 'moderator'],
    })

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update labels
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/users/${createDto.userId}/labels`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.labels).toEqual(['admin', 'moderator'])
  })

  it('PATCH /v1/users/:userId/name returns 404 for non-existent user', async () => {
    // PROTECTS: 404 when updating non-existent user
    const updateDto = buildUpdateUserNameDTO()

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/nonexistentuser123/name',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 404)
  })

  /**
   * USER PREFERENCES TESTS
   */

  it('GET /v1/users/:userId/prefs returns 200 for existing user', async () => {
    // PROTECTS: User preferences retrieval works correctly
    const createDto = buildCreateUserDTO()

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Get prefs
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${createDto.userId}/prefs`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)
  })

  it('PATCH /v1/users/:userId/prefs returns 200 and updates preferences', async () => {
    // PROTECTS: User preferences update works correctly
    const createDto = buildCreateUserDTO()
    const updateDto = buildUpdateUserPrefsDTO({
      prefs: { darkMode: true, language: 'en' },
    })

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update prefs
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${createDto.userId}/prefs`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    expect(body.darkMode).toBe(true)
    expect(body.language).toBe('en')
  })

  /**
   * USER VERIFICATION TESTS
   */

  it('PATCH /v1/users/:userId/verification returns 200 and updates email verification', async () => {
    // PROTECTS: Email verification status update works correctly
    const createDto = buildCreateUserDTO()

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Update verification
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${createDto.userId}/verification`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({ emailVerification: true }),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.emailVerification).toBe(true)
  })

  /**
   * USER MEMBERSHIPS TESTS
   */

  it('GET /v1/users/:userId/memberships returns 200 and list shape', async () => {
    // PROTECTS: User memberships listing works correctly
    const createDto = buildCreateUserDTO()

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(createDto),
    })

    // Get memberships
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${createDto.userId}/memberships`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  /**
   * USER LOGS TESTS
   */

  // it('GET /v1/users/:userId/logs returns 200 and list shape', async () => {
  //   // PROTECTS: User logs listing works correctly
  //   const createDto = buildCreateUserDTO()

  //   // Create user first
  //   await app.inject({
  //     method: 'POST',
  //     url: '/v1/users',
  //     headers: getApiKeyJsonHeaders(),
  //     payload: JSON.stringify(createDto),
  //   })

  //   // Get logs
  //   const res = await app.inject({
  //     method: 'GET',
  //     url: `/v1/users/${createDto.userId}/logs`,
  //     headers: getApiKeyHeaders(),
  //   })

  //   assertStatusCode(res, 200)

  //   const body = parseJson(res.payload)
  //   assertListResponse(body)
  // })

  /**
   * USER IDENTITIES TESTS
   */

  it('GET /v1/users/identities returns 200 and list shape', async () => {
    // PROTECTS: Identities listing works correctly
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/identities',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  /**
   * USER DELETION TESTS
   */

  it('DELETE /v1/users/:userId returns 204 for existing user', async () => {
    // PROTECTS: User deletion works correctly
    const dto = buildCreateUserDTO()

    // Create user first
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Delete it
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${dto.userId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)

    // Verify it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/users/${dto.userId}`,
      headers: getApiKeyHeaders(),
    })
    assertStatusCode(checkRes, 404)
  })

  it('DELETE /v1/users/:userId returns 404 for non-existent user', async () => {
    // PROTECTS: 404 when deleting non-existent user
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/users/nonexistentuser123',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })
})
