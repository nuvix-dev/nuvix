import { Query } from '@nuvix/db'
import { CreateSubscriberDTO } from './DTO/subscriber.dto'

interface QandS {
  queries?: Query[]
  search?: string
}

export interface CreateSubscriber {
  input: CreateSubscriberDTO
  topicId: string
}

export interface ListSubscribers extends QandS {
  topicId: string
}
