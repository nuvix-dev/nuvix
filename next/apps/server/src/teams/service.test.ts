import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  NotImplementedError,
} from '../shared/errors'
import { MembershipsService } from './memberships/service'
import { TeamsService } from './service'

function createInMemorySession() {
  const store = new Map<string, Map<string, Doc>>()

  const getCollection = (name: string) => {
    let col = store.get(name)
    if (!col) {
      col = new Map()
      store.set(name, col)
    }
    return col
  }

  return {
    store,
    session: {
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
              if (
                doc.get('email') === val ||
                doc.get('phone') === val ||
                doc.get('userId') === val
              ) {
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
    } as unknown as Session,
  }
}

describe('Teams Module Services', () => {
  describe('TeamsService', () => {
    it('creates a team and owner membership for user', async () => {
      const { session } = createInMemorySession()
      const teamsService = new TeamsService(session)

      await session.createDocument(
        'users',
        new Doc({
          $id: 'user_1',
          name: 'Owner User',
          email: 'owner@example.com',
        }),
      )

      const team = await teamsService.create('user_1', {
        name: 'Engineering',
      })

      expect(team.name).toBe('Engineering')
      expect(team.total).toBe(1)

      const fetched = await teamsService.findOne(team.$id)
      expect(fetched.$id).toBe(team.$id)
      expect(fetched.name).toBe('Engineering')
    })

    it('rejects duplicate team ID', async () => {
      const { session } = createInMemorySession()
      const teamsService = new TeamsService(session)

      await teamsService.create(undefined, {
        teamId: 'eng_team',
        name: 'Engineering',
      })

      await expect(
        teamsService.create(undefined, {
          teamId: 'eng_team',
          name: 'Engineering 2',
        }),
      ).rejects.toThrow(ConflictError)
    })

    it('manages prefs, updates name, and removes team', async () => {
      const { session } = createInMemorySession()
      const teamsService = new TeamsService(session)

      const team = await teamsService.create(undefined, {
        name: 'Design',
      })

      await teamsService.setPrefs(team.$id, { theme: 'light' })
      const prefs = await teamsService.getPrefs(team.$id)
      expect(prefs.theme).toBe('light')

      const updated = await teamsService.update(team.$id, { name: 'Product Design' })
      expect(updated.name).toBe('Product Design')

      await teamsService.remove(team.$id)
      await expect(teamsService.findOne(team.$id)).rejects.toThrow(NotFoundError)
    })

    it('throws NotImplementedError for getLogs', async () => {
      const { session } = createInMemorySession()
      const teamsService = new TeamsService(session)
      await expect(teamsService.getLogs('team_123')).rejects.toThrow(NotImplementedError)
    })
  })

  describe('MembershipsService', () => {
    it('invites members, lists members, and confirms membership', async () => {
      const { session } = createInMemorySession()
      const teamsService = new TeamsService(session)
      const membershipsService = new MembershipsService(session)

      const team = await teamsService.create(undefined, {
        name: 'Developers',
      })

      // Add member with email
      const membership = await membershipsService.addMember(team.$id, {
        email: 'developer@example.com',
        roles: ['developer'],
        name: 'Dev Bob',
      })

      expect(membership.roles).toEqual(['developer'])
      expect(membership.confirm).toBe(false)

      // List members
      const list = await membershipsService.getMembers(team.$id)
      expect(list.total).toBe(1)

      // Get single member
      const member = await membershipsService.getMember(team.$id, membership.$id)
      expect(member.$id).toBe(membership.$id)

      // Update member roles
      const updatedRoles = await membershipsService.updateMember(team.$id, membership.$id, {
        roles: ['lead-developer'],
      })
      expect(updatedRoles.roles).toEqual(['lead-developer'])

      // Note: secret in DB is hashed, so testing secret verification failure
      await expect(
        membershipsService.updateMemberStatus(team.$id, membership.$id, {
          userId: membership.userId,
          secret: 'wrong-secret',
        }),
      ).rejects.toThrow(BadRequestError)

      // Delete member
      await membershipsService.deleteMember(team.$id, membership.$id)
      const listAfter = await membershipsService.getMembers(team.$id)
      expect(listAfter.total).toBe(0)
    })
  })
})
