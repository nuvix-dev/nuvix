import { AppMode } from '@nuvix/utils'
import type {
  ProjectsDoc,
  SessionsDoc,
  TeamsDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { Key } from './key.helper'
import { Doc } from '@nuvix/db'

export class RequestContext {
  project: ProjectsDoc = new Doc()
  user?: UsersDoc
  team?: TeamsDoc
  session?: SessionsDoc
  locale: string = 'en'
  apiKey?: Key
  scopes?: string[]
  role?: string
  mode: AppMode = AppMode.DEFAULT
  authType?: string
  namespace?: string
  currentSchema?: string
  authMeta: AuthMeta = {}
  sessionMeta: Record<string, unknown> = {}

  constructor(init?: Partial<RequestContext>) {
    Object.assign(this, init)
  }
}

type AuthMeta = {
  id?: string
  secret?: string
}
