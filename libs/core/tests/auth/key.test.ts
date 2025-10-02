import { JwtService } from '@nestjs/jwt'
import { roles } from '@nuvix/core/config'
import { Key, UserRole } from '@nuvix/core/helper'
import { Doc } from '@nuvix/db'
import { ApiKey, configuration } from '@nuvix/utils'
import { Projects } from '@nuvix/utils/types'
import { describe, it, expect } from 'vitest'

describe('Key', () => {
  beforeAll(() => {
    Key.setJwtService(
      new JwtService({
        secret: configuration.security.jwtSecret || 'secret',
      }),
    )
  })
  it('should decode key correctly', async () => {
    const projectId = 'test'
    const usage = false
    const scopes = ['databases.read', 'collections.read', 'documents.read']
    const roleScopes = roles['apps']?.scopes || []

    const key = generateKey(projectId, usage, scopes)
    const project = new Doc<Projects>({ $id: projectId })
    const decoded = await Key.decode(project, key)

    expect(decoded.getProjectId()).toBe(projectId)
    expect(decoded.getType()).toBe(ApiKey.DYNAMIC)
    expect(decoded.getRole()).toBe(UserRole.APPS)
    expect(decoded.getScopes()).toEqual([...scopes, ...roleScopes])
  })
})

function generateKey(
  projectId: string,
  usage: boolean,
  scopes: string[],
): string {
  const jwt = new JwtService({
    secret: configuration.security.jwtSecret || 'secret',
  })

  const apiKey = jwt.sign(
    {
      projectId,
      usage,
      scopes,
    },
    {
      expiresIn: '1h',
    },
  )

  return `${ApiKey.DYNAMIC}_${apiKey}`
}
