import { Doc, ID, Permission, Role, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'
import type { Targets, TargetsDoc, UsersDoc } from '../../types/generated'
import { formatTarget, type TargetView } from '../formatter'

export interface CreatePushTargetInput {
  userId: string
  sessionId?: string
  targetId?: string
  identifier: string
  providerId?: string
  name?: string
}

export interface UpdatePushTargetInput {
  userId: string
  targetId: string
  identifier?: string
  name?: string
}

export class AccountTargetsService {
  constructor(private readonly session: Session) {}

  async createPushTarget(input: CreatePushTargetInput): Promise<TargetView> {
    const targetId =
      input.targetId && input.targetId !== 'unique()' ? ID.custom(input.targetId) : ID.unique()

    const existing = (await this.session.getDocument('targets', targetId)) as TargetsDoc
    if (!existing.empty()) {
      throw new ConflictError('Target already exists', { code: 'user_target_already_exists' })
    }

    const user = (await this.session.getDocument('users', input.userId)) as UsersDoc

    const doc = new Doc<Targets>({
      $id: targetId,
      $permissions: [
        Permission.read(Role.user(input.userId)),
        Permission.update(Role.user(input.userId)),
        Permission.delete(Role.user(input.userId)),
      ],
      userId: input.userId,
      userInternalId: user.getSequence(),
      sessionId: input.sessionId,
      providerType: 'push',
      providerId: input.providerId,
      identifier: input.identifier,
      name: input.name ?? '',
      expired: false,
    })

    const created = (await this.session.createDocument('targets', doc)) as TargetsDoc
    return formatTarget(created)
  }

  async updatePushTarget(input: UpdatePushTargetInput): Promise<TargetView> {
    const doc = (await this.session.getDocument('targets', input.targetId)) as TargetsDoc
    if (doc.empty() || doc.get('userId') !== input.userId) {
      throw new NotFoundError('Target not found', { code: 'user_target_not_found' })
    }

    if (input.identifier) {
      doc.set('identifier', input.identifier)
      doc.set('expired', false)
    }
    if (input.name) {
      doc.set('name', input.name)
    }

    const updated = (await this.session.updateDocument(
      'targets',
      input.targetId,
      doc,
    )) as TargetsDoc
    return formatTarget(updated)
  }

  async deletePushTarget(userId: string, targetId: string): Promise<void> {
    const doc = (await this.session.getDocument('targets', targetId)) as TargetsDoc
    if (doc.empty() || doc.get('userId') !== userId) {
      throw new NotFoundError('Target not found', { code: 'user_target_not_found' })
    }

    await this.session.deleteDocument('targets', targetId)
  }
}
