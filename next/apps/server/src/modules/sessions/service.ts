import type { Session } from '@nuvix/db'
import { formatSession, type SessionView } from './formatter'
import { createSession, type RequestMetadata, type SessionSettings } from './operations/create'
import {
  deleteAllUserSessions,
  deleteSession,
  getSessionOrThrow,
  listUserSessions,
} from './operations/manage'
import { type VerifiedSession, verifySessionSecret } from './operations/verify'

export class SessionsService {
  constructor(private readonly session: Session) {}

  async create(
    userId: string,
    provider: string,
    providerUid: string = '',
    factors: string[] = [provider],
    reqMeta: RequestMetadata = {},
    settings: SessionSettings = {},
  ): Promise<SessionView> {
    const { session: doc, secret } = await createSession(
      this.session,
      userId,
      provider,
      providerUid,
      factors,
      reqMeta,
      settings,
    )

    return formatSession(doc, { secret, currentSessionId: doc.getId() })
  }

  async verify(secret: string): Promise<VerifiedSession | null> {
    return verifySessionSecret(this.session, secret)
  }

  async get(sessionId: string, currentSessionId?: string): Promise<SessionView> {
    const doc = await getSessionOrThrow(this.session, sessionId)
    return formatSession(doc, { currentSessionId })
  }

  async list(userId: string, currentSessionId?: string): Promise<SessionView[]> {
    const docs = await listUserSessions(this.session, userId)
    return docs.map((doc) => formatSession(doc, { currentSessionId }))
  }

  async delete(sessionId: string): Promise<void> {
    return deleteSession(this.session, sessionId)
  }

  async deleteAll(userId: string, exceptSessionId?: string): Promise<void> {
    return deleteAllUserSessions(this.session, userId, exceptSessionId)
  }
}
