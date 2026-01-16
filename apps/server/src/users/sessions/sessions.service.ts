import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { ID } from '@nuvix/core/helpers'
import { SessionProvider } from '@nuvix/utils'
import { Auth } from '@nuvix/core/helpers'
import { Detector } from '@nuvix/core/helpers'

import { Database, Doc, Permission, Role } from '@nuvix/db'
import { CountryResponse, Reader } from 'maxmind'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { CoreService } from '@nuvix/core'
import type { ProjectsDoc, Sessions, SessionsDoc } from '@nuvix/utils/types'
import type { LocaleTranslator } from '@nuvix/core/helpers'

@Injectable()
export class SessionsService {
  private readonly geoDb: Reader<CountryResponse>

  constructor(
    private readonly coreService: CoreService,
    private readonly event: EventEmitter2,
  ) {
    this.geoDb = this.coreService.getGeoDb()
  }

  /**
   * Get all sessions
   */
  async getSessions(db: Database, userId: string, locale: LocaleTranslator) {
    const user = await db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const sessions = user.get('sessions', []) as SessionsDoc[]

    for (const session of sessions) {
      const countryName = locale.getText(
        `countries.${session.get('countryCode')}`,
        locale.getText('locale.country.unknown'),
      )

      session.set('countryName', countryName)
      session.set('current', false)
    }

    return {
      data: sessions,
      total: sessions.length,
    }
  }

  /**
   * Create User Session
   */
  async createSession(
    db: Database,
    userId: string,
    userAgent: string,
    ip: string,
    project: ProjectsDoc,
    locale: LocaleTranslator,
  ) {
    const user = await db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)
    const detector = new Detector(userAgent)
    const record = this.geoDb.get(ip)

    const duration =
      project.get('auths', {})['duration'] ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
    const expire = new Date(Date.now() + duration * 1000)

    const session = new Doc<Sessions>({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      userId: user.getId(),
      userInternalId: user.getSequence(),
      provider: SessionProvider.SERVER,
      secret: Auth.hash(secret),
      userAgent: userAgent,
      ip: ip,
      countryCode: record?.country?.iso_code.toLowerCase(),
      expire: expire,
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    })

    const countryName = locale.getText(
      `countries.${session.get('countryCode')}`,
      locale.getText('locale.country.unknown'),
    )

    const createdSession = await db.createDocument('sessions', session)
    createdSession.set('secret', secret).set('countryName', countryName)

    // TODO: Implement queue for events

    return createdSession
  }

  /**
   * Delete User Session
   */
  async deleteSession(db: Database, userId: string, sessionId: string) {
    const user = await db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const session = await db.getDocument('sessions', sessionId)

    if (session.empty()) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND)
    }

    await db.deleteDocument('sessions', session.getId())
    await db.purgeCachedDocument('users', user.getId())

    // TODO: Implement queue for events
  }

  /**
   * Delete User Sessions
   */
  async deleteSessions(db: Database, userId: string) {
    const user = await db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const sessions = user.get('sessions', []) as SessionsDoc[]

    for (const session of sessions) {
      await db.deleteDocument('sessions', session.getId())
    }

    await db.purgeCachedDocument('users', user.getId())
  }
}
