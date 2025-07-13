import { Injectable, Logger } from '@nestjs/common';
import { Hook } from '@nuvix/core/server';
import { PROJECT_DB_CLIENT, PROJECT } from '@nuvix/utils/constants';

import { CLIENT } from '../constants';
import { PostgresMeta } from '../lib';
import { Document } from '@nuvix/database';
import { Exception } from '@nuvix/core/extend/exception';
import { Client } from 'pg';

@Injectable()
export class ResolveClient implements Hook {
  private readonly logger = new Logger(ResolveClient.name);

  async preHandler(req: NuvixRequest) {
    const project = req[PROJECT] as Document;

    if (project.isEmpty() || project.getId() === 'console') {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const client = req[PROJECT_DB_CLIENT] as Client;

    req[CLIENT] = new PostgresMeta(client);
    return;
  }

  // TODO: we don't need to handle it here, because client will be ended in Project Hook
  async onResponse(req: NuvixRequest) {
    const pgMeta = req[CLIENT] as PostgresMeta;

    if (pgMeta) {
      try {
        await pgMeta.end();
      } catch (e: any) {
        this.logger.warn(
          'An error occured while ending the client: ',
          e?.message,
        );
      }
    }
  }
}
