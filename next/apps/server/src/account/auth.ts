import type { Doc } from '@nuvix/db'
import { UnauthorizedError } from '../shared/errors'
import type { Users } from '../types/generated'

export function requireAuth(user?: Doc<Users>): string {
  if (!user || user.empty()) {
    throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
  }
  return user.getId()
}
