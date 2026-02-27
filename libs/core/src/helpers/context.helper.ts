import { AppMode, configuration, Schema } from '@nuvix/utils'
import type {
  ProjectsDoc,
  SessionsDoc,
  TeamsDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import type { Key } from './key.helper'
import { Doc } from '@nuvix/db'
import type { AuthType } from '../decorators'
import { localeTranslatorInstance } from './locale.helper'
import { Detector } from './detector.helper'

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
  currentSchema?: Schema
  authMeta: AuthMeta = {}
  sessionMeta: Record<string, unknown> = {}

  cookieDomain = configuration.server.cookieDomain
  cookieSameSite = configuration.server.cookieSameSite

  _isAPIUser: boolean = false // This is set to true if the user is authenticated via API key
  _isAdminUser: boolean = false // This is set to true if the user has admin privileges (mostly for console users)

  get isAPIUser() {
    return this._isAPIUser
  }

  get isAdminUser() {
    return this._isAdminUser
  }

  translator() {
    return localeTranslatorInstance
  }

  detector(userAgent: string = 'UNKNOWN') {
    return new Detector(userAgent)
  }

  constructor(init?: Partial<RequestContext>) {
    Object.assign(this, init)
  }
}

type AuthMeta = {
  id?: string
  secret?: string
}
