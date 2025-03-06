import { Injectable, NestMiddleware, Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Authorization, Database, Document } from '@nuvix/database';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { Exception } from 'src/core/extend/exception';
import { Auth } from 'src/core/helper/auth.helper';
import ParamsHelper from 'src/core/helper/params.helper';
import {
  APP_MODE_ADMIN,
  APP_MODE_DEFAULT,
  DB_FOR_CONSOLE,
  DB_FOR_PROJECT,
  PROJECT,
  USER,
} from 'src/Utils/constants';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);
  constructor(
    private readonly store: ClsService,
    @Inject(DB_FOR_CONSOLE) readonly db: Database,
    @Inject(DB_FOR_PROJECT) readonly projectDb: Database,
    private readonly jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const params = new ParamsHelper(req);
    const project: Document = req[PROJECT];
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
    try {
      const cookie =
        req.cookies[Auth.cookieName] ||
        req.cookies[`${Auth.cookieName}_legacy`] ||
        '';
      session = Auth.decodeSession(cookie);
    } catch (error) {
      this.logger.debug('Failed to decode session', error.message);
      session = {};
    }

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
      res.setHeader('X-Debug-Fallback', 'true');
      try {
        const fallbackHeader = params.getFromHeaders('x-nuvix-fallback', '');
        if (fallbackHeader) {
          const fallback = JSON.parse(fallbackHeader);
          session = Auth.decodeSession(fallback[Auth.cookieName] || '');
        }
      } catch (error) {
        this.logger.debug('Failed to parse fallback cookies', error.message);
      }
    } else {
      res.setHeader('X-Debug-Fallback', 'false');
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

    if (
      user.isEmpty() ||
      !Auth.sessionVerify(user.getAttribute('sessions', []), Auth.secret)
    ) {
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

    req[USER] = user;

    next();
  }
}
