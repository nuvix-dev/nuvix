import { AppMode } from '@nuvix/utils'
import { SessionsDoc, TeamsDoc, UsersDoc } from '@nuvix/utils/types'

export class RequestContext {
  user?: UsersDoc
  team?: TeamsDoc
  session?: SessionsDoc
  locale: string = 'en'
  apiKey?: string
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
