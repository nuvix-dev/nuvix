/**
 * Shared `@nuvix/db` filter registry (1:1 with legacy libs/utils/src/database/filters.ts).
 */

import { Database, type Doc, type Filter, Query, type Session } from '@nuvix/db'
import { decryptSecret, encryptSecret } from '../tenants/encryption'

export const jsonFilter: Filter = {
  encode(value) {
    return value === null || value === undefined ? null : JSON.stringify(value)
  },
  decode(value) {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  },
}

export const castingFilter: Filter = {
  encode(value) {
    return JSON.stringify({ value }, (_key, val) =>
      typeof val === 'number' && !Number.isFinite(val) ? String(val) : val,
    )
  },
  decode(value) {
    if (value == null) return null
    try {
      return JSON.parse(value as string)?.value
    } catch {
      return value
    }
  },
}

export function createEncryptFilter(key: Uint8Array): Filter {
  return {
    async encode(value) {
      if (typeof value !== 'string') return null
      return encryptSecret(value, key)
    },
    async decode(value) {
      if (typeof value !== 'string') return value
      try {
        return await decryptSecret(value, key)
      } catch {
        return value
      }
    },
  }
}

export const userSearchFilter: Filter = {
  encode(_, doc: Doc) {
    const searchValues = [
      doc.getId(),
      doc.get('email', ''),
      doc.get('name', ''),
      doc.get('phone', ''),
    ]
    const labels = (doc.get('labels', []) as string[]) || []
    for (const label of labels) {
      searchValues.push(`label:${label}`)
    }
    return searchValues.filter(Boolean).join(' ')
  },
  decode(value) {
    return value
  },
}

export const providerSearchFilter: Filter = {
  encode(_, doc: Doc) {
    return [doc.getId(), doc.get('name', ''), doc.get('provider', ''), doc.get('type', '')]
      .filter(Boolean)
      .join(' ')
  },
  decode(value) {
    return value
  },
}

export const topicSearchFilter: Filter = {
  encode(_, doc: Doc) {
    return [doc.getId(), doc.get('name', ''), doc.get('description', '')].filter(Boolean).join(' ')
  },
  decode(value) {
    return value
  },
}

export const messageSearchFilter: Filter = {
  encode(_, doc: Doc) {
    const searchValues = [doc.getId(), doc.get('status', '')]
    const data = (doc.get('data') as Record<string, unknown>) || {}
    const providerType = (doc.get('providerType', '') as string) || ''
    if (providerType === 'email') {
      searchValues.push(String(data.subject ?? ''), 'email')
    } else if (providerType === 'sms') {
      searchValues.push(String(data.content ?? ''), 'sms')
    } else {
      searchValues.push(String(data.title ?? ''), 'push')
    }
    return searchValues.filter(Boolean).join(' ')
  },
  decode(value) {
    return value
  },
}

export const subQuerySessionsFilter: Filter = {
  encode: () => null,
  decode: (_, doc: Doc, db?: Session) => {
    if (!db) return []
    return db.find('sessions', [
      Query.equal('userInternalId', [doc.getSequence()]),
      Query.limit(100),
    ])
  },
}

export const subQueryTokensFilter: Filter = {
  encode: () => null,
  decode: (_, doc: Doc, db?: Session) => {
    if (!db) return []
    return db.find('tokens', [Query.equal('userInternalId', [doc.getSequence()]), Query.limit(100)])
  },
}

export const subQueryChallengesFilter: Filter = {
  encode: () => null,
  decode: (_, doc: Doc, db?: Session) => {
    if (!db) return []
    return db.find('challenges', [
      Query.equal('userInternalId', [doc.getSequence()]),
      Query.limit(100),
    ])
  },
}

export const subQueryAuthenticatorsFilter: Filter = {
  encode: () => null,
  decode: (_, doc: Doc, db?: Session) => {
    if (!db) return []
    return db.find('authenticators', [
      Query.equal('userInternalId', [doc.getSequence()]),
      Query.limit(100),
    ])
  },
}

export const subQueryMembershipsFilter: Filter = {
  encode: () => null,
  decode: (_, doc: Doc, db?: Session) => {
    if (!db) return []
    return db.find('memberships', [
      Query.equal('userInternalId', [doc.getSequence()]),
      Query.limit(100),
    ])
  },
}

export const subQueryTargetsFilter: Filter = {
  encode: () => null,
  decode: (_, doc: Doc, db?: Session) => {
    if (!db) return []
    return db.find('targets', [
      Query.equal('userInternalId', [doc.getSequence()]),
      Query.limit(100),
    ])
  },
}

export const subQueryTopicTargetsFilter: Filter = {
  encode: () => null,
  decode: async (_, doc: Doc, db?: Session) => {
    if (!db) return []
    const subscribers = await db.find('subscribers', [
      Query.equal('topicInternalId', [doc.getSequence()]),
      Query.limit(100),
    ])
    const targetIds = subscribers.map((s) => s.get('targetInternalId') as number).filter(Boolean)
    if (targetIds.length > 0) {
      return db.find('targets', [Query.equal('$sequence', targetIds)])
    }
    return []
  },
}

export const subQueryFilesFilter: Filter = {
  encode: () => null,
  decode: (_, doc: Doc, db?: Session) => {
    if (!db) return []
    return db.find('files', [
      Query.equal('bucketInternalId', [doc.getSequence()]),
      Query.limit(100),
    ])
  },
}

const ALREADY_REGISTERED = /already exists/i

function registerOnce(name: string, filter: Filter): void {
  try {
    Database.addFilter(name, filter)
  } catch (error) {
    if (error instanceof Error && ALREADY_REGISTERED.test(error.message)) {
      return
    }
    throw error
  }
}

/**
 * Registers all core DB filters matching legacy definitions.
 */
export function registerCoreDbFilters(encryptionKey?: Uint8Array): void {
  registerOnce('json', jsonFilter)
  registerOnce('casting', castingFilter)
  if (encryptionKey) {
    registerOnce('encrypt', createEncryptFilter(encryptionKey))
  }
  registerOnce('userSearch', userSearchFilter)
  registerOnce('providerSearch', providerSearchFilter)
  registerOnce('topicSearch', topicSearchFilter)
  registerOnce('messageSearch', messageSearchFilter)
  registerOnce('subQuerySessions', subQuerySessionsFilter)
  registerOnce('subQueryTokens', subQueryTokensFilter)
  registerOnce('subQueryChallenges', subQueryChallengesFilter)
  registerOnce('subQueryAuthenticators', subQueryAuthenticatorsFilter)
  registerOnce('subQueryMemberships', subQueryMembershipsFilter)
  registerOnce('subQueryTargets', subQueryTargetsFilter)
  registerOnce('subQueryTopicTargets', subQueryTopicTargetsFilter)
  registerOnce('subQueryFiles', subQueryFilesFilter)
}
