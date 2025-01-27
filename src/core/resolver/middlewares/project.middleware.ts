import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Database, Document } from '@nuvix/database';
import { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { DB_FOR_CONSOLE, DB_FOR_PROJECT, PROJECT } from 'src/Utils/constants';

@Injectable()
export class ProjectMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ProjectMiddleware.name);
  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly db: Database,
    @Inject(DB_FOR_PROJECT) private readonly projectDb: Database,
    private readonly store: ClsService,
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {
    const projectHeader = req.headers['x-nuvix-project'];
    const projectQuery = req.query.project;

    let projectIds: any =
      projectHeader?.toString() || projectQuery?.toString() || 'console';

    projectIds = projectIds.split(',').map((id: any) => id.trim());

    const projectId = [...new Set(projectIds)][0];

    if (projectId === 'console') {
      req[PROJECT] = new Document();
      next();
      return null;
    }

    const project = await this.db.getDocument('projects', projectId as string);

    if (!project.isEmpty()) {
      this.logger.debug(`Project: ${project.getAttribute('name')}`);
      this.projectDb.setPrefix(`_${project.getInternalId()}`);
      this.projectDb.setTenant(Number(project.getInternalId()));
    }

    req[PROJECT] = project;

    next();
  }
}
