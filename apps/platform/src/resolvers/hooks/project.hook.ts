import { Injectable, Logger } from '@nestjs/common';
import { Doc } from '@nuvix-tech/db';
import { Hook } from '@nuvix/core/server';
import { Context } from '@nuvix/utils';

@Injectable()
export class ProjectHook implements Hook {
  private readonly logger = new Logger(ProjectHook.name);
  constructor() {}

  async onRequest(req: NuvixRequest, reply: NuvixRes) {
    req[Context.Project] = new Doc({ $id: 'console' });
    return null;
  }
}
