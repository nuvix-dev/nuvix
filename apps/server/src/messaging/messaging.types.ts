import { Query } from '@nuvix/db'
import {
  CreateEmailMessageDTO,
  CreatePushMessageDTO,
  CreateSmsMessageDTO,
  UpdateEmailMessageDTO,
  UpdatePushMessageDTO,
  UpdateSmsMessageDTO,
} from './DTO/message.dto'

interface QandS {
  queries?: Query[]
  search?: string
}

export interface CreateEmailMessage {
  input: CreateEmailMessageDTO
}
export interface CreateSmsMessage {
  input: CreateSmsMessageDTO
}
export interface CreatePushMessage {
  input: CreatePushMessageDTO
}

export interface ListMessages extends QandS {}
export interface ListTargets {
  messageId: string
  queries?: Query[]
}

export interface UpdateEmailMessage {
  input: UpdateEmailMessageDTO
  messageId: string
}
export interface UpdateSmsMessage {
  input: UpdateSmsMessageDTO
  messageId: string
}
export interface UpdatePushMessage {
  input: UpdatePushMessageDTO
  messageId: string
}
