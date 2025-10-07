import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { ApiKey } from '@nuvix/utils'
import { randomBytes } from 'crypto'
import { CreateKeyDTO, UpdateKeyDTO } from './DTO/keys.dto'
import { Database, Doc, ID, Permission, Query, Role } from '@nuvix/db'
import { CoreService } from '@nuvix/core'
import { Keys } from '@nuvix/utils/types'

@Injectable()
export class KeysService {
  private readonly db: Database

  constructor(private coreService: CoreService) {
    this.db = this.coreService.getPlatformDb()
  }

  /**
   * Get keys of a project.
   */
  async getKeys(id: string) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const keys = await this.db.find('keys', [
      Query.equal('projectInternalId', [project.getSequence()]),
      Query.limit(5000),
    ])

    return {
      total: keys.length,
      data: keys,
    }
  }

  /**
   * Create a key for a project.
   */
  async createKey(id: string, input: CreateKeyDTO) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const key = new Doc<Keys>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      projectInternalId: project.getSequence(),
      projectId: project.getId(),
      name: input.name,
      scopes: input.scopes,
      expire: input.expire ?? null,
      sdks: [],
      accessedAt: null,
      secret: ApiKey.STANDARD + '_' + randomBytes(128).toString('hex'),
    })

    const createdKey = await this.db.createDocument('keys', key)

    await this.db.purgeCachedDocument('projects', project.getId())

    return createdKey
  }

  /**
   * Get a Key.
   */
  async getKey(id: string, keyId: string) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const key = await this.db.findOne('keys', [
      Query.equal('$id', [keyId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ])

    if (key.empty()) {
      throw new Exception(Exception.KEY_NOT_FOUND)
    }

    return key
  }

  /**
   * Update a Key.
   */
  async updateKey(id: string, keyId: string, input: UpdateKeyDTO) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const key = await this.db.findOne('keys', [
      Query.equal('$id', [keyId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ])

    if (key.empty()) {
      throw new Exception(Exception.KEY_NOT_FOUND)
    }

    key
      .update('name', input.name)
      .update('scopes', input.scopes)
      .update('expire', input.expire)

    await this.db.updateDocument('keys', key.getId(), key)
    await this.db.purgeCachedDocument('projects', project.getId())

    return key
  }

  /**
   * Delete a Key.
   */
  async deleteKey(id: string, keyId: string) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const key = await this.db.findOne('keys', [
      Query.equal('$id', [keyId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ])

    if (key.empty()) {
      throw new Exception(Exception.KEY_NOT_FOUND)
    }

    await this.db.deleteDocument('keys', key.getId())
    await this.db.purgeCachedDocument('projects', project.getId())
  }
}
