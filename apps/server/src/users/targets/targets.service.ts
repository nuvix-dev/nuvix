import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Exception } from '@nuvix/core/extend/exception'
import { ID } from '@nuvix/core/helpers'
import { EmailValidator, PhoneValidator } from '@nuvix/core/validators'
import {
  Database,
  Doc,
  DuplicateException,
  Permission,
  Query,
  Role,
} from '@nuvix/db'
import { configuration, MessageType, Schemas } from '@nuvix/utils'
import type { ProvidersDoc } from '@nuvix/utils/types'
import { CreateTargetDTO, UpdateTargetDTO } from './DTO/target.dto'

@Injectable()
export class TargetsService {
  constructor(private readonly event: EventEmitter2) {}

  /**
   * Create a new target
   */
  async createTarget(
    db: Database,
    userId: string,
    { targetId, providerId, ...input }: CreateTargetDTO,
  ) {
    targetId = targetId === 'unique()' ? ID.unique() : targetId

    let provider!: ProvidersDoc
    if (providerId) {
      provider = await db.withSchema(Schemas.Core, () =>
        db.getDocument('providers', providerId),
      )
    }

    switch (input.providerType as MessageType) {
      case MessageType.EMAIL:
        if (!new EmailValidator().$valid(input.identifier)) {
          throw new Exception(Exception.GENERAL_INVALID_EMAIL)
        }
        break
      case MessageType.PUSH:
        break
      case MessageType.SMS:
        if (!new PhoneValidator().$valid(input.identifier)) {
          throw new Exception(Exception.GENERAL_INVALID_PHONE)
        }
        break
      default:
        throw new Exception(Exception.PROVIDER_INCORRECT_TYPE)
    }

    const user = await db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const existingTarget = await db.getDocument('targets', targetId)

    if (!existingTarget.empty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS)
    }

    try {
      const target = await db.createDocument(
        'targets',
        new Doc({
          $id: targetId,
          $permissions: [
            Permission.read(Role.user(user.getId())),
            Permission.update(Role.user(user.getId())),
            Permission.delete(Role.user(user.getId())),
          ],
          providerId: provider?.getId(),
          providerInternalId: provider?.getSequence(),
          providerType: input.providerType,
          userId: userId,
          userInternalId: user.getSequence(),
          identifier: input.identifier,
          name: input.name,
        }),
      )

      await db.purgeCachedDocument('users', user.getId())
      this.event.emit(
        `user.${user.getId()}.target.${target.getId()}.create`,
        target,
      )

      return target
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS)
      }
      throw error
    }
  }

  /**
   * Get all targets for a user
   */
  async getTargets(db: Database, userId: string, queries: Query[] = []) {
    const user = await db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }
    queries.push(Query.equal('userId', [userId]))

    return {
      data: await db.find('targets', queries),
      total: await db.count(
        'targets',
        queries,
        configuration.limits.limitCount,
      ),
    }
  }

  /**
   * Update a target
   */
  async updateTarget(
    db: Database,
    userId: string,
    targetId: string,
    input: UpdateTargetDTO,
  ) {
    const user = await db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const target = await db.getDocument('targets', targetId)

    if (target.empty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND)
    }

    if (user.getId() !== target.get('userId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND)
    }

    if (input.identifier) {
      const providerType = target.get('providerType')

      switch (providerType as MessageType) {
        case MessageType.EMAIL:
          if (!new EmailValidator().$valid(input.identifier)) {
            throw new Exception(Exception.GENERAL_INVALID_EMAIL)
          }
          break
        case MessageType.PUSH:
          break
        case MessageType.SMS:
          if (!new PhoneValidator().$valid(input.identifier)) {
            throw new Exception(Exception.GENERAL_INVALID_PHONE)
          }
          break
        default:
          throw new Exception(Exception.PROVIDER_INCORRECT_TYPE)
      }

      target.set('identifier', input.identifier)
    }

    if (input.providerId) {
      const provider = await db.getDocument('providers', input.providerId)

      if (provider.empty()) {
        throw new Exception(Exception.PROVIDER_NOT_FOUND)
      }

      if (provider.get('type') !== target.get('providerType')) {
        throw new Exception(Exception.PROVIDER_INCORRECT_TYPE)
      }

      target.set('providerId', provider.getId())
      target.set('providerInternalId', provider.getSequence())
    }

    if (input.name) {
      target.set('name', input.name)
    }

    const updatedTarget = await db.updateDocument(
      'targets',
      target.getId(),
      target,
    )
    await db.purgeCachedDocument('users', user.getId())

    return updatedTarget
  }

  /**
   * Get A target
   */
  async getTarget(db: Database, userId: string, targetId: string) {
    const user = await db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const target = await db.getDocument('targets', targetId)

    if (target.empty() || target.get('userId') !== userId) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND)
    }

    return target
  }

  /**
   * Delete a target
   */
  async deleteTarget(db: Database, userId: string, targetId: string) {
    const user = await db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const target = await db.getDocument('targets', targetId)

    if (target.empty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND)
    }

    if (user.getId() !== target.get('userId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND)
    }

    await db.deleteDocument('targets', target.getId())
    await db.purgeCachedDocument('users', user.getId())

    // TODO: Implement queue for deletes
  }
}
