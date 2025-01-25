import { Injectable, NestMiddleware, Logger, Inject } from '@nestjs/common';
import { Authorization, Database, Document } from '@nuvix/database';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { Exception } from 'src/core/extend/exception';
import { Auth } from 'src/core/helper/auth.helper';
import { DB_FOR_CONSOLE, USER } from 'src/Utils/constants';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly store: ClsService,
    @Inject(DB_FOR_CONSOLE) readonly db: Database,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const logger = this.store.get('logger') as Logger;

    const projectId = (req.projectId =
      (Array.isArray(req.headers['x-nuvix-project'])
        ? req.headers['x-nuvix-project'][0]
        : req.headers['x-nuvix-project']) ?? 'console');

    const mode = (req.headers['x-nuvix-mode'] as string) || 'admin';

    Authorization.setDefaultStatus(true);

    Auth.setCookieName(`a_session_${projectId}`);

    if (mode === 'admin') {
      Auth.setCookieName(`a_session_console`);
    }

    let session = Auth.decodeSession(
      req.cookies[Auth.cookieName] ||
        req.cookies[`${Auth.cookieName}_legacy`] ||
        '',
    );

    if (!session.id && !session.secret) {
      const sessionHeader = (req.headers['x-nuvix-session'] as string) || '';
      if (sessionHeader) {
        session = Auth.decodeSession(sessionHeader);
      }
    }

    if (!session.id && !session.secret) {
      res.setHeader('X-Debug-Fallback', 'true');
      const fallback = JSON.parse(
        (req.headers['x-fallback-cookies'] as string) || '{}',
      );
      session = Auth.decodeSession(fallback[Auth.cookieName] || '');
    } else {
      res.setHeader('X-Debug-Fallback', 'false');
    }

    Auth.unique = session.id || '';
    Auth.secret = session.secret || '';

    let user: Document;
    if (process.env.APP_MODE !== 'admin') {
      if (projectId === 'console') {
        user = await this.db.getDocument('users', Auth.unique);
      } else {
        user = await this.db.getDocument('users', Auth.unique);
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

    if (mode === 'admin') {
      // if (user.find('teamInternalId', projectId, 'memberships')) {
      //   Authorization.setDefaultStatus(false);
      // } else {
      //   user = new Document();
      // }
    }

    const authJWT = (req.headers['x-appwrite-jwt'] as string) || '';
    if (authJWT && projectId !== 'console') {
      try {
        // const payload = Auth.decodeJWT(authJWT);
        // const jwtUserId = payload.userId || '';
        // if (jwtUserId) {
        //   user = await this.db.findOne('users', jwtUserId);
        // }
        // const jwtSessionId = payload.sessionId || '';
        // if (jwtSessionId && !user.find('$id', jwtSessionId, 'sessions')) {
        //   user = new Document();
        // }
      } catch (error) {
        throw new Exception(
          'USER_JWT_INVALID',
          `Failed to verify JWT. ${error.message}`,
        );
      }
    }

    req[USER] = user;

    next();
  }
}
