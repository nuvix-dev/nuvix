import {
  Body,
  Controller,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Delete, Get, Post } from '@nuvix/core'
import {
  Auth,
  AuthType,
  Namespace,
  ProjectDatabase,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { SubscribersQueryPipe } from '@nuvix/core/pipes/queries'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import { Database, Query as Queries } from '@nuvix/db'
import { IListResponse, IResponse } from '@nuvix/utils'
import { SubscribersDoc } from '@nuvix/utils/types'
import { TopicParamsDTO } from '../DTO/topics.dto'
import { CreateSubscriberDTO, SubscriberParamsDTO } from './DTO/subscriber.dto'
import { SubscribersService } from './subscribers.service'

@Namespace('messaging')
@UseGuards(ProjectGuard)
@Auth([AuthType.ADMIN, AuthType.KEY])
@Controller({ path: 'messaging/topics/:topicId/subscribers', version: ['1'] })
@UseInterceptors(ApiInterceptor, ResponseInterceptor)
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Post('', {
    summary: 'Create subscriber',
    scopes: 'subscribers.create',
    model: Models.SUBSCRIBER,
    audit: {
      key: 'subscriber.create',
      resource: 'subscriber/{res.$id}',
    },
    sdk: {
      name: 'createSubscriber',
      descMd: '/docs/references/messaging/create-subscriber.md',
    },
  })
  async createSubscriber(
    @Param() { topicId }: TopicParamsDTO,
    @ProjectDatabase() db: Database,
    @Body() input: CreateSubscriberDTO,
  ): Promise<IResponse<SubscribersDoc>> {
    return this.subscribersService.createSubscriber({
      db,
      topicId,
      input,
    })
  }

  @Get('', {
    summary: 'List subscribers',
    scopes: 'subscribers.read',
    model: { type: Models.SUBSCRIBER, list: true },
    sdk: {
      name: 'listSubscribers',
      descMd: '/docs/references/messaging/list-subscribers.md',
    },
  })
  async listSubscribers(
    @Param() { topicId }: TopicParamsDTO,
    @ProjectDatabase() db: Database,
    @QueryFilter(SubscribersQueryPipe) queries?: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<SubscribersDoc>> {
    return this.subscribersService.listSubscribers({
      db,
      topicId,
      queries,
      search,
    })
  }

  @Get(':subscriberId', {
    summary: 'Get subscriber',
    scopes: 'subscribers.read',
    model: Models.SUBSCRIBER,
    sdk: {
      name: 'getSubscriber',
      descMd: '/docs/references/messaging/get-subscriber.md',
    },
  })
  async getSubscriber(
    @Param() { topicId, subscriberId }: SubscriberParamsDTO,
    @ProjectDatabase() db: Database,
  ): Promise<IResponse<SubscribersDoc>> {
    return this.subscribersService.getSubscriber(db, topicId, subscriberId)
  }

  @Delete(':subscriberId', {
    summary: 'Delete subscriber',
    scopes: 'subscribers.delete',
    audit: {
      key: 'subscriber.delete',
      resource: 'subscriber/{params.subscriberId}',
    },
    sdk: {
      name: 'deleteSubscriber',
      descMd: '/docs/references/messaging/delete-subscriber.md',
    },
  })
  async deleteSubscriber(
    @Param() { topicId, subscriberId }: SubscriberParamsDTO,
    @ProjectDatabase() db: Database,
  ): Promise<void> {
    return this.subscribersService.deleteSubscriber(db, topicId, subscriberId)
  }
}
