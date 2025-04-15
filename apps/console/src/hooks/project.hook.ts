import { Injectable, Logger } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PROJECT } from '@nuvix/utils/constants';
import { Hook } from '@nuvix/core/server';

@Injectable()
export class ProjectHook implements Hook {
  private readonly logger = new Logger(ProjectHook.name);
  constructor() {}

  async onRequest(req: FastifyRequest, reply: FastifyReply) {
    req[PROJECT] = new Document({ $id: 'console' });
    return null;
  }
}
