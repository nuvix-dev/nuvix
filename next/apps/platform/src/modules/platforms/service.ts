import { ID } from '@nuvix/core'
import { NotFoundError } from '@nuvix/core/errors'
import { type Database, Doc, Query } from '@nuvix/db'
import type { Platforms } from '../../types/generated'

export interface CreatePlatformInput {
  type: string
  name: string
  key?: string | null
  store?: string | null
  hostname?: string | null
}

export interface UpdatePlatformInput {
  name?: string
  key?: string | null
  store?: string | null
  hostname?: string | null
}

export interface PlatformView {
  $id: string
  projectId: string
  type: string
  name: string
  key: string | null
  store: string | null
  hostname: string | null
  $createdAt: Date | string | null
  $updatedAt: Date | string | null
}

function toView(doc: Doc<Platforms>): PlatformView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    projectId: data.projectId,
    type: data.type,
    name: data.name,
    key: data.key ?? null,
    store: data.store ?? null,
    hostname: data.hostname ?? null,
    $createdAt: data.$createdAt,
    $updatedAt: data.$updatedAt,
  }
}

export class PlatformsService {
  constructor(private readonly db: Database) {}

  /**
   * Resolve project by public ID.
   */
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

  /**
   * List all platforms for a project.
   */
  async list(
    projectId: string,
    limit = 25,
    offset = 0,
  ): Promise<{ platforms: PlatformView[]; total: number }> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const queries = [
      Query.equal('projectInternalId', [project.getSequence()]),
      Query.limit(limit),
      Query.offset(offset),
    ]

    const filterQueries = [Query.equal('projectInternalId', [project.getSequence()])]

    const docs = await session.find('platforms', queries)
    const total = await session.count('platforms', filterQueries)

    return {
      platforms: docs.map(toView),
      total,
    }
  }

  /**
   * Create a platform for a project.
   */
  async create(projectId: string, input: CreatePlatformInput): Promise<PlatformView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const platformId = ID.unique()

    const doc = new Doc<Platforms>({
      $id: platformId,
      projectInternalId: project.getSequence(),
      projectId,
      type: input.type,
      name: input.name,
      key: input.key ?? null,
      store: input.store ?? null,
      hostname: input.hostname ?? null,
    })

    const created = await session.createDocument('platforms', doc)
    return toView(created)
  }

  /**
   * Get a single platform for a project.
   */
  async get(projectId: string, platformId: string): Promise<PlatformView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const platform = await session.getDocument('platforms', platformId)
    if (
      platform.empty() ||
      platform.get('projectInternalId') !== project.getSequence() ||
      platform.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Platform not found', {
        code: 'platform_not_found',
      })
    }

    return toView(platform)
  }

  /**
   * Update a platform.
   */
  async update(
    projectId: string,
    platformId: string,
    input: UpdatePlatformInput,
  ): Promise<PlatformView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const platform = await session.getDocument('platforms', platformId)
    if (
      platform.empty() ||
      platform.get('projectInternalId') !== project.getSequence() ||
      platform.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Platform not found', {
        code: 'platform_not_found',
      })
    }

    if (input.name !== undefined) platform.set('name', input.name)
    if (input.key !== undefined) platform.set('key', input.key)
    if (input.store !== undefined) platform.set('store', input.store)
    if (input.hostname !== undefined) platform.set('hostname', input.hostname)

    const updated = await session.updateDocument('platforms', platformId, platform)
    return toView(updated)
  }

  /**
   * Delete a platform.
   */
  async delete(projectId: string, platformId: string): Promise<void> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const platform = await session.getDocument('platforms', platformId)
    if (
      platform.empty() ||
      platform.get('projectInternalId') !== project.getSequence() ||
      platform.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Platform not found', {
        code: 'platform_not_found',
      })
    }

    await session.deleteDocument('platforms', platformId)
  }
}
