import {
  Controller,
  Body,
  Param,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import {
  CreateWebhookDTO,
  UpdateWebhookDTO,
  WebhookParamsDTO,
} from './DTO/webhook.dto'
import { ResponseInterceptor } from '@nuvix/core/resolvers'
import { Models } from '@nuvix/core/helpers'
import { ConsoleInterceptor } from '@nuvix/core/resolvers'
import { Auth, AuthType, Namespace } from '@nuvix/core/decorators'
import { WebhooksService } from './webhooks.service'
import { Delete, Get, Patch, Post, Put } from '@nuvix/core'
import { ProjectParamsDTO } from '../DTO/create-project.dto'
import { IListResponse, IResponse } from '@nuvix/utils'
import { WebhooksDoc } from '@nuvix/utils/types'

@Namespace('projects')
@Controller({
  version: ['1', VERSION_NEUTRAL],
  path: 'projects/:projectId/webhooks',
})
@Auth(AuthType.ADMIN)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class WebhooksController {
  constructor(private readonly projectService: WebhooksService) {}

  @Get('', {
    summary: 'List webhooks',
    scopes: 'projects.read',
    model: { type: Models.WEBHOOK, list: true },
    sdk: {
      name: 'listWebhooks',
      descMd: '/docs/references/projects/list-webhooks.md',
    },
  })
  async getWebhooks(
    @Param() { projectId }: ProjectParamsDTO,
  ): Promise<IListResponse<WebhooksDoc>> {
    return await this.projectService.getWebhooks(projectId)
  }

  @Post('', {
    summary: 'Create webhook',
    scopes: 'projects.update',
    model: Models.WEBHOOK,
    sdk: {
      name: 'createWebhook',
      descMd: '/docs/references/projects/create-webhook.md',
    },
  })
  async createWebhook(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: CreateWebhookDTO,
  ): Promise<IResponse<WebhooksDoc>> {
    return await this.projectService.createWebhook(projectId, input)
  }

  @Get(':webhookId', {
    summary: 'Get webhook',
    scopes: 'projects.read',
    model: Models.WEBHOOK,
    sdk: {
      name: 'getWebhook',
      descMd: '/docs/references/projects/get-webhook.md',
    },
  })
  async getWebhook(
    @Param() { projectId, webhookId }: WebhookParamsDTO,
  ): Promise<IResponse<WebhooksDoc>> {
    return this.projectService.getWebhook(projectId, webhookId)
  }

  @Put(':webhookId', {
    summary: 'Update webhook',
    scopes: 'projects.update',
    model: Models.WEBHOOK,
    sdk: {
      name: 'updateWebhook',
      descMd: '/docs/references/projects/update-webhook.md',
    },
  })
  async updateWebhook(
    @Param() { projectId, webhookId }: WebhookParamsDTO,
    @Body() input: UpdateWebhookDTO,
  ): Promise<IResponse<WebhooksDoc>> {
    return this.projectService.updateWebhook(projectId, webhookId, input)
  }

  @Patch(':webhookId/signature', {
    summary: 'Update webhook signature key',
    scopes: 'projects.update',
    model: Models.WEBHOOK,
    sdk: {
      name: 'updateWebhookSignature',
      descMd: '/docs/references/projects/update-webhook-signature.md',
    },
  })
  async updateWebhookSignature(
    @Param() { projectId, webhookId }: WebhookParamsDTO,
  ): Promise<IResponse<WebhooksDoc>> {
    return this.projectService.updateWebhookSignature(projectId, webhookId)
  }

  @Delete(':webhookId', {
    summary: 'Delete webhook',
    scopes: 'projects.update',
    sdk: {
      name: 'deleteWebhook',
      descMd: '/docs/references/projects/delete-webhook.md',
    },
  })
  async deleteWebhook(
    @Param() { projectId, webhookId }: WebhookParamsDTO,
  ): Promise<void> {
    return this.projectService.deleteWebhook(projectId, webhookId)
  }
}
