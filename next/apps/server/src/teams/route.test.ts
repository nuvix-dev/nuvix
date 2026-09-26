import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { Translator } from '@nuvix/i18n'
import { Elysia } from 'elysia'
import { problemErrors } from '../plugins/errors'
import type { MembershipView, TeamView } from './formatter'
import { teamRoutes } from './route'

describe('Teams Routes', () => {
  const store = new Map<string, Map<string, Doc>>()

  const getCollection = (name: string) => {
    let col = store.get(name)
    if (!col) {
      col = new Map()
      store.set(name, col)
    }
    return col
  }

  const mockSession = {
    find: async (collection: string, queries: Array<{ values?: unknown[] }> = []) => {
      const col = getCollection(collection)
      const all = [...col.values()]
      if (queries.length === 0) return all
      return all.filter((doc) => {
        for (const q of queries) {
          if (q.values && q.values.length > 0) {
            const val = q.values[0]
            const match =
              doc.get('teamId') === val ||
              doc.get('userId') === val ||
              doc.get('email') === val ||
              doc.get('name') === val
            if (!match) return false
          }
        }
        return true
      })
    },
    findOne: async (collection: string, queries: Array<{ values?: unknown[] }> = []) => {
      const col = getCollection(collection)
      for (const doc of col.values()) {
        for (const q of queries) {
          if (q.values && q.values.length > 0) {
            const val = q.values[0]
            if (doc.get('email') === val || doc.get('phone') === val || doc.get('userId') === val) {
              return doc
            }
          }
        }
      }
      return new Doc({})
    },
    getDocument: async (collection: string, id: string) => {
      const col = getCollection(collection)
      return col.get(id) ?? new Doc({})
    },
    createDocument: async (collection: string, doc: Doc) => {
      const col = getCollection(collection)
      col.set(doc.getId(), doc)
      return doc
    },
    updateDocument: async (collection: string, id: string, doc: Doc) => {
      const col = getCollection(collection)
      col.set(id, doc)
      return doc
    },
    deleteDocument: async (collection: string, id: string) => {
      const col = getCollection(collection)
      col.delete(id)
      return true
    },
    count: async (collection: string) => {
      return getCollection(collection).size
    },
  } as unknown as Session

  const currentUser = new Doc({
    $id: 'user_admin',
    name: 'Admin User',
    email: 'admin@example.com',
  })

  const testApp = new Elysia()
    .use(
      problemErrors({
        getTranslator: async () => new Translator('en', 'en', { primary: {}, fallback: {} }),
      }),
    )
    .derive('plugin', () => ({
      db: mockSession,
      user: currentUser,
    }))
    .use(teamRoutes())

  let createdTeamId = ''

  it('creates a team via POST /teams', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Marketing Team',
          roles: ['lead'],
        }),
      }),
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as TeamView
    expect(data.name).toBe('Marketing Team')
    expect(data.$id).toBeDefined()
    createdTeamId = data.$id
  })

  it('lists teams via GET /teams', async () => {
    const res = await testApp.handle(new Request('http://localhost/teams'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { total: number; teams: TeamView[] }
    expect(data.total).toBeGreaterThanOrEqual(1)
  })

  it('gets a team via GET /teams/:teamId', async () => {
    const res = await testApp.handle(new Request(`http://localhost/teams/${createdTeamId}`))
    expect(res.status).toBe(200)
    const data = (await res.json()) as TeamView
    expect(data.$id).toBe(createdTeamId)
    expect(data.name).toBe('Marketing Team')
  })

  it('updates team name via PUT /teams/:teamId', async () => {
    const res = await testApp.handle(
      new Request(`http://localhost/teams/${createdTeamId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Global Marketing',
        }),
      }),
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as TeamView
    expect(data.name).toBe('Global Marketing')
  })

  it('updates and gets team preferences', async () => {
    const putRes = await testApp.handle(
      new Request(`http://localhost/teams/${createdTeamId}/prefs`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prefs: { color: 'blue' },
        }),
      }),
    )
    expect(putRes.status).toBe(200)

    const getRes = await testApp.handle(
      new Request(`http://localhost/teams/${createdTeamId}/prefs`),
    )
    expect(getRes.status).toBe(200)
    const data = (await getRes.json()) as Record<string, unknown>
    expect(data.color).toBe('blue')
  })

  it('adds and lists team memberships', async () => {
    const res = await testApp.handle(
      new Request(`http://localhost/teams/${createdTeamId}/memberships`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'marketer@example.com',
          roles: ['analyst'],
          name: 'Marketer Jane',
        }),
      }),
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as MembershipView
    expect(data.userEmail).toBe('marketer@example.com')

    const listRes = await testApp.handle(
      new Request(`http://localhost/teams/${createdTeamId}/memberships`),
    )
    expect(listRes.status).toBe(200)
    const listData = (await listRes.json()) as { total: number; memberships: MembershipView[] }
    expect(listData.total).toBeGreaterThanOrEqual(1)
  })

  it('deletes team via DELETE /teams/:teamId', async () => {
    const res = await testApp.handle(
      new Request(`http://localhost/teams/${createdTeamId}`, {
        method: 'DELETE',
      }),
    )
    expect(res.status).toBe(200)

    const getRes = await testApp.handle(new Request(`http://localhost/teams/${createdTeamId}`))
    expect(getRes.status).toBe(404)
  })

  it('returns 501 for GET /teams/:teamId/logs', async () => {
    const res = await testApp.handle(new Request('http://localhost/teams/team_123/logs'))
    expect(res.status).toBe(501)
  })
})
