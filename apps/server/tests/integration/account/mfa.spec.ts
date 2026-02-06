import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import { createUserAndSession } from '../../helpers/auth'
import { getApp } from '../../setup/app'
import {
  assertDocumentShape,
  assertStatusCode,
  parseJson,
} from '../../setup/test-utils'

describe('account/mfa (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * MFA FACTORS TESTS
   * These tests verify MFA configuration retrieval
   */

  it('GET /v1/account/mfa/factors returns 401 when unauthenticated', async () => {
    // PROTECTS: MFA factors not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/account/mfa/factors',
    })

    assertStatusCode(res, 401)
  })

  it('GET /v1/account/mfa/factors returns 200 and complete factors shape', async () => {
    // PROTECTS: MFA factors response contract with all factor types
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/account/mfa/factors',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    expect(typeof body.totp).toBe('boolean')
    expect(typeof body.email).toBe('boolean')
    expect(typeof body.phone).toBe('boolean')
  })

  /**
   * MFA ENABLE/DISABLE TESTS
   */

  it('PATCH /v1/account/mfa returns 401 when unauthenticated', async () => {
    // PROTECTS: MFA toggle not allowed without authentication
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/account/mfa',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ mfa: true }),
    })

    assertStatusCode(res, 401)
  })

  it('PATCH /v1/account/mfa returns 200 and sets mfa=true', async () => {
    // PROTECTS: MFA can be enabled for an account
    const { sessionHeader, userId } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/account/mfa',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ mfa: true }),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: userId,
      mfa: true,
    })
  })

  it('PATCH /v1/account/mfa returns 200 and sets mfa=false', async () => {
    // PROTECTS: MFA can be disabled for an account
    const { sessionHeader, userId } = await createUserAndSession(app)

    // First enable MFA
    await app.inject({
      method: 'PATCH',
      url: '/v1/account/mfa',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ mfa: true }),
    })

    // Then disable it
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/account/mfa',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ mfa: false }),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    expect(body).toMatchObject({
      $id: userId,
      mfa: false,
    })
  })

  /**
   * TOTP AUTHENTICATOR TESTS
   */

  it('POST /v1/account/mfa/authenticators/totp returns 401 when unauthenticated', async () => {
    // PROTECTS: TOTP creation not allowed without authentication
    const res = await app.inject({
      method: 'POST',
      url: '/v1/account/mfa/authenticators/totp',
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/account/mfa/authenticators/totp returns 201 and includes secret', async () => {
    // PROTECTS: TOTP authenticator creation returns usable secret
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/account/mfa/authenticators/totp',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    expect(typeof body.secret).toBe('string')
    expect(body.secret.length).toBeGreaterThan(0)
    expect(typeof body.uri).toBe('string')
    expect(body.uri).toContain('otpauth://')
  })

  it('DELETE /v1/account/mfa/authenticators/totp returns 404 when authenticator is missing', async () => {
    // PROTECTS: 404 returned when deleting non-existent authenticator
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/account/mfa/authenticators/totp',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 404)
  })

  /**
   * MFA RECOVERY CODES TESTS
   */

  it('GET /v1/account/mfa/recovery-codes returns 401 when unauthenticated', async () => {
    // PROTECTS: Recovery codes not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/account/mfa/recovery-codes',
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/account/mfa/recovery-codes returns 201 and includes codes array', async () => {
    // PROTECTS: Recovery codes generation returns usable codes
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/account/mfa/recovery-codes',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    expect(Array.isArray(body.recoveryCodes)).toBe(true)
    expect(body.recoveryCodes.length).toBeGreaterThan(0)
  })
})
