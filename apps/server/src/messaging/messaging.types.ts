import { Database, Query } from '@nuvix/db'
import type { ProjectsDoc } from '@nuvix/utils/types'
import {
  CreateEmailMessageDTO,
  CreatePushMessageDTO,
  CreateSmsMessageDTO,
  UpdateEmailMessageDTO,
  UpdatePushMessageDTO,
  UpdateSmsMessageDTO,
} from './DTO/message.dto'

interface DB {
  db: Database
}

interface Project {
  project: ProjectsDoc
}

interface QandS {
  queries?: Query[]
  search?: string
}

export interface CreateEmailMessage extends DB, Project {
  input: CreateEmailMessageDTO
}
export interface CreateSmsMessage extends DB, Project {
  input: CreateSmsMessageDTO
}
export interface CreatePushMessage extends DB, Project {
  input: CreatePushMessageDTO
}

export interface ListMessages extends DB, QandS {}
export interface ListTargets extends DB {
  messageId: string
  queries?: Query[]
}

export interface UpdateEmailMessage extends DB, Project {
  input: UpdateEmailMessageDTO
  messageId: string
}
export interface UpdateSmsMessage extends DB, Project {
  input: UpdateSmsMessageDTO
  messageId: string
}
export interface UpdatePushMessage extends DB, Project {
  input: UpdatePushMessageDTO
  messageId: string
}
