import { Inject, Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Document } from '@nuvix/database';
import ParamsHelper from 'src/core/helper/params.helper';
import { FastifyRequest, FastifyReply } from 'fastify';
import { DB_FOR_CONSOLE, DB_FOR_PROJECT, PROJECT } from 'src/Utils/constants';
import { Hook } from '../../server/hooks/interface';

@Injectable()
export class ProjectHook implements Hook {
  private readonly logger = new Logger(ProjectHook.name);
  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly db: Database,
    @Inject(DB_FOR_PROJECT) private readonly projectDb: Database,
  ) {}

  async onRequest(req: FastifyRequest, reply: FastifyReply) {
    const params = new ParamsHelper(req);
    const projectId =
      params.getFromHeaders('x-nuvix-project') ||
      params.getFromQuery('project', 'console');

    if (projectId === 'console') {
      req[PROJECT] = new Document({ $id: 'console' });
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
    return null;
  }
}
