import { Injectable, NestMiddleware, Logger, Inject } from '@nestjs/common';
import { Database, Document } from '@nuvix/database';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { Exception } from 'src/core/extend/exception';
import { DB_FOR_CONSOLE, PROJECT, USER } from 'src/Utils/constants';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly store: ClsService,
    @Inject(DB_FOR_CONSOLE) readonly db: Database,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const logger = this.store.get('logger') as Logger;

    req.user = await this.db.findOne('users');

    const user = req.user ? req.user : new Document();

    req[USER] = user;

    next();
  }
}
