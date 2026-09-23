import { describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import { Doc, type Session } from '@nuvix/db'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { teamRoutes } from './routes'
import { TeamsService } from './service'

describe('team routes', () => {
  const teamDoc = new Doc({
    $id: 'team_test_1',
    name: 'Design',
    total: 1,
    prefs: { theme: 'dark' },
    $permissions: ['update("team:team_test_1/owner")'],
  })

  const membershipDoc = new Doc({
    $id: 'memb_test_1',
    teamId: 'team_test_1',
    userId: 'usr_alice',
    roles: ['owner'],
    confirm: true,
    invited: '2026-01-01',
    joined: '2026-01-01',
    $permissions: ['delete("user:usr_alice")'],
  })

  const mockSession = {
    getDocument: (col: string, id: string) => {
      if (col === 'teams' && id === 'team_test_1') return Promise.resolve(teamDoc)
      if (col === 'memberships' && id === 'memb_test_1') {
        return Promise.resolve(membershipDoc)
      }
      return Promise.resolve(new Doc({}))
    },
    findOne: () => Promise.resolve(new Doc({})),
    find: (col: string) => {
      if (col === 'teams') return Promise.resolve([teamDoc])
      if (col === 'memberships') return Promise.resolve([membershipDoc])
      return Promise.resolve([])
    },
    count: () => Promise.resolve(1),
    createDocument: (_col: string, doc: Doc<Record<string, unknown>>) => Promise.resolve(doc),
    updateDocument: (_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
      Promise.resolve(
        new Doc({
          ...teamDoc.toObject(),
          ...doc.toObject(),
        }),
      ),
    deleteDocument: () => Promise.resolve(true),
    deleteDocuments: () => Promise.resolve(['id1']),
  } as unknown as Session

  const service = new TeamsService(mockSession)
  const app = new Elysia()
    .use(
      problemErrors({
        getTranslator: () =>
          Promise.resolve({
            format: (k: string) => k,
          }) as never,
      }),
    )
    .use(teamRoutes(service, () => ({ userId: 'usr_alice', isPrivileged: false })))

  const client = treaty(app)

  test('POST /teams creates a team', async () => {
    const { data, status } = await client.teams.post({
      name: 'Design',
    })

    expect(status).toBe(200)
    expect(data?.name).toBe('Design')
    expect(data?.$id).toBeDefined()
  })

  test('GET /teams lists teams with pagination meta', async () => {
    const { data, status } = await client.teams.get({
      query: { limit: 10, offset: 0 },
    })

    expect(status).toBe(200)
    expect(data?.data.length).toBe(1)
    expect(data?.meta.total).toBe(1)
    expect(data?.meta.limit).toBe(10)
  })

  test('GET /teams/:teamId returns team', async () => {
    const { data, status } = await client.teams({ teamId: 'team_test_1' }).get()

    expect(status).toBe(200)
    expect(data?.$id).toBe('team_test_1')
    expect(data?.name).toBe('Design')
  })

  test('PUT /teams/:teamId updates name', async () => {
    const { data, status } = await client
      .teams({ teamId: 'team_test_1' })
      .put({ name: 'Design Ops' })

    expect(status).toBe(200)
    expect(data?.name).toBe('Design Ops')
  })

  test('GET /teams/:teamId/prefs and PUT /teams/:teamId/prefs', async () => {
    const getRes = await client.teams({ teamId: 'team_test_1' }).prefs.get()
    expect(getRes.status).toBe(200)
    expect(getRes.data).toEqual({ theme: 'dark' })

    const putRes = await client.teams({ teamId: 'team_test_1' }).prefs.put({ theme: 'light' })
    expect(putRes.status).toBe(200)
    expect(putRes.data).toEqual({ theme: 'light' })
  })

  test('POST /teams/:teamId/memberships invites a member', async () => {
    const { data, status } = await client.teams({ teamId: 'team_test_1' }).memberships.post({
      email: 'bob@example.com',
      roles: ['developer'],
      url: 'https://example.com/invite',
    })

    expect(status).toBe(200)
    expect(data?.status).toBe('invited')
    expect(data?.confirmUrl).toBeDefined()
  })

  test('GET /teams/:teamId/memberships lists memberships', async () => {
    const { data, status } = await client.teams({ teamId: 'team_test_1' }).memberships.get({
      query: { limit: 10, offset: 0 },
    })

    expect(status).toBe(200)
    expect(data?.data.length).toBe(1)
    expect(data?.data[0]?.userId).toBe('usr_alice')
  })

  test('DELETE /teams/:teamId deletes team', async () => {
    const { data, status } = await client.teams({ teamId: 'team_test_1' }).delete()

    expect(status).toBe(200)
    expect(data?.ok).toBe(true)
  })
})
