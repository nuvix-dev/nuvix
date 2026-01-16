import {
  Body,
  Controller,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { MessagingService } from './messaging.service'
import { ProjectGuard } from '@nuvix/core/resolvers'
import { ApiInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import {
  ProjectDatabase,
  AuthType,
  Namespace,
  Project,
  Auth,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'

import { Database, Query as Queries } from '@nuvix/db'
import {
  CreateEmailMessageDTO,
  CreatePushMessageDTO,
  CreateSmsMessageDTO,
  MessageParamsDTO,
  UpdateEmailMessageDTO,
  UpdatePushMessageDTO,
  UpdateSmsMessageDTO,
} from './DTO/message.dto'
import type { MessagesDoc, ProjectsDoc, TargetsDoc } from '@nuvix/utils/types'
import { MessagesQueryPipe, TargetsQueryPipe } from '@nuvix/core/pipes/queries'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import { IListResponse, IResponse } from '@nuvix/utils'

@Namespace('messaging')
@UseGuards(ProjectGuard)
@Auth([AuthType.ADMIN, AuthType.KEY])
@Controller({ path: 'messaging/messages', version: ['1'] })
@UseInterceptors(ApiInterceptor, ResponseInterceptor)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('email', {
    summary: 'Create email',
    scopes: 'messages.create',
    model: Models.MESSAGE,
    audit: {
      key: 'message.create',
      resource: 'message/{res.$id}',
    },
    sdk: {
      name: 'createEmail',
      descMd: '/docs/references/messaging/create-email.md',
    },
  })
  async createEmail(
    @ProjectDatabase() db: Database,
    @Body() input: CreateEmailMessageDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.createEmailMessage({
      db,
      input,
      project,
    })
  }

  @Post('sms', {
    summary: 'Create SMS',
    scopes: 'messages.create',
    model: Models.MESSAGE,
    audit: {
      key: 'message.create',
      resource: 'message/{res.$id}',
    },
    sdk: {
      name: 'createSms',
      descMd: '/docs/references/messaging/create-sms.md',
    },
  })
  async createSms(
    @ProjectDatabase() db: Database,
    @Body() input: CreateSmsMessageDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.createSmsMessage({
      db,
      input,
      project,
    })
  }

  @Post('push', {
    summary: 'Create push notification',
    scopes: 'messages.create',
    model: Models.MESSAGE,
    audit: {
      key: 'message.create',
      resource: 'message/{res.$id}',
    },
    sdk: {
      name: 'createPush',
      descMd: '/docs/references/messaging/create-push.md',
    },
  })
  async createPush(
    @ProjectDatabase() db: Database,
    @Body() input: CreatePushMessageDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.createPushMessage({
      db,
      input,
      project,
    })
  }

  @Get('', {
    summary: 'List messages',
    scopes: 'messages.read',
    model: { type: Models.MESSAGE, list: true },
    sdk: {
      name: 'listMessages',
      descMd: '/docs/references/messaging/list-messages.md',
    },
  })
  async listMessages(
    @ProjectDatabase() db: Database,
    @QueryFilter(MessagesQueryPipe) queries: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<MessagesDoc>> {
    return this.messagingService.listMessages({
      db,
      queries,
      search,
    })
  }

  @Get(':messageId', {
    summary: 'Get message',
    scopes: 'messages.read',
    model: Models.MESSAGE,
    sdk: {
      name: 'getMessage',
      descMd: '/docs/references/messaging/get-message.md',
    },
  })
  async getMessage(
    @Param() { messageId }: MessageParamsDTO,
    @ProjectDatabase() db: Database,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.getMessage(db, messageId)
  }

  @Get(':messageId/targets', {
    summary: 'List message targets',
    scopes: ['messages.read', 'targets.read'],
    model: { type: Models.TARGET, list: true },
    sdk: {
      name: 'listTargets',
      descMd: '/docs/references/messaging/list-message-targets.md',
    },
  })
  async listTargets(
    @Param() { messageId }: MessageParamsDTO,
    @ProjectDatabase() db: Database,
    @QueryFilter(TargetsQueryPipe) queries: Queries[],
  ): Promise<IListResponse<TargetsDoc>> {
    return this.messagingService.listTargets({
      db,
      messageId,
      queries,
    })
  }

  @Patch('email/:messageId', {
    summary: 'Update email',
    scopes: 'messages.update',
    model: Models.MESSAGE,
    audit: {
      key: 'message.update',
      resource: 'message/{res.$id}',
    },
    sdk: {
      name: 'updateEmail',
      descMd: '/docs/references/messaging/update-email.md',
    },
  })
  async updateEmail(
    @Param() { messageId }: MessageParamsDTO,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateEmailMessageDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.updateEmailMessage({
      db,
      messageId,
      input,
      project,
    })
  }

  @Patch('sms/:messageId', {
    summary: 'Update SMS',
    scopes: 'messages.update',
    model: Models.MESSAGE,
    audit: {
      key: 'message.update',
      resource: 'message/{res.$id}',
    },
    sdk: {
      name: 'updateSms',
      descMd: '/docs/references/messaging/update-sms.md',
    },
  })
  async updateSms(
    @Param() { messageId }: MessageParamsDTO,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateSmsMessageDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.updateSmsMessage({
      db,
      messageId,
      input,
      project,
    })
  }

  @Patch('push/:messageId', {
    summary: 'Update push notification',
    scopes: 'messages.update',
    model: Models.MESSAGE,
    audit: {
      key: 'message.update',
      resource: 'message/{res.$id}',
    },
    sdk: {
      name: 'updatePush',
      descMd: '/docs/references/messaging/update-push.md',
    },
  })
  async updatePush(
    @Param() { messageId }: MessageParamsDTO,
    @ProjectDatabase() db: Database,
    @Body() input: UpdatePushMessageDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.updatePushMessage({
      db,
      messageId,
      input,
      project,
    })
  }

  @Delete(':messageId', {
    summary: 'Delete message',
    scopes: 'messages.delete',
    audit: {
      key: 'message.delete',
      resource: 'message/{res.$id}',
    },
    sdk: {
      name: 'delete',
      descMd: '/docs/references/messaging/delete-message.md',
    },
  })
  async deleteMessage(
    @Param() { messageId }: MessageParamsDTO,
    @ProjectDatabase() db: Database,
  ): Promise<void> {
    return this.messagingService.deleteMessage(db, messageId)
  }
}
