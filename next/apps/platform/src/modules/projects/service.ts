/**
 * Project lifecycle service (D20). Owns business rules; routes never touch
 * `Database`, sessions, or the `TenantProvisioner` directly (AGENTS.md).
 * Contract: docs/api/platform.md
 */

import { ID } from '@nuvix/core'
import { BadGatewayError, NotFoundError } from '@nuvix/core/errors'
import type { TenantProvisioner } from '@nuvix/core/tenants'
import { type Database, Doc } from '@nuvix/db'
import type { Projects, ProjectsCreateInput } from '../../types/generated'

export interface CreateProjectInput {
  name: string
  /** Standard v2 create-id convention (D28): `'unique()'` (default) or a caller-supplied id. */
  id?: string
}

export type ProjectStatus = 'provisioning' | 'active' | 'error'

/** Public project shape — `target` (tenant connection + password) is never returned. */
export interface ProjectView {
  $id: string
  name: string
  status: ProjectStatus
  publishableKey: string
  containerName: string
  volumeName: string
  errorMessage?: string
  $createdAt: Date | string | null
  $updatedAt: Date | string | null
}

// `Doc.get()`'s generic transform mishandles `Date`-typed fields (treats them
// as plain objects to recurse into); `toObject()` returns the untransformed
// `Projects` shape directly, sidestepping that upstream typing gap.
function toView(doc: Doc<Projects>): ProjectView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    name: data.name,
    status: data.status as ProjectStatus,
    publishableKey: data.publishableKey,
    containerName: data.containerName,
    volumeName: data.volumeName,
    ...(data.errorMessage ? { errorMessage: data.errorMessage } : {}),
    $createdAt: data.$createdAt,
    $updatedAt: data.$updatedAt,
  }
}

export class ProjectService {
  constructor(
    private readonly db: Database,
    private readonly provisioner: TenantProvisioner,
  ) {}

  /**
   * Creates the project record, then provisions its dedicated tenant
   * container synchronously (docs/api/platform.md — backgrounding this is a
   * Phase 6 follow-up, not silently dropped). On provisioning failure the
   * record is kept with `status: "error"` for operator visibility rather
   * than rolled back, since the container/volume may have partially formed.
   */
  async create(input: CreateProjectInput): Promise<ProjectView> {
    const id = ID.auto(input.id)
    const publishableKey = `pk_${crypto.randomUUID().replaceAll('-', '')}`
    const session = this.db.system()

    let handle: Awaited<ReturnType<TenantProvisioner['provision']>>['handle']
    let target: Awaited<ReturnType<TenantProvisioner['provision']>>['target']
    try {
      ;({ handle, target } = await this.provisioner.provision({ projectId: id }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new BadGatewayError(`Failed to provision tenant database: ${message}`, {
        code: 'project_provision_failed',
      })
    }

    const createInput: ProjectsCreateInput = {
      name: input.name,
      status: 'provisioning',
      publishableKey,
      containerName: handle.containerName,
      volumeName: handle.volumeName,
    }
    let project = await session.createDocument(
      'projects',
      new Doc<Projects>({ $id: id, $permissions: [], ...createInput }),
    )

    try {
      await this.provisioner.waitUntilReady(target)
      project = await session.updateDocument(
        'projects',
        id,
        new Doc<Projects>({ status: 'active', target }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      project = await session.updateDocument(
        'projects',
        id,
        new Doc<Projects>({ status: 'error', errorMessage: message }),
      )
      throw new BadGatewayError(`Failed to provision tenant database: ${message}`, {
        code: 'project_provision_failed',
      })
    }

    return toView(project)
  }

  async list(limit = 25, offset = 0): Promise<{ projects: ProjectView[]; total: number }> {
    const session = this.db.system()
    const [projects, total] = await Promise.all([
      session.find('projects', (qb) => qb.limit(limit).offset(offset)),
      session.count('projects'),
    ])
    return { projects: projects.map(toView), total }
  }

  async get(id: string): Promise<ProjectView> {
    return toView(await this.getDoc(id))
  }

  /** Deprovisions the tenant container (and, with `purge`, its volume) then deletes the record. */
  async delete(id: string, options: { purge?: boolean } = {}): Promise<void> {
    const project = await this.getDoc(id)
    const session = this.db.system()
    await this.provisioner.deprovision(
      {
        projectId: id,
        containerName: project.get('containerName'),
        volumeName: project.get('volumeName'),
      },
      options,
    )
    await session.deleteDocument('projects', id)
  }

  private async getDoc(id: string): Promise<Doc<Projects>> {
    const project = await this.db.system().getDocument('projects', id)
    if (project.empty()) {
      throw new NotFoundError('Project', { code: 'project_not_found' })
    }
    return project
  }
}
