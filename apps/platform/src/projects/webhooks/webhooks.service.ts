import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { CreateWebhookDTO, UpdateWebhookDTO } from './DTO/webhook.dto'
import { randomBytes } from 'crypto'
import { Database, Doc, ID, Permission, Query, Role } from '@nuvix/db'
import { CoreService } from '@nuvix/core'
import { Webhooks } from '@nuvix/utils/types'

@Injectable()
export class WebhooksService {
  private readonly db: Database

  constructor(private coreService: CoreService) {
    this.db = this.coreService.getPlatformDb()
  }

  /**
   * Get webhooks of a project.
   */
  async getWebhooks(id: string) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const webhooks = await this.db.find('webhooks', [
      Query.equal('projectInternalId', [project.getSequence()]),
      Query.limit(5000),
    ])

    return {
      total: webhooks.length,
      data: webhooks,
    }
  }

  /**
   * Create a webhook for a project.
   */
  async createWebhook(id: string, input: CreateWebhookDTO) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const webhook = new Doc<Webhooks>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      projectInternalId: project.getSequence(),
      projectId: project.getId(),
      name: input.name,
      events: input.events,
      url: input.url,
      security: input.security,
      httpUser: input.httpUser,
      httpPass: input.httpPass,
      signatureKey: randomBytes(64).toString('hex'),
      enabled: input.enabled,
    })

    const createdWebhook = await this.db.createDocument('webhooks', webhook)

    await this.db.purgeCachedDocument('projects', project.getId())

    return createdWebhook
  }

  /**
   * Get a Webhook.
   */
  async getWebhook(id: string, webhookId: string) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ])

    if (webhook.empty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND)
    }

    return webhook
  }

  /**
   * Update a Webhook.
   */
  async updateWebhook(id: string, webhookId: string, input: UpdateWebhookDTO) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ])

    if (webhook.empty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND)
    }

    webhook
      .update('name', input.name)
      .update('events', input.events)
      .update('url', input.url)
      .update('security', input.security)
      .update('httpUser', input.httpUser)
      .update('httpPass', input.httpPass)
      .update('enabled', input.enabled)

    if (input.enabled) {
      webhook.set('attempts', 0)
    }

    await this.db.updateDocument('webhooks', webhook.getId(), webhook)
    await this.db.purgeCachedDocument('projects', project.getId())

    return webhook
  }

  /**
   * Update Signature of a Webhook.
   */
  async updateWebhookSignature(id: string, webhookId: string) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ])

    if (webhook.empty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND)
    }

    webhook.set('signatureKey', randomBytes(64).toString('hex'))

    await this.db.updateDocument('webhooks', webhook.getId(), webhook)
    await this.db.purgeCachedDocument('projects', project.getId())

    return webhook
  }

  /**
   * Delete a Webhook.
   */
  async deleteWebhook(id: string, webhookId: string) {
    const project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ])

    if (webhook.empty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND)
    }

    await this.db.deleteDocument('webhooks', webhook.getId())
    await this.db.purgeCachedDocument('projects', project.getId())
  }
}
