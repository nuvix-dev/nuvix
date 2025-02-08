import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Authorization, Database, Document } from '@nuvix/database';
import { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import ParamsHelper from 'src/core/helper/params.helper';
import { DB_FOR_CONSOLE, DB_FOR_PROJECT, PROJECT } from 'src/Utils/constants';

@Injectable()
export class ProjectMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ProjectMiddleware.name);
  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly db: Database,
    @Inject(DB_FOR_PROJECT) private readonly projectDb: Database,
    private readonly store: ClsService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const params = new ParamsHelper(req);
    const projectId =
      params.getFromHeaders('x-nuvix-project') ||
      params.getFromQuery('project', 'console');

    if (projectId === 'console') {
      req[PROJECT] = new Document({ $id: 'console' });
      next();
      return null;
    }

    const project = await Authorization.skip(
      async () => await this.db.getDocument('projects', projectId as string),
    );

    if (!project.isEmpty()) {
      this.logger.debug(`Project: ${project.getAttribute('name')}`);
      this.projectDb.setPrefix(`_${project.getInternalId()}`);
      this.projectDb.setTenant(Number(project.getInternalId()));
    }

    req[PROJECT] = project;

    next();
  }
}
