import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../../setup/app'
import { createUserAndSession } from '../../helpers/auth'
import { ensureCoreProvider } from '../../helpers/seed'
import { buildCreatePushTargetDTO } from '../../factories/dto/target.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
} from '../../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('account/targets (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /*
   * TARGET TESTS
   * Targets are push notification endpoints (devices)
   */

  /**
   * PUSH TARGET CREATION TESTS
   */

  it('POST /v1/account/targets/push returns 401 when unauthenticated', async () => {
    // PROTECTS: Push target creation requires authentication
    const dto = buildCreatePushTargetDTO({ providerId: 'test-provider' })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/account/targets/push',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/account/targets/push returns 201 and echoes full target shape', async () => {
    // PROTECTS: Push target creation returns complete target document
    await ensureCoreProvider(app, 'test-provider')
    const { sessionHeader, userId } = await createUserAndSession(app)
    const dto = buildCreatePushTargetDTO({ providerId: 'test-provider' })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/account/targets/push',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 201)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body).toMatchObject({
      $id: dto.targetId,
      userId: userId,
      providerId: 'test-provider',
      providerType: 'push',
      identifier: dto.identifier,
    })
  })

  it('POST /v1/account/targets/push returns 400 for missing required fields', async () => {
    // PROTECTS: Required field validation
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/account/targets/push',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ targetId: 'test' }), // Missing identifier and providerId
    })

    assertStatusCode(res, 400)
  })

  /**
   * PUSH TARGET RETRIEVAL TESTS
   */

  it('GET /v1/account/targets/:targetId returns 404 for non-existent target', async () => {
    // PROTECTS: 404 for unknown target ID
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/account/targets/nonexistenttarget',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 404)
  })

  /**
   * PUSH TARGET DELETION TESTS
   */

  it('DELETE /v1/account/targets/:targetId/push returns 204 when target exists', async () => {
    // PROTECTS: Push target deletion works correctly
    await ensureCoreProvider(app, 'test-provider')
    const { sessionHeader } = await createUserAndSession(app)
    const dto = buildCreatePushTargetDTO({ providerId: 'test-provider' })

    // Create the target first
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/account/targets/push',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })
    assertStatusCode(createRes, 201)

    // Delete it
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/v1/account/targets/${dto.targetId}/push`,
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(delRes, 204)

    // Verify it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/account/targets/${dto.targetId}`,
      headers: { 'x-nuvix-session': sessionHeader },
    })
    assertStatusCode(checkRes, 404)
  })

  it('DELETE /v1/account/targets/:targetId/push returns 404 for non-existent target', async () => {
    // PROTECTS: 404 when deleting non-existent target
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/account/targets/nonexistenttarget/push',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 404)
  })

  it('DELETE /v1/account/targets/:targetId/push returns 401 when unauthenticated', async () => {
    // PROTECTS: Target deletion requires authentication
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/account/targets/sometarget/push',
    })

    assertStatusCode(res, 401)
  })
})
