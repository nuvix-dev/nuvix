import {
  Body,
  Controller,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { TopicsService } from './topics.service'
import { ProjectGuard } from '@nuvix/core/resolvers/guards'
import {
  ApiInterceptor,
  ResponseInterceptor,
} from '@nuvix/core/resolvers/interceptors'
import {
  ProjectDatabase,
  AuthType,
  Namespace,
  Auth,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helper'

import { Database, Query as Queries } from '@nuvix/db'
import {
  CreateTopicDTO,
  TopicParamsDTO,
  UpdateTopicDTO,
} from './DTO/topics.dto'
import { TopicsQueryPipe } from '@nuvix/core/pipes/queries'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import { IListResponse, IResponse } from '@nuvix/utils'
import { TopicsDoc } from '@nuvix/utils/types'

@Namespace('messaging')
@UseGuards(ProjectGuard)
@Auth([AuthType.ADMIN, AuthType.KEY])
@Controller({ path: 'messaging/topics', version: ['1'] })
@UseInterceptors(ApiInterceptor, ResponseInterceptor)
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Post('', {
    summary: 'Create topic',
    scopes: 'topics.create',
    model: Models.TOPIC,
    audit: {
      key: 'topic.create',
      resource: 'topic/{res.$id}',
    },
    sdk: {
      name: 'createTopic',
      descMd: '/docs/references/messaging/create-topic.md',
    },
  })
  async createTopic(
    @ProjectDatabase() db: Database,
    @Body() input: CreateTopicDTO,
  ): Promise<IResponse<TopicsDoc>> {
    return this.topicsService.createTopic({
      db,
      input,
    })
  }

  @Get('', {
    summary: 'List topics',
    scopes: 'topics.read',
    model: { type: Models.TOPIC, list: true },
    sdk: {
      name: 'listTopics',
      descMd: '/docs/references/messaging/list-topics.md',
    },
  })
  async listTopics(
    @ProjectDatabase() db: Database,
    @QueryFilter(TopicsQueryPipe) queries: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<TopicsDoc>> {
    return this.topicsService.listTopics({
      db,
      queries,
      search,
    })
  }

  @Get(':topicId', {
    summary: 'Get topic',
    scopes: 'topics.read',
    model: Models.TOPIC,
    sdk: {
      name: 'getTopic',
      descMd: '/docs/references/messaging/get-topic.md',
    },
  })
  async getTopic(
    @Param() { topicId }: TopicParamsDTO,
    @ProjectDatabase() db: Database,
  ): Promise<IResponse<TopicsDoc>> {
    return this.topicsService.getTopic(db, topicId)
  }

  @Patch(':topicId', {
    summary: 'Update topic',
    scopes: 'topics.update',
    model: Models.TOPIC,
    audit: {
      key: 'topic.update',
      resource: 'topic/{res.$id}',
    },
    sdk: {
      name: 'updateTopic',
      descMd: '/docs/references/messaging/update-topic.md',
    },
  })
  async updateTopic(
    @Param() { topicId }: TopicParamsDTO,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateTopicDTO,
  ): Promise<IResponse<TopicsDoc>> {
    return this.topicsService.updateTopic({
      db,
      topicId,
      input,
    })
  }

  @Delete(':topicId', {
    summary: 'Delete topic',
    scopes: 'topics.delete',
    audit: {
      key: 'topic.delete',
      resource: 'topic/{res.$id}',
    },
    sdk: {
      name: 'deleteTopic',
      descMd: '/docs/references/messaging/delete-topic.md',
    },
  })
  async deleteTopic(
    @Param() { topicId }: TopicParamsDTO,
    @ProjectDatabase() db: Database,
  ): Promise<void> {
    return this.topicsService.deleteTopic(db, topicId)
  }
}
