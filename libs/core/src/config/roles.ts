import { UserRole } from '../helpers'
import { scopes } from './scopes'

const member = [
  'global',
  'public',
  'home',
  'sessions.write',
  'account',
  'teams.read',
  'teams.write',
  'documents.read',
  'documents.write',
  'files.read',
  'files.write',
  'projects.read',
  'projects.write',
  'locale.read',
  'avatars.read',
  'targets.read',
  'targets.write',
  'subscribers.read',
  'subscribers.write',
  'schemas.tables.read',
  'schemas.tables.write',
] as const

const _admins = [
  'global',
  'sessions.write',
  'teams.read',
  'teams.write',
  'documents.read',
  'documents.write',
  'files.read',
  'files.write',
  'buckets.read',
  'buckets.write',
  'users.read',
  'users.write',
  'collections.read',
  'collections.write',
  'platforms.read',
  'platforms.write',
  'keys.read',
  'keys.write',
  'webhooks.read',
  'webhooks.write',
  'locale.read',
  'avatars.read',
  'health.read',
  'targets.read',
  'targets.write',
  'providers.read',
  'providers.write',
  'messages.read',
  'messages.write',
  'topics.read',
  'topics.write',
  'subscribers.read',
  'subscribers.write',

  // schema
  'schemas.read',
  'schemas.write',
  'schemas.tables.read',
  'schemas.tables.write',
] as const

const admins = [..._admins, ...Object.keys(scopes)]

export const roles = {
  [UserRole.GUESTS]: {
    label: 'Guests',
    scopes: [
      'global',
      'public',
      'home',
      'sessions.write',
      'documents.read',
      'documents.write',
      'files.read',
      'files.write',
      'locale.read',
      'avatars.read',
      'schemas.tables.read',
      'schemas.tables.write',
    ],
  },
  [UserRole.USERS]: {
    label: 'Users',
    scopes: member,
  },
  [UserRole.ADMIN]: {
    label: 'Admin',
    scopes: admins,
  },
  [UserRole.DEVLOPER]: {
    label: 'Developer',
    scopes: admins,
  },
  [UserRole.OWNER]: {
    label: 'Owner',
    scopes: [...admins, ...member],
  },
  [UserRole.APPS]: {
    label: 'Applications',
    scopes: ['global', 'health.read'],
  },
}

const _owner = [...member, ..._admins] as const

export type Scopes = (typeof _owner)[number] | keyof typeof scopes
