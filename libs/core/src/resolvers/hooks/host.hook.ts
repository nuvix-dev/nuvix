import { Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Query } from '@nuvix/db';
import { Exception } from '@nuvix/core/extend/exception';
import { Context } from '@nuvix/utils';
import { Hook } from '../../server/hooks/interface';
import { ProjectsDoc } from '@nuvix/utils/types';
import { CoreService } from '@nuvix/core/core.service.js';
import { AppConfigService } from '@nuvix/core/config.service';

@Injectable()
export class HostHook implements Hook {
  private readonly logger = new Logger(HostHook.name);
  private readonly dbForPlatform: Database;
  constructor(
    readonly coreService: CoreService,
    readonly appConfig: AppConfigService,
  ) {
    this.dbForPlatform = coreService.getPlatformDb();
  }

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    if (
      !this.appConfig.get('app').isProduction ||
      this.appConfig.isSelfHosted
    ) {
      return;
    }

    const serverConfig = this.appConfig.get('server');
    const host = req.host ?? serverConfig.host;
    const project = req[Context.Project] as ProjectsDoc;

    if (host === serverConfig.host) {
      return;
    }

    if (project.getId() === 'console') {
      throw new Exception(Exception.GENERAL_ACCESS_FORBIDDEN);
    }

    const route =
      (await Authorization.skip(() =>
        this.dbForPlatform.findOne('rules', [
          Query.equal('domain', [host]),
          Query.limit(1),
        ]),
      )) ?? null;

    if (route === null) {
      if (host === serverConfig.functionsDomain) {
        throw new Exception(
          Exception.GENERAL_ACCESS_FORBIDDEN,
          'This domain cannot be used for security reasons. Please use any subdomain instead.',
        );
      }

      if (
        serverConfig.functionsDomain &&
        host.endsWith(serverConfig.functionsDomain)
      ) {
        throw new Exception(
          Exception.GENERAL_ACCESS_FORBIDDEN,
          'This domain is not connected to any Nuvix resource yet. Please configure custom domain or function domain to allow this request.',
        );
      }

      return;
    }

    const services = project.get('services', {});
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
