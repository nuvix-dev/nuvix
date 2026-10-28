/** Platform API key lifecycle: generation, scoping, expiry, and deletion. */
import { randomBytes } from 'node:crypto'
import { ID } from '@nuvix/core'
import { NotFoundError } from '@nuvix/core/errors'
import { type Database, Doc, Query } from '@nuvix/db'
import type { Keys } from '../../types/generated'

/** Options when issuing a new API key. */
export interface CreateKeyInput {
  name: string
  scopes?: string[]
  expire?: string | null
}

/** Options when editing an existing API key. */
export interface UpdateKeyInput {
  name?: string
  scopes?: string[]
  expire?: string | null
}

/** API-key projection with the generated secret needed by clients to configure credentials securely. */
export interface KeyView {
  $id: string
  projectId: string
  name: string
  scopes: string[]
  secret: string
  expire: Date | string | null
  accessedAt: Date | string | null
  sdks: string[]
  $createdAt: Date | string | null
  $updatedAt: Date | string | null
}

function toView(doc: Doc<Keys>): KeyView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    projectId: data.projectId,
    name: data.name,
    scopes: data.scopes ?? [],
    secret: data.secret,
    expire: data.expire ?? null,
    accessedAt: data.accessedAt ?? null,
    sdks: data.sdks ?? [],
    $createdAt: data.$createdAt,
    $updatedAt: data.$updatedAt,
  }
}

/** Owns the `keys` collection for one project. */
export class KeysService {
  constructor(private readonly db: Database) {}

  /** Load the owning project or fail with a not-found error. */
  private async getProject(projectId: string) {
    const session = this.db.system()
    const project = await session.getDocument('projects', projectId)
    if (project.empty()) {
      throw new NotFoundError('Project not found', {
        code: 'project_not_found',
      })
    }
    return project
  }

  /** List the project's keys with pagination. */
  async list(
    projectId: string,
    limit = 25,
    offset = 0,
  ): Promise<{ keys: KeyView[]; total: number }> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const queries = [
      Query.equal('projectInternalId', [project.getSequence()]),
      Query.limit(limit),
      Query.offset(offset),
    ]

    const filterQueries = [Query.equal('projectInternalId', [project.getSequence()])]

    const docs = await session.find('keys', queries)
    const total = await session.count('keys', filterQueries)

    return {
      keys: docs.map(toView),
      total,
    }
  }

  /** Issue a project-owned key with a 128-byte random `standard_…` secret. */
  async create(projectId: string, input: CreateKeyInput): Promise<KeyView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const keyId = ID.unique()
    const secret = `standard_${randomBytes(128).toString('hex')}`

    const doc = new Doc<Keys>({
      $id: keyId,
      projectInternalId: project.getSequence(),
      projectId,
      name: input.name,
      scopes: input.scopes ?? [],
      secret,
      expire: input.expire ? new Date(input.expire) : undefined,
      accessedAt: undefined,
      sdks: [],
    })

    const created = await session.createDocument('keys', doc)
    return toView(created)
  }

  /** Fetch one key, enforcing that it belongs to the project. */
  async get(projectId: string, keyId: string): Promise<KeyView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const key = await session.getDocument('keys', keyId)
    if (
      key.empty() ||
      key.get('projectInternalId') !== project.getSequence() ||
      key.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Key not found', {
        code: 'key_not_found',
      })
    }

    return toView(key)
  }

  /** Update editable key metadata after confirming project ownership. */
  async update(projectId: string, keyId: string, input: UpdateKeyInput): Promise<KeyView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const key = await session.getDocument('keys', keyId)
    if (
      key.empty() ||
      key.get('projectInternalId') !== project.getSequence() ||
      key.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Key not found', {
        code: 'key_not_found',
      })
    }

    if (input.name !== undefined) key.set('name', input.name)
    if (input.scopes !== undefined) key.set('scopes', input.scopes)
    if (input.expire !== undefined) {
      key.set('expire', input.expire ? new Date(input.expire) : null)
    }

    const updated = await session.updateDocument('keys', keyId, key)
    return toView(updated)
  }

  /** Permanently remove a project-owned key after confirming its ownership. */
  async delete(projectId: string, keyId: string): Promise<void> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const key = await session.getDocument('keys', keyId)
    if (
      key.empty() ||
      key.get('projectInternalId') !== project.getSequence() ||
      key.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Key not found', {
        code: 'key_not_found',
      })
    }

    await session.deleteDocument('keys', keyId)
  }
}
