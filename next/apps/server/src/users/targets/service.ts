import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { NotFoundError } from '../../shared/errors'
import type { Targets, TargetsDoc, UsersDoc } from '../../types/generated'
import { formatTarget, type TargetView } from '../formatter'

export interface CreateTargetInput {
  providerType: string
  identifier: string
  providerId?: string
  name?: string
}

export interface UpdateTargetInput {
  identifier?: string
  providerId?: string
  name?: string
}

export class UserTargetsService {
  constructor(private readonly session: Session) {}

  async findAll(
    userId: string,
    queries: Query[] = [],
  ): Promise<{ total: number; targets: TargetView[] }> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const q = [Query.equal('userId', [userId]), ...queries]
    const docs = (await this.session.find('targets', q)) as TargetsDoc[]
    const total = await this.session.count('targets', Query.groupByType(q).filters)

    return {
      total,
      targets: docs.map(formatTarget),
    }
  }

  async findOne(userId: string, targetId: string): Promise<TargetView> {
    const targetDoc = (await this.session.getDocument('targets', targetId)) as TargetsDoc
    if (targetDoc.empty() || targetDoc.get('userId') !== userId) {
      throw new NotFoundError('Target not found', {
        code: 'user_target_not_found',
      })
    }
    return formatTarget(targetDoc)
  }

  async create(userId: string, input: CreateTargetInput): Promise<TargetView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const targetId = ID.unique()
    const targetDoc = (await this.session.createDocument(
      'targets',
      new Doc<Targets>({
        $id: targetId,
        $permissions: [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
        userId,
        userInternalId: userDoc.getSequence(),
        providerType: input.providerType,
        providerId: input.providerId ?? '',
        identifier: input.identifier,
        name: input.name ?? '',
        expired: false,
      }),
    )) as TargetsDoc

    return formatTarget(targetDoc)
  }

  async update(userId: string, targetId: string, input: UpdateTargetInput): Promise<TargetView> {
    const targetDoc = (await this.session.getDocument('targets', targetId)) as TargetsDoc
    if (targetDoc.empty() || targetDoc.get('userId') !== userId) {
      throw new NotFoundError('Target not found', {
        code: 'user_target_not_found',
      })
    }

    if (input.identifier !== undefined) targetDoc.set('identifier', input.identifier)
    if (input.providerId !== undefined) targetDoc.set('providerId', input.providerId)
    if (input.name !== undefined) targetDoc.set('name', input.name)

    const updated = (await this.session.updateDocument(
      'targets',
      targetId,
      targetDoc,
    )) as TargetsDoc

    return formatTarget(updated)
  }

  async delete(userId: string, targetId: string): Promise<{ status: 'success' }> {
    const targetDoc = (await this.session.getDocument('targets', targetId)) as TargetsDoc
    if (targetDoc.empty() || targetDoc.get('userId') !== userId) {
      throw new NotFoundError('Target not found', {
        code: 'user_target_not_found',
      })
    }

    await this.session.deleteDocument('targets', targetId)
    return { status: 'success' }
  }
}
