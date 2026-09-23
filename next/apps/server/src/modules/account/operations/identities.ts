import { Query, type Session } from '@nuvix/db'
import { NotFoundError } from '../../../shared/errors'
import type { IdentitiesDoc } from '../../../types/generated'

export interface IdentityView {
  $id: string
  $createdAt?: string
  $updatedAt?: string
  userId: string
  provider: string
  providerUid: string
  providerEmail: string
  providerAccessToken: string
  providerAccessTokenExpiry: string
  providerRefreshToken: string
}

export function formatIdentity(doc: IdentitiesDoc): IdentityView {
  const createdAt = doc.get('$createdAt')
  const updatedAt = doc.get('$updatedAt')
  const expiry = doc.get('providerAccessTokenExpiry')

  return {
    $id: doc.getId(),
    $createdAt: createdAt ? String(createdAt) : undefined,
    $updatedAt: updatedAt ? String(updatedAt) : undefined,
    userId: doc.get('userId') ?? '',
    provider: doc.get('provider') ?? '',
    providerUid: doc.get('providerUid') ?? '',
    providerEmail: doc.get('providerEmail') ?? '',
    providerAccessToken: doc.get('providerAccessToken') ?? '',
    providerAccessTokenExpiry: expiry ? String(expiry) : '',
    providerRefreshToken: doc.get('providerRefreshToken') ?? '',
  }
}

export async function listIdentities(session: Session, userId: string): Promise<IdentityView[]> {
  const docs = await session.find('identities', [Query.equal('userId', [userId])])
  return docs.map(formatIdentity)
}

export async function deleteIdentity(
  session: Session,
  userId: string,
  identityId: string,
): Promise<void> {
  const doc = await session.getDocument('identities', identityId)
  if (doc.empty() || doc.get('userId') !== userId) {
    throw new NotFoundError('Identity not found', { code: 'user_identity_not_found' })
  }

  await session.deleteDocument('identities', identityId)
}
