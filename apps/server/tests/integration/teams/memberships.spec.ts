import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../../setup/app'
import {
  createUserAndSession,
  getApiKeyJsonHeaders,
  getApiKeyHeaders,
} from '../../helpers/auth'
import { buildCreateTeamDTO } from '../../factories/dto/team.factory'
import {
  buildCreateMembershipDTO,
  buildUpdateMembershipDTO,
} from '../../factories/dto/membership.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
  assertListResponse,
  skipIfSMTPNotConfigured,
} from '../../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('teams/memberships (integration)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  /**
   * Helper to create a team for membership tests
   */
  async function createTeam(headers: Record<string, string>) {
    const dto = buildCreateTeamDTO()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      payload: JSON.stringify(dto),
    })
    assertStatusCode(res, 201)
    return dto.teamId
  }

  /**
   * AUTH BOUNDARY TESTS
   * Membership endpoints require ADMIN, KEY, SESSION, or JWT auth
   */

  it('GET /v1/teams/:teamId/memberships returns 401 when unauthenticated', async () => {
    // PROTECTS: Membership list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: '/v1/teams/someteam/memberships',
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/teams/:teamId/memberships returns 401 when unauthenticated', async () => {
    // PROTECTS: Membership creation requires authentication
    const dto = buildCreateMembershipDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/teams/someteam/memberships',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  /**
   * MEMBERSHIP LISTING TESTS
   */

  it('GET /v1/teams/:teamId/memberships returns 200 and list shape with session', async () => {
    // PROTECTS: Membership listing returns proper list format
    const { sessionHeader } = await createUserAndSession(app)
    const teamId = await createTeam({ 'x-nuvix-session': sessionHeader })

    const res = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}/memberships`,
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)

    // Team creator should be in the memberships
    expect(body.total).toBeGreaterThanOrEqual(1)
  })

  it('GET /v1/teams/:teamId/memberships returns 200 with API key', async () => {
    // PROTECTS: Membership listing works with API key auth
    const { sessionHeader } = await createUserAndSession(app)
    const teamId = await createTeam({ 'x-nuvix-session': sessionHeader })

    const res = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}/memberships`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  it('GET /v1/teams/:teamId/memberships returns 404 for non-existent team', async () => {
    // PROTECTS: 404 for unknown team ID
    const res = await app.inject({
      method: 'GET',
      url: '/v1/teams/nonexistentteam/memberships',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * MEMBERSHIP CREATION TESTS
   */

  it.skipIf(skipIfSMTPNotConfigured())(
    'POST /v1/teams/:teamId/memberships returns 201 with complete membership shape',
    async () => {
      // PROTECTS: Membership creation contract - status code and all required fields
      const { sessionHeader } = await createUserAndSession(app)
      const teamId = await createTeam({ 'x-nuvix-session': sessionHeader })

      // Create another user to invite
      const { email: inviteeEmail, userId: inviteeId } =
        await createUserAndSession(app)
      const dto = buildCreateMembershipDTO({
        email: inviteeEmail,
        userId: inviteeId,
      })

      const res = await app.inject({
        method: 'POST',
        url: `/v1/teams/${teamId}/memberships`,
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
        teamId: teamId,
        roles: dto.roles,
      })
    },
  )

  it('POST /v1/teams/:teamId/memberships returns 400 for missing roles', async () => {
    // PROTECTS: Required field validation
    const { sessionHeader } = await createUserAndSession(app)
    const teamId = await createTeam({ 'x-nuvix-session': sessionHeader })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/teams/${teamId}/memberships`,
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({
        email: 'test@example.com',
        // Missing roles
      }),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/teams/:teamId/memberships returns 404 for non-existent team', async () => {
    // PROTECTS: 404 when creating membership for non-existent team
    const dto = buildCreateMembershipDTO()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/teams/nonexistentteam/memberships',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 404)
  })

  /**
   * MEMBERSHIP RETRIEVAL TESTS
   */

  it('GET /v1/teams/:teamId/memberships/:membershipId returns 200 for existing membership', async () => {
    // PROTECTS: Single membership retrieval works correctly
    const { sessionHeader } = await createUserAndSession(app)
    const teamId = await createTeam({ 'x-nuvix-session': sessionHeader })

    // Get memberships to find the owner's membership ID
    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}/memberships`,
      headers: { 'x-nuvix-session': sessionHeader },
    })
    const listBody = parseJson(listRes.payload)
    const membershipId = (listBody.data[0] as any).$id

    // Retrieve specific membership
    const res = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}/memberships/${membershipId}`,
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.$id).toBe(membershipId)
    expect(body.teamId).toBe(teamId)
  })

  it('GET /v1/teams/:teamId/memberships/:membershipId returns 404 for non-existent membership', async () => {
    // PROTECTS: 404 for unknown membership ID
    const { sessionHeader } = await createUserAndSession(app)
    const teamId = await createTeam({ 'x-nuvix-session': sessionHeader })

    const res = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}/memberships/nonexistentmembership`,
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 404)
  })

  /**
   * MEMBERSHIP UPDATE TESTS
   */

  it('PATCH /v1/teams/:teamId/memberships/:membershipId returns 200 and updates roles', async () => {
    // PROTECTS: Membership role update works correctly
    const { sessionHeader } = await createUserAndSession(app)
    const teamId = await createTeam({ 'x-nuvix-session': sessionHeader })

    // Get the owner's membership ID
    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}/memberships`,
      headers: { 'x-nuvix-session': sessionHeader },
    })
    const listBody = parseJson(listRes.payload)
    const membershipId = (listBody.data[0] as any).$id

    const updateDto = buildUpdateMembershipDTO({ roles: ['owner', 'admin'] })

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/teams/${teamId}/memberships/${membershipId}`,
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.roles).toEqual(expect.arrayContaining(['owner', 'admin']))
  })

  it('PATCH /v1/teams/:teamId/memberships/:membershipId returns 404 for non-existent membership', async () => {
    // PROTECTS: 404 when updating non-existent membership
    const { sessionHeader } = await createUserAndSession(app)
    const teamId = await createTeam({ 'x-nuvix-session': sessionHeader })
    const updateDto = buildUpdateMembershipDTO()

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/teams/${teamId}/memberships/nonexistentmembership`,
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(res, 404)
  })

  /**
   * MEMBERSHIP DELETION TESTS
   */

  it('DELETE /v1/teams/:teamId/memberships/:membershipId returns 404 for non-existent membership', async () => {
    // PROTECTS: 404 when deleting non-existent membership
    const { sessionHeader } = await createUserAndSession(app)
    const teamId = await createTeam({ 'x-nuvix-session': sessionHeader })

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/teams/${teamId}/memberships/nonexistentmembership`,
      headers: { 'x-nuvix-session': sessionHeader },
    })

    assertStatusCode(res, 404)
  })
})
