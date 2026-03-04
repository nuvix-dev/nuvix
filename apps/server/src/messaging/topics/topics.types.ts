import { Query } from '@nuvix/db'
import { CreateTopicDTO, UpdateTopicDTO } from './DTO/topics.dto'

interface QandS {
  queries?: Query[]
  search?: string
}

export interface CreateTopic {
  input: CreateTopicDTO
}

export interface UpdateTopic {
  topicId: string
  input: UpdateTopicDTO
}

export interface ListTopics extends QandS {}
export interface GetTopic {
  topicId: string
}
