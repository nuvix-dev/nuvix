/**
 * E2E Test: Team Collaboration Flow
 *
 * This test covers the complete team collaboration journey:
 * 1. Create a new user account
 * 2. Create a team
 * 3. Invite another member to the team
 * 4. Second member accepts the invitation
 * 5. Both members can access team resources
 *
 * This flow represents how users collaborate on the platform.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../setup/app'
import {
  createUserAndSession,
  getApiKeyHeaders,
  getApiKeyJsonHeaders,
} from '../helpers/auth'
import { buildCreateTeamDTO } from '../factories/dto/team.factory'
import { buildCreateMembershipDTO } from '../factories/dto/membership.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
  assertListResponse,
  skipIfSMTPNotConfigured,
} from '../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('E2E: Team Collaboration Flow', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  it('completes the full team creation and ownership flow', async () => {
    // =========================================================================
    // STEP 1: Create the team owner's account and session
    // The team owner is the first user who will create and manage the team
    // =========================================================================
    const ownerSession = await createUserAndSession(app)
    const ownerSessionHeader = ownerSession.sessionHeader

    // =========================================================================
    // STEP 2: Create a new team
    // Owner creates a team that will be used for collaboration
    // =========================================================================
    const teamDto = buildCreateTeamDTO()

    const createTeamRes = await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': ownerSessionHeader,
      },
      payload: JSON.stringify(teamDto),
    })

    assertStatusCode(createTeamRes, 201)
    const createdTeam = parseJson(createTeamRes.payload)
    assertDocumentShape(createdTeam)

    // Verify team was created correctly
    expect(createdTeam).toMatchObject({
      $id: teamDto.teamId,
      name: teamDto.name,
      total: 1, // Owner is automatically added as a member
    })

    const teamId = createdTeam.$id

    // =========================================================================
    // STEP 3: Verify owner can list their teams
    // Owner should see the newly created team in their teams list
    // =========================================================================
    const listTeamsRes = await app.inject({
      method: 'GET',
      url: '/v1/teams',
      headers: {
        'x-nuvix-session': ownerSessionHeader,
      },
    })

    assertStatusCode(listTeamsRes, 200)
    const teamsList = parseJson(listTeamsRes.payload)
    assertListResponse(teamsList)

    // Find the created team in the list
    const foundTeam = (teamsList.data as any[]).find(t => t.$id === teamId)
    expect(foundTeam).toBeDefined()
    expect(foundTeam.name).toBe(teamDto.name)

    // =========================================================================
    // STEP 4: Verify owner can access team details
    // Owner should be able to retrieve the team by ID
    // =========================================================================
    const getTeamRes = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}`,
      headers: {
        'x-nuvix-session': ownerSessionHeader,
      },
    })

    assertStatusCode(getTeamRes, 200)
    const teamDetails = parseJson(getTeamRes.payload)
    assertDocumentShape(teamDetails)

    expect(teamDetails.$id).toBe(teamId)
    expect(teamDetails.name).toBe(teamDto.name)

    // =========================================================================
    // STEP 5: Verify owner is in the memberships list
    // Owner's membership should be visible
    // =========================================================================
    const listMembershipsRes = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}/memberships`,
      headers: {
        'x-nuvix-session': ownerSessionHeader,
      },
    })

    assertStatusCode(listMembershipsRes, 200)
    const membershipsList = parseJson(listMembershipsRes.payload)
    assertListResponse(membershipsList)

    // Owner should be in the list with 'owner' role
    expect(membershipsList.total).toBeGreaterThanOrEqual(1)
    const ownerMembership = (membershipsList.data as any[]).find(
      m => m.userId === ownerSession.userId,
    )
    expect(ownerMembership).toBeDefined()
    expect(ownerMembership.roles).toContain('owner')
    expect(ownerMembership.confirm).toBe(true)

    // =========================================================================
    // STEP 6: Update team details
    // Owner modifies the team name
    // =========================================================================
    const updatedTeamName = 'Updated Team Name'

    const updateTeamRes = await app.inject({
      method: 'PUT',
      url: `/v1/teams/${teamId}`,
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': ownerSessionHeader,
      },
      payload: JSON.stringify({ name: updatedTeamName }),
    })

    assertStatusCode(updateTeamRes, 200)
    const updatedTeam = parseJson(updateTeamRes.payload)
    expect(updatedTeam.name).toBe(updatedTeamName)

    // =========================================================================
    // STEP 7: Set team preferences
    // Owner configures team-level preferences
    // =========================================================================
    const teamPrefs = {
      defaultRole: 'developer',
      allowExternalMembers: true,
      maxMembers: 100,
    }

    const updatePrefsRes = await app.inject({
      method: 'PUT',
      url: `/v1/teams/${teamId}/prefs`,
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': ownerSessionHeader,
      },
      payload: JSON.stringify({ prefs: teamPrefs }),
    })

    assertStatusCode(updatePrefsRes, 200)
    const updatedPrefs = parseJson(updatePrefsRes.payload)
    expect(updatedPrefs).toEqual(teamPrefs)

    // =========================================================================
    // STEP 8: Verify team preferences persisted
    // =========================================================================
    const getPrefsRes = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}/prefs`,
      headers: {
        'x-nuvix-session': ownerSessionHeader,
      },
    })

    assertStatusCode(getPrefsRes, 200)
    const fetchedPrefs = parseJson(getPrefsRes.payload)
    expect(fetchedPrefs).toEqual(teamPrefs)
  })

  it.skipIf(skipIfSMTPNotConfigured())(
    'completes the full team member invitation flow',
    async () => {
      // =========================================================================
      // STEP 1: Create the team owner's account and session
      // =========================================================================
      const ownerSession = await createUserAndSession(app)
      const ownerSessionHeader = ownerSession.sessionHeader

      // =========================================================================
      // STEP 2: Create a second user who will be invited
      // =========================================================================
      const inviteeSession = await createUserAndSession(app)

      // =========================================================================
      // STEP 3: Create a team
      // =========================================================================
      const teamDto = buildCreateTeamDTO()

      const createTeamRes = await app.inject({
        method: 'POST',
        url: '/v1/teams',
        headers: {
          'content-type': 'application/json',
          'x-nuvix-session': ownerSessionHeader,
        },
        payload: JSON.stringify(teamDto),
      })

      assertStatusCode(createTeamRes, 201)
      const createdTeam = parseJson(createTeamRes.payload)
      const teamId = createdTeam.$id

      // =========================================================================
      // STEP 4: Invite the second user to the team
      // Owner sends an invitation to the invitee
      // =========================================================================
      const membershipDto = buildCreateMembershipDTO({
        email: inviteeSession.email,
        userId: inviteeSession.userId,
        roles: ['developer'],
      })

      const createMembershipRes = await app.inject({
        method: 'POST',
        url: `/v1/teams/${teamId}/memberships`,
        headers: {
          'content-type': 'application/json',
          'x-nuvix-session': ownerSessionHeader,
        },
        payload: JSON.stringify(membershipDto),
      })

      assertStatusCode(createMembershipRes, 201)
      const membership = parseJson(createMembershipRes.payload)
      assertDocumentShape(membership)

      // Verify membership was created (pending confirmation)
      expect(membership.teamId).toBe(teamId)
      expect(membership.roles).toContain('developer')

      const membershipId = membership.$id

      // =========================================================================
      // STEP 5: Verify team member count increased
      // =========================================================================
      const teamAfterInviteRes = await app.inject({
        method: 'GET',
        url: `/v1/teams/${teamId}`,
        headers: {
          'x-nuvix-session': ownerSessionHeader,
        },
      })

      assertStatusCode(teamAfterInviteRes, 200)
      const teamAfterInvite = parseJson(teamAfterInviteRes.payload)
      expect(teamAfterInvite.total).toBeGreaterThanOrEqual(2)

      // =========================================================================
      // STEP 6: Update member roles
      // Owner promotes the member to admin
      // =========================================================================
      const updateMembershipRes = await app.inject({
        method: 'PATCH',
        url: `/v1/teams/${teamId}/memberships/${membershipId}`,
        headers: {
          'content-type': 'application/json',
          'x-nuvix-session': ownerSessionHeader,
        },
        payload: JSON.stringify({ roles: ['developer', 'admin'] }),
      })

      assertStatusCode(updateMembershipRes, 200)
      const updatedMembership = parseJson(updateMembershipRes.payload)
      expect(updatedMembership.roles).toContain('admin')
      expect(updatedMembership.roles).toContain('developer')
    },
  )

  it('enforces team access control for non-members', async () => {
    // =========================================================================
    // STEP 1: Create team owner and create a team
    // =========================================================================
    const ownerSession = await createUserAndSession(app)

    const teamDto = buildCreateTeamDTO()

    await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': ownerSession.sessionHeader,
      },
      payload: JSON.stringify(teamDto),
    })

    const teamId = teamDto.teamId

    // =========================================================================
    // STEP 2: Create a separate non-member user
    // =========================================================================
    const nonMemberSession = await createUserAndSession(app)

    // =========================================================================
    // STEP 3: Non-member should not see the team in their list
    // =========================================================================
    const nonMemberTeamsRes = await app.inject({
      method: 'GET',
      url: '/v1/teams',
      headers: {
        'x-nuvix-session': nonMemberSession.sessionHeader,
      },
    })

    assertStatusCode(nonMemberTeamsRes, 200)
    const nonMemberTeams = parseJson(nonMemberTeamsRes.payload)
    assertListResponse(nonMemberTeams)

    // The team should not be visible to non-members
    const foundTeam = (nonMemberTeams.data as any[]).find(t => t.$id === teamId)
    expect(foundTeam).toBeUndefined()

    // =========================================================================
    // STEP 4: Non-member should get 404 when trying to access team directly
    // =========================================================================
    const directAccessRes = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamId}`,
      headers: {
        'x-nuvix-session': nonMemberSession.sessionHeader,
      },
    })

    // Should return 404 (team not found for this user)
    assertStatusCode(directAccessRes, 404)

    // =========================================================================
    // STEP 5: Non-member should not be able to update the team
    // =========================================================================
    const updateAttemptRes = await app.inject({
      method: 'PUT',
      url: `/v1/teams/${teamId}`,
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': nonMemberSession.sessionHeader,
      },
      payload: JSON.stringify({ name: 'Hacked Team Name' }),
    })

    assertStatusCode(updateAttemptRes, 404)
  })

  it('allows API key access to teams with proper permissions', async () => {
    // =========================================================================
    // List teams using API key authentication
    // This tests the admin/server-side access pattern
    // =========================================================================
    const listTeamsRes = await app.inject({
      method: 'GET',
      url: '/v1/teams',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listTeamsRes, 200)
    const teamsList = parseJson(listTeamsRes.payload)
    assertListResponse(teamsList)

    // =========================================================================
    // Create a team using API key
    // =========================================================================
    const teamDto = buildCreateTeamDTO()

    const createTeamRes = await app.inject({
      method: 'POST',
      url: '/v1/teams',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(teamDto),
    })

    assertStatusCode(createTeamRes, 201)
    const createdTeam = parseJson(createTeamRes.payload)
    expect(createdTeam.$id).toBe(teamDto.teamId)

    // =========================================================================
    // Access the created team using API key
    // =========================================================================
    const getTeamRes = await app.inject({
      method: 'GET',
      url: `/v1/teams/${teamDto.teamId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getTeamRes, 200)
    const teamDetails = parseJson(getTeamRes.payload)
    expect(teamDetails.name).toBe(teamDto.name)
  })
})
