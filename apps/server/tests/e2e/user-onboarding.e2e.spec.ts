/**
 * E2E Test: User Onboarding Flow
 *
 * This test covers the complete user onboarding journey:
 * 1. Create a new account
 * 2. Login with email/password
 * 3. Update user profile (name)
 * 4. Set user preferences
 *
 * This flow represents the critical path for new users joining the platform.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../setup/app'
import { buildCreateAccountDTO } from '../factories/dto/account.factory'
import { buildCreateEmailSessionDTO } from '../factories/dto/session.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
} from '../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('E2E: User Onboarding Flow', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  it('completes the full user onboarding journey', async () => {
    // =========================================================================
    // STEP 1: Create a new account
    // User visits the registration page and creates a new account
    // =========================================================================
    const accountDto = buildCreateAccountDTO()

    const createAccountRes = await app.inject({
      method: 'POST',
      url: '/v1/account',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(accountDto),
    })

    assertStatusCode(createAccountRes, 201)
    const createdAccount = parseJson(createAccountRes.payload)
    assertDocumentShape(createdAccount)

    // Verify the account was created with the correct details
    expect(createdAccount).toMatchObject({
      $id: accountDto.userId,
      email: accountDto.email,
      name: accountDto.name,
      status: true,
      emailVerification: false,
      phoneVerification: false,
      mfa: false,
    })

    // Ensure sensitive data is not exposed
    expect(createdAccount.password).toBeUndefined()
    expect(createdAccount.hash).toBeUndefined()

    // =========================================================================
    // STEP 2: Login with email/password
    // User logs in with their newly created credentials
    // =========================================================================
    const sessionDto = buildCreateEmailSessionDTO({
      email: accountDto.email,
      password: accountDto.password,
    })

    const createSessionRes = await app.inject({
      method: 'POST',
      url: '/v1/account/sessions/email',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(sessionDto),
    })

    assertStatusCode(createSessionRes, 201)
    const session = parseJson(createSessionRes.payload)

    // Verify session was created with necessary data
    expect(session.secret).toBeDefined()
    expect(typeof session.secret).toBe('string')
    expect(session.secret.length).toBeGreaterThan(0)
    expect(session.userId).toBe(accountDto.userId)

    // Extract session token for subsequent authenticated requests
    const sessionHeader = session.secret

    // =========================================================================
    // STEP 3: Verify we can access the account with the session
    // This confirms the session is valid and working
    // =========================================================================
    const getAccountRes = await app.inject({
      method: 'GET',
      url: '/v1/account',
      headers: {
        'x-nuvix-session': sessionHeader,
      },
    })

    assertStatusCode(getAccountRes, 200)
    const accountData = parseJson(getAccountRes.payload)
    assertDocumentShape(accountData)

    expect(accountData.$id).toBe(accountDto.userId)
    expect(accountData.email).toBe(accountDto.email)

    // =========================================================================
    // STEP 4: Update user profile (change name)
    // User customizes their profile with a new display name
    // =========================================================================
    const newName = 'Updated Display Name'

    const updateNameRes = await app.inject({
      method: 'PATCH',
      url: '/v1/account/name',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ name: newName }),
    })

    assertStatusCode(updateNameRes, 200)
    const updatedAccount = parseJson(updateNameRes.payload)
    assertDocumentShape(updatedAccount)

    // Verify name was updated
    expect(updatedAccount.name).toBe(newName)
    expect(updatedAccount.$id).toBe(accountDto.userId)

    // =========================================================================
    // STEP 5: Set user preferences
    // User configures their app preferences (theme, language, notifications)
    // =========================================================================
    const userPreferences = {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      timezone: 'America/New_York',
    }

    const updatePrefsRes = await app.inject({
      method: 'PATCH',
      url: '/v1/account/prefs',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify({ prefs: userPreferences }),
    })

    assertStatusCode(updatePrefsRes, 200)
    const updatedPrefs = parseJson(updatePrefsRes.payload)

    // Verify preferences were saved correctly
    expect(updatedPrefs).toEqual(userPreferences)

    // =========================================================================
    // STEP 6: Verify preferences persisted
    // Confirm preferences are returned when fetching the account
    // =========================================================================
    const getPrefsRes = await app.inject({
      method: 'GET',
      url: '/v1/account/prefs',
      headers: {
        'x-nuvix-session': sessionHeader,
      },
    })

    assertStatusCode(getPrefsRes, 200)
    const fetchedPrefs = parseJson(getPrefsRes.payload)

    expect(fetchedPrefs).toEqual(userPreferences)

    // =========================================================================
    // STEP 7: Final verification - full account state
    // Confirm the complete account reflects all our changes
    // =========================================================================
    const finalAccountRes = await app.inject({
      method: 'GET',
      url: '/v1/account',
      headers: {
        'x-nuvix-session': sessionHeader,
      },
    })

    assertStatusCode(finalAccountRes, 200)
    const finalAccount = parseJson(finalAccountRes.payload)

    // Verify final state matches expectations
    expect(finalAccount).toMatchObject({
      $id: accountDto.userId,
      email: accountDto.email,
      name: newName,
      status: true,
      mfa: false,
    })
  })

  it('handles invalid login credentials gracefully', async () => {
    // =========================================================================
    // Create a valid account first
    // =========================================================================
    const accountDto = buildCreateAccountDTO()

    await app.inject({
      method: 'POST',
      url: '/v1/account',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(accountDto),
    })

    // =========================================================================
    // Attempt login with wrong password
    // =========================================================================
    const wrongPasswordSession = buildCreateEmailSessionDTO({
      email: accountDto.email,
      password: 'WrongPassword123!',
    })

    const wrongPasswordRes = await app.inject({
      method: 'POST',
      url: '/v1/account/sessions/email',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(wrongPasswordSession),
    })

    assertStatusCode(wrongPasswordRes, 401)
    const errorBody = parseJson(wrongPasswordRes.payload)
    expect(errorBody.message).toBeDefined()

    // =========================================================================
    // Attempt login with non-existent email
    // =========================================================================
    const nonExistentSession = buildCreateEmailSessionDTO({
      email: 'nonexistent@example.com',
      password: 'SomePassword123!',
    })

    const nonExistentRes = await app.inject({
      method: 'POST',
      url: '/v1/account/sessions/email',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(nonExistentSession),
    })

    assertStatusCode(nonExistentRes, 401)
  })

  it('prevents access to profile without valid session', async () => {
    // =========================================================================
    // Attempt to access account without session header
    // =========================================================================
    const noSessionRes = await app.inject({
      method: 'GET',
      url: '/v1/account',
    })

    assertStatusCode(noSessionRes, 401)

    // =========================================================================
    // Attempt to access account with invalid session token
    // =========================================================================
    const invalidSessionRes = await app.inject({
      method: 'GET',
      url: '/v1/account',
      headers: {
        'x-nuvix-session': 'invalid-session-token-12345',
      },
    })

    assertStatusCode(invalidSessionRes, 401)

    // =========================================================================
    // Attempt to update preferences without valid session
    // =========================================================================
    const updatePrefsRes = await app.inject({
      method: 'PATCH',
      url: '/v1/account/prefs',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ prefs: { theme: 'dark' } }),
    })

    assertStatusCode(updatePrefsRes, 401)
  })
})
