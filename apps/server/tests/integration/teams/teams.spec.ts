import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildCreateTeamDTO } from '../../factories/dto/team.factory'
import { createUserAndSession, getApiKeyHeaders } from '../../helpers/auth'
import { getApp } from '../../setup/app'
import {
  assertDocumentShape,
  assertListResponse,
  assertStatusCode,
  parseJson,
} from '../../setup/test-utils'

describe('teams (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * AUTH BOUNDARY TESTS
   */

  it('GET /v1/teams returns 401 when unauthenticated', async () => {
    // PROTECTS: Team list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/teams',
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/teams returns 401 when unauthenticated', async () => {
    // PROTECTS: Team creation requires authentication
    const dto = buildCreateTeamDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  /**
   * TEAM LISTING TESTS
   */

  it('GET /v1/teams returns 200 and list shape with session auth', async () => {
    // PROTECTS: Team listing returns proper list format
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/teams',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  it('GET /v1/teams returns 200 with API key auth', async () => {
    // PROTECTS: Team listing works with API key
    const res = await app.inject({
      method: 'GET',
      url: '/v1/teams',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  /**
   * TEAM CREATION TESTS
   */

  it('POST /v1/teams returns 201 and echoes complete team shape', async () => {
    // PROTECTS: Team creation contract - status code and all required fields
    const { sessionHeader } = await createUserAndSession(app)
    const dto = buildCreateTeamDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/teams',
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
      $id: dto.teamId,
      name: dto.name,
      total: 1, // Creator is automatically added as member
    })
  })

  it('POST /v1/teams returns 400 for an invalid teamId', async () => {
    // PROTECTS: Team ID validation is enforced
    const { sessionHeader } = await createUserAndSession(app)
    const dto = buildCreateTeamDTO({ teamId: '@@not-valid@@' })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/teams returns 400 for missing name', async () => {
    // PROTECTS: Required field validation
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ teamId: 'test-team' }),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/teams returns 409 for duplicate teamId', async () => {
    // PROTECTS: Team ID uniqueness constraint
    const { sessionHeader } = await createUserAndSession(app)
    const dto = buildCreateTeamDTO()

    // Create first team
    await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })

    // Try to create second team with same ID
    const res = await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 409)
  })

  /**
   * TEAM RETRIEVAL TESTS
   */

  it('GET /v1/teams/:teamId returns 200 for existing team', async () => {
    // PROTECTS: Single team retrieval works correctly
    const { sessionHeader } = await createUserAndSession(app)
    const dto = buildCreateTeamDTO()

    // Create team first
    await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })

    // Retrieve it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/teams/${dto.teamId}`,
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(dto.teamId)
    expect(body.name).toBe(dto.name)
  })

  it('GET /v1/teams/:teamId returns 404 for non-existent team', async () => {
    // PROTECTS: 404 for unknown team ID
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/teams/nonexistentteam',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 404)
  })

  /**
   * TEAM UPDATE TESTS
   */

  it('PUT /v1/teams/:teamId returns 200 and updates team name', async () => {
    // PROTECTS: Team update modifies the team correctly
    const { sessionHeader } = await createUserAndSession(app)
    const dto = buildCreateTeamDTO()

    // Create team first
    await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })

    // Update it
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/teams/${dto.teamId}`,
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ name: 'Updated Team Name' }),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(dto.teamId)
    expect(body.name).toBe('Updated Team Name')
  })

  it('PUT /v1/teams/:teamId returns 404 for non-existent team', async () => {
    // PROTECTS: 404 when updating non-existent team
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/teams/nonexistentteam',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ name: 'New Name' }),
    })

    assertStatusCode(res, 404)
  })

  /**
   * TEAM PREFS TESTS
   */

  it('GET /v1/teams/:teamId/prefs returns 200 and object', async () => {
    // PROTECTS: Team prefs endpoint returns valid object
    const { sessionHeader } = await createUserAndSession(app)
    const dto = buildCreateTeamDTO()

    // Create team first
    await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })

    const res = await app.inject({
      method: 'GET',
      url: `/v1/teams/${dto.teamId}/prefs`,
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    expect(typeof body).toBe('object')
    expect(body).not.toBeNull()
  })

  it('PUT /v1/teams/:teamId/prefs returns 200 and updates prefs', async () => {
    // PROTECTS: Team prefs update works correctly
    const { sessionHeader } = await createUserAndSession(app)
    const dto = buildCreateTeamDTO()

    // Create team first
    await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })

    const prefs = { theme: 'dark', notifications: true }
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/teams/${dto.teamId}/prefs`,
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ prefs }),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    expect(body).toEqual(prefs)
  })

  /**
   * TEAM DELETION TESTS
   */

  it('DELETE /v1/teams/:teamId returns 204 for existing team', async () => {
    // PROTECTS: Team deletion works correctly
    const { sessionHeader } = await createUserAndSession(app)
    const dto = buildCreateTeamDTO()

    // Create team first
    await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(dto),
    })

    // Delete it
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/teams/${dto.teamId}`,
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 204)

    // Verify it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/teams/${dto.teamId}`,
      headers: { 'x-nuvix-session': sessionHeader },
    })
    assertStatusCode(checkRes, 404)
  })

  it('DELETE /v1/teams/:teamId returns 404 for non-existent team', async () => {
    // PROTECTS: 404 when deleting non-existent team
    const { sessionHeader } = await createUserAndSession(app)

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/teams/nonexistentteam',
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 404)
  })
})
