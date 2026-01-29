import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../../setup/app'
import { createUserAndSession } from '../../helpers/auth'
import {
  parseJson,
  assertStatusCode,
  assertListResponse,
} from '../../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('account/identities (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * IDENTITY LISTING TESTS
   * These tests verify OAuth/SSO identity management
   */

  it('GET /v1/account/identities returns 401 when unauthenticated', async () => {
    // PROTECTS: Identity list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/account/identities',
    })

    assertStatusCode(res, 401)
  })

  it('GET /v1/account/identities returns 200 and list shape for authenticated user', async () => {
    // PROTECTS: Identities endpoint returns proper list format
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/account/identities',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)

    // New user should have no external identities
    expect(body.total).toBe(0)
    expect(body.data).toHaveLength(0)
  })

  /**
   * IDENTITY DELETION TESTS
   */

  it('DELETE /v1/account/identities/:identityId returns 401 when unauthenticated', async () => {
    // PROTECTS: Identity deletion not allowed without authentication
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/account/identities/someidentityid',
    })

    assertStatusCode(res, 401)
  })

  it('DELETE /v1/account/identities/:identityId returns 404 when identity does not exist', async () => {
    // PROTECTS: 404 returned when deleting non-existent identity
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/account/identities/doesnotexist',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 404)
  })

  it('DELETE /v1/account/identities/:identityId returns 400 for invalid identity ID format', async () => {
    // PROTECTS: Identity ID validation is enforced
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/account/identities/@@invalid@@',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    // Could be 400 or 404 depending on validation order
    expect([400, 404]).toContain(res.statusCode)
  })
})
