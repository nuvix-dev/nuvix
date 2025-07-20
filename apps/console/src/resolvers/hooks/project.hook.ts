import { Injectable, Logger } from '@nestjs/common';
import { Document } from '@nuvix/database';

import { PROJECT } from '@nuvix/utils/constants';
import { Hook } from '@nuvix/core/server';

@Injectable()
export class ProjectHook implements Hook {
  private readonly logger = new Logger(ProjectHook.name);
  constructor() {}

  async onRequest(req: NuvixRequest, reply: NuvixRes) {
    req[PROJECT] = new Document({ $id: 'console' });
    return null;
  }
}
