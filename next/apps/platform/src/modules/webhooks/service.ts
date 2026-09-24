/**
 * Platform webhooks service.
 * Manages webhook subscriptions for projects.
 */

import { randomBytes } from 'node:crypto'
import { ID } from '@nuvix/core'
import { NotFoundError } from '@nuvix/core/errors'
import { type Database, Doc, Query } from '@nuvix/db'
import type { Webhooks } from '../../types/generated'

export interface CreateWebhookInput {
  name: string
  url: string
  events: string[]
  security?: boolean
  httpUser?: string
  httpPass?: string
  enabled?: boolean
  signatureKey?: string
}

export interface UpdateWebhookInput {
  name?: string
  url?: string
  events?: string[]
  security?: boolean
  httpUser?: string
  httpPass?: string
  enabled?: boolean
}

export interface WebhookView {
  $id: string
  projectId: string
  name: string
  url: string
  events: string[]
  security: boolean
  httpUser: string | null
  enabled: boolean
  signatureKey: string | null
  logs: string
  attempts: number
  $createdAt: Date | string | null
  $updatedAt: Date | string | null
}

function toView(doc: Doc<Webhooks>): WebhookView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    projectId: data.projectId,
    name: data.name,
    url: data.url,
    events: data.events,
    security: data.security,
    httpUser: data.httpUser ?? null,
    enabled: data.enabled,
    signatureKey: data.signatureKey ?? null,
    logs: data.logs ?? '',
    attempts: data.attempts ?? 0,
    $createdAt: data.$createdAt,
    $updatedAt: data.$updatedAt,
  }
}

export class WebhooksService {
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
   * List all webhooks for a project.
   */
  async list(
    projectId: string,
    limit = 25,
    offset = 0,
  ): Promise<{ webhooks: WebhookView[]; total: number }> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const queries = [
      Query.equal('projectInternalId', [project.getSequence()]),
      Query.limit(limit),
      Query.offset(offset),
    ]

    const filterQueries = [Query.equal('projectInternalId', [project.getSequence()])]

    const docs = await session.find('webhooks', queries)
    const total = await session.count('webhooks', filterQueries)

    return {
      webhooks: docs.map(toView),
      total,
    }
  }

  /**
   * Create a webhook for a project.
   */
  async create(projectId: string, input: CreateWebhookInput): Promise<WebhookView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const webhookId = ID.unique()
    const signatureKey = input.signatureKey || randomBytes(64).toString('hex')

    const doc = new Doc<Webhooks>({
      $id: webhookId,
      projectInternalId: project.getSequence(),
      projectId,
      name: input.name,
      url: input.url,
      events: input.events,
      security: input.security ?? true,
      httpUser: input.httpUser ?? null,
      httpPass: input.httpPass ?? null,
      signatureKey,
      enabled: input.enabled ?? true,
      logs: '',
      attempts: 0,
    })

    const created = await session.createDocument('webhooks', doc)
    return toView(created)
  }

  /**
   * Get a single webhook for a project.
   */
  async get(projectId: string, webhookId: string): Promise<WebhookView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const webhook = await session.getDocument('webhooks', webhookId)
    if (
      webhook.empty() ||
      webhook.get('projectInternalId') !== project.getSequence() ||
      webhook.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Webhook not found', {
        code: 'webhook_not_found',
      })
    }

    return toView(webhook)
  }

  /**
   * Update a webhook.
   */
  async update(
    projectId: string,
    webhookId: string,
    input: UpdateWebhookInput,
  ): Promise<WebhookView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const webhook = await session.getDocument('webhooks', webhookId)
    if (
      webhook.empty() ||
      webhook.get('projectInternalId') !== project.getSequence() ||
      webhook.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Webhook not found', {
        code: 'webhook_not_found',
      })
    }

    if (input.name !== undefined) webhook.set('name', input.name)
    if (input.url !== undefined) webhook.set('url', input.url)
    if (input.events !== undefined) webhook.set('events', input.events)
    if (input.security !== undefined) webhook.set('security', input.security)
    if (input.httpUser !== undefined) webhook.set('httpUser', input.httpUser)
    if (input.httpPass !== undefined) webhook.set('httpPass', input.httpPass)
    if (input.enabled !== undefined) {
      webhook.set('enabled', input.enabled)
      if (input.enabled) {
        webhook.set('attempts', 0)
      }
    }

    const updated = await session.updateDocument('webhooks', webhookId, webhook)
    return toView(updated)
  }

  /**
   * Update signature key of a webhook.
   */
  async updateSignature(projectId: string, webhookId: string): Promise<WebhookView> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const webhook = await session.getDocument('webhooks', webhookId)
    if (
      webhook.empty() ||
      webhook.get('projectInternalId') !== project.getSequence() ||
      webhook.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Webhook not found', {
        code: 'webhook_not_found',
      })
    }

    webhook.set('signatureKey', randomBytes(64).toString('hex'))
    const updated = await session.updateDocument('webhooks', webhookId, webhook)
    return toView(updated)
  }

  /**
   * Delete a webhook.
   */
  async delete(projectId: string, webhookId: string): Promise<void> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    const webhook = await session.getDocument('webhooks', webhookId)
    if (
      webhook.empty() ||
      webhook.get('projectInternalId') !== project.getSequence() ||
      webhook.get('projectId') !== projectId
    ) {
      throw new NotFoundError('Webhook not found', {
        code: 'webhook_not_found',
      })
    }

    await session.deleteDocument('webhooks', webhookId)
  }
}
