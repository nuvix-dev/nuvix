import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Authorization, Database, Doc, Query } from '@nuvix/db'
import { Exception } from '../../extend/exception'
import { Auth } from '../../helper/auth.helper'
import ParamsHelper from '../../helper/params.helper'
import { AppMode, AUTH_SCHEMA_DB, Context } from '@nuvix/utils'
import { Hook } from '../../server/hooks/interface'
import { Key } from '../../helper/key.helper'
import { ProjectsDoc, SessionsDoc, UsersDoc } from '@nuvix/utils/types'
import { CoreService } from '../../core.service.js'
import { AuthType } from '../../decorators'

@Injectable()
export class AuthHook implements Hook {
  private readonly logger = new Logger(AuthHook.name)
  private readonly dbForPlatform: Database
  constructor(
    readonly coreService: CoreService,
    private readonly jwtService: JwtService,
  ) {
    this.dbForPlatform = coreService.getPlatformDb()
  }

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    const params = new ParamsHelper(req)
    const project = req[Context.Project] as ProjectsDoc
    const dbForProject = req[AUTH_SCHEMA_DB] as Database
    const mode = req[Context.Mode] as AppMode

    Authorization.setDefaultStatus(true)

    Auth.setCookieName(
      `session${project.getId() === 'console' ? '' : `_${project.getId()}`}`,
    )

    if (mode === AppMode.ADMIN) {
      Auth.setCookieName(`session`)
    }

    let session: { id: string | null; secret: string } = {
      id: null,
      secret: '',
    }
    const cookie = req.cookies[Auth.cookieName] || null
    if (cookie) session = Auth.decodeSession(cookie)

    if (!session.id && !session.secret) {
      const sessionHeader = params.getFromHeaders('x-nuvix-session')
      if (sessionHeader) {
        try {
          session = Auth.decodeSession(sessionHeader)
        } catch (error: any) {
          this.logger.debug(
            'Failed to decode session from header',
            error.message,
          )
        }
      }
    }

    if (!session.id && !session.secret) {
      reply.header('X-Debug-Fallback', 'true')
      try {
        const fallbackHeader = params.getFromHeaders('x-fallback-cookies', '')
        if (fallbackHeader) {
          const fallback = JSON.parse(fallbackHeader)
          session = Auth.decodeSession(fallback[Auth.cookieName] || '')
        }
      } catch (error: any) {
        this.logger.debug('Failed to parse fallback cookies', error.message)
      }
    } else {
      reply.header('X-Debug-Fallback', 'false')
    }

    Auth.unique = session.id || ''
    Auth.secret = session.secret || ''

    this.logger.debug(`Auth: ${Auth.unique}`)

    let user: UsersDoc
    if (mode !== AppMode.ADMIN) {
      if (project.empty()) {
        user = new Doc()
      } else {
        if (project.getId() === 'console') {
          user = await this.dbForPlatform.getDocument('users', Auth.unique)
        } else {
          user = await dbForProject.getDocument('users', Auth.unique)
        }
      }
    } else {
      user = await this.dbForPlatform.getDocument('users', Auth.unique)
    }

    const sessionId = Auth.sessionVerify(user.get('sessions', []), Auth.secret)

    if (user.empty() || !sessionId) {
      user = new Doc()
    } else {
      req[Context.AuthType] = AuthType.SESSION
    }

    const authJWT = params.getFromHeaders('x-nuvix-jwt')

    if (authJWT && !project.empty() && project.getId() !== 'console') {
      let payload: any
      try {
        payload = await this.jwtService.verifyAsync(authJWT)
      } catch (e: any) {
        throw new Exception(
          Exception.USER_JWT_INVALID,
          `Failed to verify JWT. ${e.message}`,
        )
      }

      const jwtUserId = payload?.userId || null
      if (jwtUserId) {
        user = await dbForProject.findOne('users', jwtUserId)
      }

      const jwtSessionId = payload?.sessionId || null
      if (
        jwtSessionId &&
        !user.findWhere(
          'sessions',
          (s: SessionsDoc) => s.getId() === jwtSessionId,
        )
      ) {
        user = new Doc()
      } else {
        req[Context.AuthType] = AuthType.JWT
      }
    }

    const currentSession =
      user
        .get('sessions', [])
        .find((s: SessionsDoc) => s.getId() === sessionId) ?? new Doc()

    if (!project.empty()) {
      const apiKey =
        params.getFromHeaders('x-nuvix-key') || params.getFromQuery('apiKey')
      req[Context.ApiKey] = apiKey ? await Key.decode(project, apiKey) : null

      let teamInternalId!: number
      if (project.getId() !== 'console') {
        teamInternalId = project.get('teamInternalId')
      } else if (
        (req.url.startsWith('/projects/') ||
          req.url.startsWith('/v1/projects/')) &&
        (req.params as any)['projectId']
      ) {
        const p = await Authorization.skip(() =>
          this.dbForPlatform.getDocument(
            'projects',
            (req.params as any)['projectId'],
          ),
        )
        teamInternalId = p.get('teamInternalId')
      } else if (
        (req.url.startsWith('/projects') ||
          req.url.startsWith('/v1/projects')) &&
        params.getFromQuery('teamId')
      ) {
        const teamId = params.getFromQuery('teamId') as string
        const team = await Authorization.skip(() =>
          this.dbForPlatform.getDocument('teams', teamId),
        )
        req[Context.Team] = team
      } else {
        req[Context.Team] = new Doc()
      }

      if (teamInternalId) {
        const team = await Authorization.skip(() =>
          this.dbForPlatform.findOne('teams', [
            Query.equal('$sequence', [teamInternalId]),
          ]),
        )
        req[Context.Team] = team
      }
    }

    req[Context.User] = user
    req[Context.Session] = currentSession
    return
  }
}
