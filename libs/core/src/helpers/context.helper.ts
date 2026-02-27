import { AppMode } from '@nuvix/utils'
import type {
  ProjectsDoc,
  SessionsDoc,
  TeamsDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import type { Key } from './key.helper'
import { Doc } from '@nuvix/db'
import type { AuthType } from '../decorators'

export class RequestContext {
  project: ProjectsDoc = new Doc()
  user: UsersDoc = new Doc()
  team?: TeamsDoc
  session?: SessionsDoc
  locale: string = 'en'
  apiKey?: Key
  scopes?: string[]
  role?: string
  mode: AppMode = AppMode.DEFAULT
  authType?: AuthType
  namespace?: string
  currentSchema?: string
  authMeta: AuthMeta = {}
  sessionMeta: Record<string, unknown> = {}

  _isAPIUser: boolean = false // This is set to true if the user is authenticated via API key
  _isAdminUser: boolean = false // This is set to true if the user has admin privileges (mostly for console users)

  get isAPIUser() {
    return this._isAPIUser
  }

  get isAdminUser() {
    return this._isAdminUser
  }

  constructor(init?: Partial<RequestContext>) {
    Object.assign(this, init)
  }
}

type AuthMeta = {
  id?: string
  secret?: string
}
