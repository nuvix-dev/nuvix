import { JwtService } from '@nestjs/jwt'
import { Doc } from '@nuvix/db'
import { ApiKey } from '@nuvix/utils'
import { Projects } from '@nuvix/utils/types'
import { describe, expect, it } from 'vitest'
import { roles } from '../../src/config'
import { Key, UserRole } from '../../src/helpers'

describe('Key', () => {
  beforeAll(() => {
    Key.setJwtService(
      new JwtService({
        secret: 'secret',
      }),
    )
  })
  it('should decode key correctly', async () => {
    const projectId = 'test'
    const usage = false
    const scopes = ['databases.read', 'collections.read', 'documents.read']
    const roleScopes = roles.apps?.scopes || []

    const key = await generateKey(projectId, usage, scopes)
    const project = new Doc<Projects>({ $id: projectId })
    const decoded = await Key.decode(project, key)

    expect(decoded.getProjectId()).toBe(projectId)
    expect(decoded.getType()).toBe(ApiKey.DYNAMIC)
    expect(decoded.getRole()).toBe(UserRole.APPS)
    expect(decoded.getScopes()).toEqual([...scopes, ...roleScopes])
  })
})

async function generateKey(
  projectId: string,
  usage: boolean,
  scopes: string[],
): Promise<string> {
  const jwt = new JwtService({
    secret: 'secret',
  })

  const apiKey = await jwt.signAsync(
    {
      projectId,
      usage,
      scopes,
    },
    {
      expiresIn: '15m',
    },
  )

  return `${ApiKey.DYNAMIC}_${apiKey}`
}
