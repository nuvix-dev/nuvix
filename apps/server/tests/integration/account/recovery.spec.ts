import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../../setup/app'
import { createUserAndSession } from '../../helpers/auth'
import { parseJson, assertStatusCode } from '../../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('account/recovery (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * PASSWORD RECOVERY INITIATION TESTS
   * These tests verify the password reset request flow
   */

  it('POST /v1/account/recovery returns 503 when SMTP is disabled', async () => {
    // PROTECTS: Clear error when email service is not configured
    // This is expected behavior in test environment without SMTP
    const { email } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email,
        url: 'https://example.com/recovery',
      }),
    })

    assertStatusCode(res, 503)
    const body = parseJson(res.payload)
    expect(body.message).toBeDefined()
  })

  it('POST /v1/account/recovery returns 400 for invalid email format', async () => {
    // PROTECTS: Email validation on recovery request
    const res = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'not-valid-email',
        url: 'https://example.com/recovery',
      }),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/account/recovery returns 400 for missing URL', async () => {
    // PROTECTS: Required field validation on recovery request
    const res = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'test@example.com',
      }),
    })

    assertStatusCode(res, 400)
  })

  /**
   * PASSWORD RECOVERY COMPLETION TESTS
   * These tests verify the password reset confirmation flow
   */

  it('PUT /v1/account/recovery returns 401 for invalid recovery token', async () => {
    // PROTECTS: Invalid tokens are rejected (prevents unauthorized password resets)
    const { userId } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/account/recovery',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        userId,
        secret: 'invalid-secret-token',
        password: 'NewPassword123!',
      }),
    })

    assertStatusCode(res, 401)
    const body = parseJson(res.payload)
    expect(body.message).toBeDefined()
  })

  it('PUT /v1/account/recovery returns 400 for weak password', async () => {
    // PROTECTS: Password strength requirements on recovery
    const { userId } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/account/recovery',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        userId,
        secret: 'some-secret',
        password: '123', // Too weak
      }),
    })

    assertStatusCode(res, 400)
  })

  it('PUT /v1/account/recovery returns 400 for missing required fields', async () => {
    // PROTECTS: All required fields are validated
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/account/recovery',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        password: 'NewPassword123!',
        // Missing userId and secret
      }),
    })

    assertStatusCode(res, 400)
  })

  it('PUT /v1/account/recovery returns 404 for non-existent user', async () => {
    // PROTECTS: 404 for unknown user (or 401 - depends on implementation to prevent enumeration)
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/account/recovery',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        userId: 'nonexistentuser123',
        secret: 'some-secret',
        password: 'NewPassword123!',
      }),
    })

    // Could be 401 (invalid token) or 404 (user not found) depending on implementation
    expect([401, 404]).toContain(res.statusCode)
  })
})
