import type { IdentitiesDoc } from '../../types/generated'
import {
  formatMembership,
  formatSession,
  formatTarget,
  formatToken,
  formatUser,
  type MembershipView,
  type SessionView,
  type TargetView,
  type TokenView,
  type UserView,
} from '../users/formatter'

export type { MembershipView, SessionView, TargetView, TokenView, UserView as AccountView }
export { formatMembership, formatSession, formatTarget, formatToken, formatUser as formatAccount }

export interface IdentityView {
  $id: string
  $createdAt: string
  $updatedAt: string
  userId: string
  provider: string
  providerUid: string
  providerEmail: string
  providerAccessToken: string
  providerAccessTokenExpiry: string
  providerRefreshToken: string
}

export function formatIdentity(doc: IdentitiesDoc): IdentityView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    userId: doc.get('userId') ?? '',
    provider: doc.get('provider') ?? '',
    providerUid: doc.get('providerUid') ?? '',
    providerEmail: doc.get('providerEmail') ?? '',
    providerAccessToken: doc.get('providerAccessToken') ?? '',
    providerAccessTokenExpiry:
      (doc.get('providerAccessTokenExpiry') as string | Date)?.toString() ?? '',
    providerRefreshToken: doc.get('providerRefreshToken') ?? '',
  }
}
