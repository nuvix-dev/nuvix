import { Injectable, Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Authorization, Database, Document, Query } from '@nuvix/database';
import { Exception } from '@nuvix/core/extend/exception';
import { Auth } from '@nuvix/core/helper/auth.helper';
import ParamsHelper from '@nuvix/core/helper/params.helper';
import {
  ApiKey,
  AppMode,
  CORE_SCHEMA_DB,
  DB_FOR_PLATFORM,
  PROJECT,
  SESSION,
  TEAM,
  USER,
} from '@nuvix/utils/constants';
import { Hook } from '../../server/hooks/interface';
import { Key } from '@nuvix/core/helper/key.helper';

@Injectable()
export class AuthHook implements Hook {
  private readonly logger = new Logger(AuthHook.name);

  constructor(
    @Inject(DB_FOR_PLATFORM) readonly dbForPlatform: Database,
    private readonly jwtService: JwtService,
  ) { }

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    const params = new ParamsHelper(req);
    const project: Document = req[PROJECT];
    const dbForProject = req[CORE_SCHEMA_DB];
    const mode = req[AppMode._REQUEST];

    Authorization.setDefaultStatus(true);

    Auth.setCookieName(
      `session${project.getId() === 'console' ? '' : `_${project.getId()}`}`,
    );

    if (mode === AppMode.ADMIN) {
      Auth.setCookieName(`session`);
    }

    let session: { id: string | null; secret: string } = {
      id: null,
      secret: '',
    };
    const cookie = req.cookies[Auth.cookieName] || null;
    if (cookie) session = Auth.decodeSession(cookie);

    if (!session.id && !session.secret) {
      const sessionHeader = params.getFromHeaders('x-nuvix-session');
      if (sessionHeader) {
        try {
          session = Auth.decodeSession(sessionHeader);
        } catch (error) {
          this.logger.debug(
            'Failed to decode session from header',
            error.message,
          );
        }
      }
    }

    if (!session.id && !session.secret) {
      reply.header('X-Debug-Fallback', 'true');
      try {
        const fallbackHeader = params.getFromHeaders('x-fallback-cookies', '');
        if (fallbackHeader) {
          const fallback = JSON.parse(fallbackHeader);
          session = Auth.decodeSession(fallback[Auth.cookieName] || '');
        }
      } catch (error) {
        this.logger.debug('Failed to parse fallback cookies', error.message);
      }
    } else {
      reply.header('X-Debug-Fallback', 'false');
    }

    Auth.unique = session.id || '';
    Auth.secret = session.secret || '';

    this.logger.debug(`Auth: ${Auth.unique}`);

    let user: Document;
    if (mode !== AppMode.ADMIN) {
      if (project.isEmpty()) {
        user = new Document();
      } else {
        if (project.getId() === 'console') {
          user = await this.dbForPlatform.getDocument('users', Auth.unique);
        } else {
          user = await dbForProject.getDocument('users', Auth.unique);
        }
      }
    } else {
      user = await this.dbForPlatform.getDocument('users', Auth.unique);
    }

    const sessionId = Auth.sessionVerify(
      user.getAttribute('sessions', []),
      Auth.secret,
    );

    if (user.isEmpty() || !sessionId) {
      user = new Document();
    }

    const authJWT = params.getFromHeaders('x-nuvix-jwt');

    if (authJWT && !project.isEmpty() && project.getId() !== 'console') {
      let payload: any;
      try {
        payload = await this.jwtService.verifyAsync(authJWT);
      } catch (e) {
        throw new Exception(
          Exception.USER_JWT_INVALID,
          `Failed to verify JWT. ${e.message}`,
        );
      }

      const jwtUserId = payload?.userId || null;
      if (jwtUserId) {
        user = await dbForProject.findOne('users', jwtUserId);
      }

      const jwtSessionId = payload?.sessionId || null;
      if (jwtSessionId && !user.find('$id', jwtSessionId, 'sessions')) {
        user = new Document();
      }
    }

    const currentSession =
      user
        .getAttribute('sessions', [])
        .find((s: Document) => s.getId() === sessionId) ?? new Document();

    if (!project.isEmpty()) {
      const apiKey = params.getFromHeaders('x-nuvix-key') || params.getFromQuery('apiKey');
      req[ApiKey._REQUEST] = apiKey ? await Key.decode(project, apiKey) : null;

      let teamInternalId: string;
      if (project.getId() !== 'console') {
        teamInternalId = project.getAttribute('teamInternalId');
      } // TODO: we have to use another approch, or we should pass teamId in headers
      else if (req.url.startsWith('/v1/projects/') && req.params['projectId']) {
        const p = await Authorization.skip(async () => await this.dbForPlatform.getDocument('projects', req.params['projectId']));
        teamInternalId = p.getAttribute('teamInternalId');
      } else if (req.url.startsWith('/v1/projects') && params.getFromQuery('teamId')) {
        const teamId = params.getFromQuery('teamId');
        const team = await Authorization.skip(async () => await this.dbForPlatform.getDocument('teams', teamId));
        req[TEAM] = team;
      } else {
        req[TEAM] = new Document();
      }

      if (teamInternalId) {
        const team = await Authorization.skip(async () =>
          await this.dbForPlatform.findOne('teams', [Query.equal('$internalId', [teamInternalId])])
        );
        req[TEAM] = team;
      }
    }

    req[USER] = user;
    req[SESSION] = currentSession;
    return;
  }
}
