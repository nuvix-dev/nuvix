import { Body, Controller, Param, UseInterceptors } from '@nestjs/common'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import {
  Auth,
  AuthType,
  Namespace,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { MessagesQueryPipe, TargetsQueryPipe } from '@nuvix/core/pipes/queries'
import { ApiInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import { Query as Queries } from '@nuvix/db'
import { IListResponse, IResponse } from '@nuvix/utils'
import type { MessagesDoc, TargetsDoc } from '@nuvix/utils/types'
import {
  CreateEmailMessageDTO,
  CreatePushMessageDTO,
  CreateSmsMessageDTO,
  MessageParamsDTO,
  UpdateEmailMessageDTO,
  UpdatePushMessageDTO,
  UpdateSmsMessageDTO,
} from './DTO/message.dto'
import { MessagingService } from './messaging.service'

@Namespace('messaging')

@Auth([AuthType.ADMIN, AuthType.KEY])
@Controller({ path: 'messaging/messages', version: ['1'] })
@UseInterceptors(ApiInterceptor, ResponseInterceptor)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('email', {
    summary: 'Create email',
    scopes: 'messages.write',
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
    @Body() input: CreateEmailMessageDTO,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.createEmailMessage({
      input,
    })
  }

  @Post('sms', {
    summary: 'Create SMS',
    scopes: 'messages.write',
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
    @Body() input: CreateSmsMessageDTO,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.createSmsMessage({
      input,
    })
  }

  @Post('push', {
    summary: 'Create push notification',
    scopes: 'messages.write',
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
    @Body() input: CreatePushMessageDTO,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.createPushMessage({
      input,
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
    @QueryFilter(MessagesQueryPipe) queries: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<MessagesDoc>> {
    return this.messagingService.listMessages({
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
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.getMessage(messageId)
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
    @QueryFilter(TargetsQueryPipe) queries: Queries[],
  ): Promise<IListResponse<TargetsDoc>> {
    return this.messagingService.listTargets({
      messageId,
      queries,
    })
  }

  @Patch('email/:messageId', {
    summary: 'Update email',
    scopes: 'messages.write',
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
    @Body() input: UpdateEmailMessageDTO,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.updateEmailMessage({
      messageId,
      input,
    })
  }

  @Patch('sms/:messageId', {
    summary: 'Update SMS',
    scopes: 'messages.write',
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
    @Body() input: UpdateSmsMessageDTO,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.updateSmsMessage({
      messageId,
      input,
    })
  }

  @Patch('push/:messageId', {
    summary: 'Update push notification',
    scopes: 'messages.write',
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
    @Body() input: UpdatePushMessageDTO,
  ): Promise<IResponse<MessagesDoc>> {
    return this.messagingService.updatePushMessage({
      messageId,
      input,
    })
  }

  @Delete(':messageId', {
    summary: 'Delete message',
    scopes: 'messages.write',
    audit: {
      key: 'message.delete',
      resource: 'message/{res.$id}',
    },
    sdk: {
      name: 'delete',
      descMd: '/docs/references/messaging/delete-message.md',
    },
  })
  async deleteMessage(@Param() { messageId }: MessageParamsDTO): Promise<void> {
    return this.messagingService.deleteMessage(messageId)
  }
}
