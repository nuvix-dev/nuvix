import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../../shared/errors'
import type { Targets } from '../../../types/generated'
import { formatTarget, type TargetView } from '../../users/formatter'

export interface CreatePushTargetInput {
  targetId?: string
  identifier: string
  providerId?: string
}

export async function createPushTarget(
  session: Session,
  userId: string,
  sessionId?: string,
  input?: CreatePushTargetInput,
): Promise<TargetView> {
  const identifier = input?.identifier ?? ''
  const existing = await session.find('targets', [
    Query.equal('userId', [userId]),
    Query.equal('identifier', [identifier]),
  ])
  if (existing.length > 0) {
    throw new ConflictError('Target already exists', { code: 'user_target_already_exists' })
  }

  let name = 'Push Target'
  if (sessionId) {
    const sess = await session.getDocument('sessions', sessionId)
    if (!sess.empty()) {
      const brand = sess.get('deviceBrand') || sess.get('deviceName') || sess.get('clientName')
      if (brand) name = String(brand)
    }
  }

  const targetId = input?.targetId || ID.unique()
  const targetData: Targets = {
    $id: targetId,
    $createdAt: null,
    $updatedAt: null,
    $permissions: [
      Permission.read(Role.user(userId)).toString(),
      Permission.update(Role.user(userId)).toString(),
      Permission.delete(Role.user(userId)).toString(),
    ],
    $sequence: 0,
    $collection: 'targets',
    userId,
    providerType: 'push',
    providerId: input?.providerId ?? '',
    identifier,
    name,
    expired: false,
  }

  const doc = await session.createDocument('targets', new Doc<Targets>(targetData))
  return formatTarget(doc)
}

export async function updatePushTarget(
  session: Session,
  userId: string,
  targetId: string,
  input: { identifier: string },
): Promise<TargetView> {
  const doc = await session.getDocument('targets', targetId)
  if (doc.empty() || doc.get('userId') !== userId) {
    throw new NotFoundError('Target not found', { code: 'user_target_not_found' })
  }

  doc.set('identifier', input.identifier)
  doc.set('expired', false)
  const updated = await session.updateDocument('targets', targetId, doc)
  return formatTarget(updated)
}

export async function deletePushTarget(
  session: Session,
  userId: string,
  targetId: string,
): Promise<void> {
  const doc = await session.getDocument('targets', targetId)
  if (doc.empty() || doc.get('userId') !== userId) {
    throw new NotFoundError('Target not found', { code: 'user_target_not_found' })
  }

  await session.deleteDocument('targets', targetId)
}
