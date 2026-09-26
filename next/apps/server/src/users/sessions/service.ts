import { Auth } from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { NotFoundError } from '../../shared/errors'
import type { Sessions, SessionsDoc, UsersDoc } from '../../types/generated'
import { formatSession, type SessionView } from '../formatter'

export class UserSessionsService {
  constructor(private readonly session: Session) {}

  async findAll(
    userId: string,
    queries: Query[] = [],
  ): Promise<{ total: number; sessions: SessionView[] }> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const q = [Query.equal('userInternalId', [userDoc.getSequence()]), ...queries]
    const docs = (await this.session.find('sessions', q)) as SessionsDoc[]
    const total = await this.session.count('sessions', Query.groupByType(q).filters)

    return {
      total,
      sessions: docs.map((doc) => formatSession(doc)),
    }
  }

  async create(
    userId: string,
    options: {
      provider?: string
      expireInSeconds?: number
      ip?: string
      userAgent?: string
    } = {},
  ): Promise<SessionView> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const sessionId = ID.unique()
    const secret = Auth.hash(Auth.tokenGenerator())
    const expire = new Date(Date.now() + (options.expireInSeconds ?? 365 * 24 * 60 * 60) * 1000)

    const sessionDoc = (await this.session.createDocument(
      'sessions',
      new Doc<Sessions>({
        $id: sessionId,
        $permissions: [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
        userId,
        userInternalId: userDoc.getSequence(),
        provider: options.provider ?? 'email',
        secret,
        expire,
        ip: options.ip ?? '',
        factors: ['password'],
      }),
    )) as SessionsDoc

    return formatSession(sessionDoc, sessionId)
  }

  async delete(userId: string, sessionId: string): Promise<{ status: 'success' }> {
    const sessionDoc = (await this.session.getDocument('sessions', sessionId)) as SessionsDoc
    if (sessionDoc.empty() || sessionDoc.get('userId') !== userId) {
      throw new NotFoundError('Session not found', {
        code: 'user_session_not_found',
      })
    }

    await this.session.deleteDocument('sessions', sessionId)
    return { status: 'success' }
  }

  async deleteAll(userId: string): Promise<{ status: 'success' }> {
    const userDoc = (await this.session.getDocument('users', userId)) as UsersDoc
    if (userDoc.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const sessions = (await this.session.find('sessions', [
      Query.equal('userInternalId', [userDoc.getSequence()]),
    ])) as SessionsDoc[]

    for (const s of sessions) {
      await this.session.deleteDocument('sessions', s.getId())
    }

    return { status: 'success' }
  }
}
