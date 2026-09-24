/**
 * Project lifecycle service (D20). Owns business rules; routes never touch
 * `Database`, sessions, or the `TenantProvisioner` directly (AGENTS.md).
 * Contract: docs/api/platform.md
 */

import { ID } from '@nuvix/core'
import { signJwt } from '@nuvix/core/auth'
import {
  apis,
  defaultSmtpConfig,
  type OAuthProviderType,
  oAuthProviders,
  services,
} from '@nuvix/core/config'
import {
  BadGatewayError,
  BadRequestError,
  NotFoundError,
  NotImplementedError,
} from '@nuvix/core/errors'
import { bootstrapAuthSchema } from '@nuvix/core/tenant-auth'
import { encryptSecret, type TenantProvisioner, type TenantTarget } from '@nuvix/core/tenants'
import { type Database, Doc } from '@nuvix/db'
import type { Projects, ProjectsCreateInput } from '../../types/generated'

export interface CreateProjectInput {
  name: string
  /** Standard v2 create-id convention (D28): `'unique()'` (default) or a caller-supplied id. */
  id?: string
  description?: string
  logo?: string
  url?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  logo?: string
  url?: string
}

export interface UpdateProjectServiceInput {
  service: string
  status: boolean
}

export interface UpdateProjectApiInput {
  api: string
  status: boolean
}

export interface UpdateOAuth2Input {
  provider: string
  appId?: string
  secret?: string
  enabled?: boolean
}

export interface UpdateSmtpInput {
  enabled: boolean
  senderName?: string
  senderEmail?: string
  replyTo?: string
  host?: string
  port?: number
  username?: string
  password?: string
  secure?: 'tls' | 'ssl' | boolean
}

export interface CreateJwtInput {
  scopes: string[]
  duration: number
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
  description?: string | null
  logo?: string | null
  url?: string | null
  services?: Record<string, unknown>
  apis?: Record<string, unknown>
  oAuthProviders?: unknown[]
  smtp?: Record<string, unknown>
  metadata?: Record<string, unknown>
  templates?: Record<string, unknown>
  auths?: Record<string, unknown>
  $createdAt: Date | string | null
  $updatedAt: Date | string | null
}

// `Doc.get()`'s generic transform mishandles `Date`-typed fields (treats them
// as plain objects to recurse into); `toObject()` returns the untransformed
// `Projects` shape directly, sidestepping that upstream typing gap.
export function toView(doc: Doc<Projects>): ProjectView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    name: data.name,
    status: data.status as ProjectStatus,
    publishableKey: data.publishableKey,
    containerName: data.containerName,
    volumeName: data.volumeName,
    ...(data.errorMessage ? { errorMessage: data.errorMessage } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.logo !== undefined ? { logo: data.logo } : {}),
    ...(data.url !== undefined ? { url: data.url } : {}),
    ...(data.services ? { services: data.services } : {}),
    ...(data.apis ? { apis: data.apis } : {}),
    ...(data.oAuthProviders
      ? {
          oAuthProviders: Array.isArray(data.oAuthProviders)
            ? (data.oAuthProviders as unknown[])
            : [],
        }
      : {}),
    ...(data.smtp ? { smtp: data.smtp } : {}),
    ...(data.metadata ? { metadata: data.metadata } : {}),
    ...(data.templates ? { templates: data.templates } : {}),
    ...(data.auths ? { auths: data.auths } : {}),
    $createdAt: data.$createdAt,
    $updatedAt: data.$updatedAt,
  }
}

export class ProjectService {
  constructor(
    private readonly db: Database,
    private readonly provisioner: TenantProvisioner,
    /**
     * Bootstraps the tenant's `auth` schema (users/sessions/teams/…) exactly
     * once, right here at creation time — never lazily per-request from the
     * server app (`TenantResource.authSession` assumes it already exists).
     * Injected so tests can fake it instead of opening a real connection to
     * `FakeTenantProvisioner`'s made-up target.
     */
    private readonly bootstrapTenantAuth: (
      target: TenantTarget,
    ) => Promise<void> = bootstrapAuthSchema,
    private readonly jwtSecret?: string,
    private readonly encryptionKey?: Uint8Array,
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
      ;({ handle, target } = await this.provisioner.provision({
        projectId: id,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new BadGatewayError(`Failed to provision tenant database: ${message}`, {
        code: 'project_provision_failed',
      })
    }

    const defaultOAuthProviders: OAuthProviderType[] = []
    for (const [key, value] of Object.entries(oAuthProviders)) {
      if (value.enabled) {
        defaultOAuthProviders.push({
          key,
          name: value.name,
          enabled: false,
        })
      }
    }

    const defaultServices: Record<string, boolean> = {}
    for (const value of Object.values(services)) {
      if (value.optional) {
        defaultServices[value.key] = true
      }
    }

    const defaultApis: Record<string, boolean> = {}
    for (const key of Object.keys(apis)) {
      defaultApis[key] = true
    }

    const createInput: ProjectsCreateInput = {
      name: input.name,
      status: 'provisioning',
      publishableKey,
      containerName: handle.containerName,
      volumeName: handle.volumeName,
      description: input.description,
      logo: input.logo,
      url: input.url,
      services: defaultServices,
      apis: defaultApis,
      oAuthProviders: defaultOAuthProviders as unknown as Record<string, unknown>,
      smtp: defaultSmtpConfig as unknown as Record<string, unknown>,
      metadata: { allowedSchemas: ['public'] },
      templates: {},
      auths: {},
    }
    let project = await session.createDocument(
      'projects',
      new Doc({ $id: id, $permissions: [], ...createInput }),
    )

    try {
      await this.provisioner.waitUntilReady(target)
      await this.bootstrapTenantAuth(target)
      project = (await session.updateDocument(
        'projects',
        id,
        new Doc({ status: 'active', target }),
      )) as Doc<Projects>
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

  async update(id: string, input: UpdateProjectInput): Promise<ProjectView> {
    const project = await this.getDoc(id)
    if (input.name !== undefined) project.set('name', input.name)
    if (input.description !== undefined) project.set('description', input.description)
    if (input.logo !== undefined) project.set('logo', input.logo)
    if (input.url !== undefined) project.set('url', input.url)

    const updated = await this.db.system().updateDocument('projects', id, project)
    return toView(updated as Doc<Projects>)
  }

  async updateServiceStatus(id: string, input: UpdateProjectServiceInput): Promise<ProjectView> {
    const project = await this.getDoc(id)
    if (!(input.service in services)) {
      throw new BadRequestError(`Unknown service: ${input.service}`, {
        code: 'service_not_found',
      })
    }
    const currentServices = (project.get('services') as Record<string, unknown>) ?? {}
    const updatedServices = { ...currentServices, [input.service]: input.status }
    project.set('services', updatedServices)

    const updated = await this.db.system().updateDocument('projects', id, project)
    return toView(updated as Doc<Projects>)
  }

  async updateAllServiceStatus(id: string, status: boolean): Promise<ProjectView> {
    const project = await this.getDoc(id)
    const servicesObj: Record<string, boolean> = {}
    for (const value of Object.values(services)) {
      if (value.optional) {
        servicesObj[value.key] = status
      }
    }
    project.set('services', servicesObj)

    const updated = await this.db.system().updateDocument('projects', id, project)
    return toView(updated as Doc<Projects>)
  }

  async updateApiStatus(id: string, input: UpdateProjectApiInput): Promise<ProjectView> {
    const project = await this.getDoc(id)
    if (!(input.api in apis)) {
      throw new BadRequestError(`Unknown API: ${input.api}`, {
        code: 'api_not_found',
      })
    }
    const currentApis = (project.get('apis') as Record<string, unknown>) ?? {}
    const updatedApis = { ...currentApis, [input.api]: input.status }
    project.set('apis', updatedApis)

    const updated = await this.db.system().updateDocument('projects', id, project)
    return toView(updated as Doc<Projects>)
  }

  async updateAllApiStatus(id: string, status: boolean): Promise<ProjectView> {
    const project = await this.getDoc(id)
    const apisObj: Record<string, boolean> = {}
    for (const key of Object.keys(apis)) {
      apisObj[key] = status
    }
    project.set('apis', apisObj)

    const updated = await this.db.system().updateDocument('projects', id, project)
    return toView(updated as Doc<Projects>)
  }

  async updateOAuth2(id: string, input: UpdateOAuth2Input): Promise<ProjectView> {
    const project = await this.getDoc(id)
    const rawProviders = (project.get('oAuthProviders') as unknown as OAuthProviderType[]) ?? []
    const providers = rawProviders.slice()
    const providerIndex = providers.findIndex((p) => p.key === input.provider)
    if (providerIndex === -1) {
      throw new NotFoundError('OAuth provider', { code: 'provider_not_found' })
    }

    const provider: OAuthProviderType = { ...providers[providerIndex]! }
    if (input.appId !== undefined) {
      provider.appId = input.appId
    }
    if (input.secret !== undefined) {
      if (this.encryptionKey) {
        provider.secret = await encryptSecret(input.secret, this.encryptionKey)
      } else {
        provider.secret = input.secret
      }
    }
    if (input.enabled !== undefined) {
      provider.enabled = input.enabled
    }
    providers[providerIndex] = provider
    project.set('oAuthProviders', providers as unknown as Record<string, unknown>)

    const updated = await this.db.system().updateDocument('projects', id, project)
    return toView(updated as Doc<Projects>)
  }

  async updateSMTP(id: string, input: UpdateSmtpInput): Promise<ProjectView> {
    const project = await this.getDoc(id)
    if (input.enabled) {
      if (!input.senderName) {
        throw new BadRequestError('Sender name is required when enabling SMTP.', {
          code: 'smtp_argument_invalid',
        })
      }
      if (!input.senderEmail) {
        throw new BadRequestError('Sender email is required when enabling SMTP.', {
          code: 'smtp_argument_invalid',
        })
      }
      if (!input.host) {
        throw new BadRequestError('Host is required when enabling SMTP.', {
          code: 'smtp_argument_invalid',
        })
      }
      if (!input.port) {
        throw new BadRequestError('Port is required when enabling SMTP.', {
          code: 'smtp_argument_invalid',
        })
      }
    }

    const smtp: Record<string, unknown> = input.enabled
      ? {
          enabled: true,
          senderName: input.senderName,
          senderEmail: input.senderEmail,
          replyTo: input.replyTo ?? '',
          host: input.host,
          port: input.port,
          username: input.username ?? '',
          password: input.password ?? '',
          secure: input.secure ?? false,
        }
      : {
          enabled: false,
        }

    project.set('smtp', smtp)
    const updated = await this.db.system().updateDocument('projects', id, project)
    return toView(updated as Doc<Projects>)
  }

  async createJwt(id: string, input: CreateJwtInput): Promise<{ jwt: string }> {
    const project = await this.getDoc(id)
    if (!this.jwtSecret) {
      throw new BadRequestError('JWT is not configured', { code: 'jwt_disabled' })
    }
    const token = await signJwt(
      { projectId: project.getId(), scopes: input.scopes },
      this.jwtSecret,
      input.duration,
    )
    return { jwt: `dynamic_${token}` }
  }

  async testSMTP(_id: string): Promise<void> {
    throw new NotImplementedError('SMTP test is not implemented', {
      code: 'not_implemented',
    })
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
