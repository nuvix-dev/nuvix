import { Injectable, Logger, Inject } from '@nestjs/common';
import { Authorization, Database, Document, Query } from '@nuvix/database';
import { Exception } from '@nuvix/core/extend/exception';

import {
  DB_FOR_PLATFORM,
  PROJECT,
  SERVER_CONFIG,
} from '@nuvix/utils/constants';
import { Hook } from '../../server/hooks/interface';

@Injectable()
export class HostHook implements Hook {
  private readonly logger = new Logger(HostHook.name);
  constructor(
    @Inject(DB_FOR_PLATFORM) private readonly dbForPlatform: Database,
  ) {}

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    const host = req.hostname ?? SERVER_CONFIG.host;
    const project: Document = req[PROJECT];

    if (host === SERVER_CONFIG.host) {
      return;
    }

    if (project.getId() === 'console') {
      throw new Exception(Exception.GENERAL_ACCESS_FORBIDDEN);
    }

    const route =
      (await Authorization.skip(
        async () =>
          await this.dbForPlatform.find('rules', [
            Query.equal('domain', [host]),
            Query.limit(1),
          ]),
      )[0]) ?? null;

    if (route === null) {
      if (host === SERVER_CONFIG.functionsDomain) {
        throw new Exception(
          Exception.GENERAL_ACCESS_FORBIDDEN,
          'This domain cannot be used for security reasons. Please use any subdomain instead.',
        );
      }

      if (host.endsWith(SERVER_CONFIG.functionsDomain)) {
        throw new Exception(
          Exception.GENERAL_ACCESS_FORBIDDEN,
          'This domain is not connected to any Nuvix resource yet. Please configure custom domain or function domain to allow this request.',
        );
      }

      if (process.env._APP_OPTIONS_ROUTER_PROTECTION === 'enabled') {
        if (host !== SERVER_CONFIG.host) {
          throw new Exception(
            Exception.GENERAL_ACCESS_FORBIDDEN,
            'Router protection does not allow accessing Nuvix over this domain. Please add it as custom domain to your project.',
          );
        }
      }

      return;
    }

    const services = project.getAttribute('services', {});
    if ('proxy' in services) {
      const status = services['proxy'];
      if (!status) {
        throw new Exception(Exception.GENERAL_SERVICE_DISABLED);
      }
    }

    const path = req.url.split('?')[0] ?? '/';
    if (path.startsWith('/.well-known/acme-challenge')) {
      return;
    }

    this.logger.warn(`Hostname "${host}" is not allowed`);
    throw new Exception(Exception.ROUTER_HOST_NOT_FOUND);
  }
}
