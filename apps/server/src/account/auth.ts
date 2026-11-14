/** Provides the account-layer guard that turns an authenticated user document into a stable user id. */
import type { Doc } from '@nuvix/db'
import { UnauthorizedError } from '../shared/errors'
import type { Users } from '../types/generated'

/** Reject requests without a resolved user document before account operations run. */
export function requireAuth(user?: Doc<Users>): string {
  if (!user || user.empty()) {
    throw new UnauthorizedError('Unauthorized', { code: 'user_unauthorized' })
  }
  return user.getId()
}
