import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { Auth, Detector } from '@nuvix/core/helpers'
import type { DeletesJobData } from '@nuvix/core/resolvers'
import {
  Authorization,
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  Role,
} from '@nuvix/db'
import { DeleteType, MessageType, QueueFor, Schemas } from '@nuvix/utils'
import type {
  ProjectsDoc,
  ProvidersDoc,
  Targets,
  UsersDoc,
} from '@nuvix/utils/types'
import { Queue } from 'bullmq'
import { CreatePushTargetDTO, UpdatePushTargetDTO } from './DTO/target.dto'

@Injectable()
export class TargetsService {
  constructor(
    @InjectQueue(QueueFor.DELETES)
    private readonly deletesQueue: Queue<DeletesJobData, unknown, DeleteType>,
  ) {}

  /**
   * Create Push Target
   */
  async createPushTarget({
    user,
    targetId,
    userAgent,
    providerId,
    identifier,
  }: WithDB<WithUser<CreatePushTargetDTO & { userAgent: string }>>) {
    const finalTargetId = targetId === 'unique()' ? ID.unique() : targetId

    let provider: ProvidersDoc | null = null
    if (providerId) {
      provider = await Authorization.skip(() =>
        this.db.withSchema(Schemas.Core, () =>
          this.db.getDocument('providers', providerId!),
        ),
      )
    }

    const target = await Authorization.skip(() =>
      this.db.getDocument('targets', finalTargetId),
    )

    if (!target.empty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS)
    }

    const detector = new Detector(userAgent)
    const device = detector.getDevice()

    const sessionId = Auth.sessionVerify(user.get('sessions', []), Auth.secret)
    const session = await this.db.getDocument('sessions', sessionId.toString())

    try {
      const createdTarget = await this.db.createDocument(
        'targets',
        new Doc<Targets>({
          $id: finalTargetId,
          $permissions: [
            Permission.read(Role.user(user.getId())),
            Permission.update(Role.user(user.getId())),
            Permission.delete(Role.user(user.getId())),
          ],
          providerId: provider ? provider.getId() : null,
          providerInternalId: provider ? provider.getSequence() : null,
          providerType: MessageType.PUSH,
          userId: user.getId(),
          userInternalId: user.getSequence(),
          sessionId: session.getId(),
          sessionInternalId: session.getSequence(),
          identifier: identifier,
          name: `${device.deviceBrand} ${device.deviceModel}`,
        }),
      )

      await this.db.purgeCachedDocument('users', user.getId())

      return createdTarget
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS)
      }
      throw error
    }
  }

  /**
   * Update Push Target
   */
  async updatePushTarget({
    user,
    request,
    targetId,
    identifier,
  }: WithDB<
    WithUser<UpdatePushTargetDTO & { request: NuvixRequest; targetId: string }>
  >) {
    const target = await Authorization.skip(
      async () => await this.db.getDocument('targets', targetId),
    )

    if (target.empty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND)
    }

    if (user.getId() !== target.get('userId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND)
    }

    if (identifier) {
      target.set('identifier', identifier).set('expired', false)
    }

    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
    const device = detector.getDevice()

    target.set('name', `${device.deviceBrand} ${device.deviceModel}`)

    const updatedTarget = await this.db.updateDocument(
      'targets',
      target.getId(),
      target,
    )

    await this.db.purgeCachedDocument('users', user.getId())

    return updatedTarget
  }

  /**
   * Delete Push Target
   */
  async deletePushTarget({
    user,
    targetId,
    project,
  }: WithDB<WithUser<{ targetId: string; project: ProjectsDoc }>>) {
    const target = await Authorization.skip(
      async () => await this.db.getDocument('targets', targetId),
    )

    if (target.empty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND)
    }

    if (user.getSequence() !== target.get('userInternalId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND)
    }

    await this.db.deleteDocument('targets', target.getId())

    await this.db.purgeCachedDocument('users', user.getId())

    await this.deletesQueue.add(DeleteType.TARGET, {
      document: target.clone(),
      project,
    })
  }
}

type WithDB<T = unknown> = T
type WithUser<T = unknown> = { user: UsersDoc } & T
