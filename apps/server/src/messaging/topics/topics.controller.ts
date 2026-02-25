import {
  Body,
  Controller,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import {
  Auth,
  AuthType,
  Namespace,
  Project,
  ProjectDatabase,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { TopicsQueryPipe } from '@nuvix/core/pipes/queries'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import { Database, Query as Queries } from '@nuvix/db'
import type { IListResponse, IResponse } from '@nuvix/utils'
import type { ProjectsDoc, TopicsDoc } from '@nuvix/utils/types'
import {
  CreateTopicDTO,
  TopicParamsDTO,
  UpdateTopicDTO,
} from './DTO/topics.dto'
import { TopicsService } from './topics.service'

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


  ): Promise<void> {
    return this.topicsService.deleteTopic(db, topicId, project)
  }
}
