import { Injectable, Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Authorization, Database, Document } from '@nuvix/database';
import { Exception } from '@nuvix/core/extend/exception';
import { Auth } from '@nuvix/core/helper/auth.helper';
import ParamsHelper from '@nuvix/core/helper/params.helper';
import {
  APP_MODE_ADMIN,
  APP_MODE_DEFAULT,
  CORE_SCHEMA_DB,
  DB_FOR_PLATFORM,
  PROJECT,
  SESSION,
  USER,
} from '@nuvix/utils/constants';
import { Hook } from '../../server/hooks/interface';

@Injectable()
export class AuthHook implements Hook {
  private readonly logger = new Logger(AuthHook.name);
  private projectDb: Database;
  constructor(
    @Inject(DB_FOR_PLATFORM) readonly db: Database,
    private readonly jwtService: JwtService,
  ) {}

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    const params = new ParamsHelper(req);
    const project: Document = req[PROJECT];
    this.projectDb = req[CORE_SCHEMA_DB];
    const mode =
      params.getFromHeaders('x-nuvix-mode') ||
      params.getFromQuery('mode', APP_MODE_DEFAULT);

    Authorization.setDefaultStatus(true);

    Auth.setCookieName(
      `session${project.getId() === 'console' ? '' : `_${project.getId()}`}`,
    );

    if (mode === APP_MODE_ADMIN) {
      Auth.setCookieName(`session`);
    }

    let session: any = {};
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
    if (mode !== APP_MODE_ADMIN) {
      if (project.isEmpty()) {
        user = new Document();
      } else {
        if (project.getId() === 'console') {
          user = await this.db.getDocument('users', Auth.unique);
        } else {
          user = await this.projectDb.getDocument('users', Auth.unique);
        }
      }
    } else {
      user = await this.db.getDocument('users', Auth.unique);
    }

    const sessionId = Auth.sessionVerify(
      user.getAttribute('sessions', []),
      Auth.secret,
    );

    if (user.isEmpty() || !sessionId) {
      user = new Document();
    }

    if (APP_MODE_ADMIN === mode) {
      if (
        user.find(
          'teamInternalId',
          project.getAttribute('teamInternalId'),
          'memberships',
        )
      ) {
        Authorization.setDefaultStatus(false);
      } else {
        user = new Document();
      }
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
        user = await this.projectDb.findOne('users', jwtUserId);
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

    req[USER] = user;
    req[SESSION] = currentSession;
    return;
  }
}
