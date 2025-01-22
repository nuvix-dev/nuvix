import {
  createParamDecorator,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { Exception } from 'src/core/extend/exception';
import { PROJECT } from 'src/Utils/constants';

@Injectable()
export class ProjectMiddleware implements NestMiddleware {
  constructor(private readonly store: ClsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const logger = this.store.get('logger') as Logger;

    const projectId = req.headers['x-nuvix-project']
      ? req.headers['x-nuvix-project']
      : req.query?.project
        ? Array.isArray(req.query.project)
          ? req.query.project[0]
          : req.query.project
        : null;

    logger.debug(`Project ID: ${projectId}`);

    if (!projectId) throw new Exception(Exception.PROJECT_NOT_FOUND);

    const project = null; //await this.projectModel.finOne({ id: projectId })

    if (!project) throw new Exception(Exception.PROJECT_NOT_FOUND);

    this.store.set(PROJECT, project);

    next();
  }
}
