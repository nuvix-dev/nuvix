process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { FakeTenantProvisioner } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from '../projects/service'
import { AuthSettingsService } from './service'

let db: Database
let projectService: ProjectService
let authSettingsService: AuthSettingsService
let projectId: string

const noopBootstrap = async () => {}

beforeAll(async () => {
  db = await createPlatformDatabase()
  projectService = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
  authSettingsService = new AuthSettingsService(db)

  const project = await projectService.create({ name: 'Auth Settings Test Project' })
  projectId = project.$id
})

describe('AuthSettingsService', () => {
  test('updates session alerts', async () => {
    const auths = await authSettingsService.updateSessionAlerts(projectId, true)
    expect(auths.sessionAlerts).toBe(true)
  })

  test('updates auth limit', async () => {
    const auths = await authSettingsService.updateAuthLimit(projectId, 500)
    expect(auths.limit).toBe(500)
  })

  test('updates session duration', async () => {
    const auths = await authSettingsService.updateSessionDuration(projectId, 86400)
    expect(auths.duration).toBe(86400)
  })

  test('updates password history and dictionary', async () => {
    const history = await authSettingsService.updatePasswordHistory(projectId, 5)
    expect(history.passwordHistory).toBe(5)

    const dict = await authSettingsService.updatePasswordDictionary(projectId, true)
    expect(dict.passwordDictionary).toBe(true)
  })

  test('updates personal data check and max sessions', async () => {
    const pData = await authSettingsService.updatePersonalData(projectId, true)
    expect(pData.personalDataCheck).toBe(true)

    const maxSessions = await authSettingsService.updateMaxSessions(projectId, 10)
    expect(maxSessions.maxSessions).toBe(10)
  })

  test('updates mock numbers', async () => {
    const auths = await authSettingsService.updateMockNumbers(projectId, [
      { phone: '+1234567890', otp: '123456' },
    ])
    expect(auths.mockNumbers).toEqual([{ phone: '+1234567890', otp: '123456' }])
  })

  test('updates memberships privacy', async () => {
    const auths = await authSettingsService.updateMembershipsPrivacy(projectId, {
      userName: true,
      userEmail: false,
      mfa: true,
    })
    expect(auths.membershipsUserName).toBe(true)
    expect(auths.membershipsUserEmail).toBe(false)
    expect(auths.membershipsMfa).toBe(true)
  })

  test('updates auth method status', async () => {
    const auths = await authSettingsService.updateAuthMethod(projectId, 'anonymous', false)
    expect(auths.anonymous).toBe(false)
  })
})
