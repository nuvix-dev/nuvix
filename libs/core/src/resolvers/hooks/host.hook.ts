import { Injectable, Logger } from '@nestjs/common'
import { Authorization, Database, Query } from '@nuvix/db'
import { Context } from '@nuvix/utils'
import { ProjectsDoc } from '@nuvix/utils/types'
import { AppConfigService } from '../../config.service'
import { CoreService } from '../../core.service.js'
import { Exception } from '../../extend/exception'
import { Hook } from '../../server/hooks/interface'

@Injectable()
export class HostHook implements Hook {
  private readonly logger = new Logger(HostHook.name)
  private readonly dbForPlatform: Database
  constructor(
    readonly coreService: CoreService,
    readonly appConfig: AppConfigService,
  ) {
    this.dbForPlatform = coreService.getPlatformDb()
  }

  async onRequest(req: NuvixRequest, _reply: NuvixRes): Promise<void> {
    if (
      !this.appConfig.get('app').isProduction ||
      this.appConfig.isSelfHosted
    ) {
      return
    }

    const serverConfig = this.appConfig.get('server')
    const host = req.host ?? serverConfig.host
    const project = req[Context.Project] as ProjectsDoc

    if (host === serverConfig.host) {
      return
    }

    if (project.getId() === 'console') {
      throw new Exception(Exception.GENERAL_ACCESS_FORBIDDEN)
    }

    const route =
      (await Authorization.skip(() =>
        this.dbForPlatform.findOne('rules', [
          Query.equal('domain', [host]),
          Query.limit(1),
        ]),
      )) ?? null

    if (route === null) {
      // Not Implemented: will check later when support multi projects
    }

    const services = project.get('services', {})
    if ('proxy' in services) {
      const status = services.proxy
      if (!status) {
        throw new Exception(Exception.GENERAL_SERVICE_DISABLED)
      }
    }

    const path = req.url.split('?')[0] ?? '/'
    if (path.startsWith('/.well-known/acme-challenge')) {
      return
    }

    this.logger.warn(`Hostname "${host}" is not allowed`)
    throw new Exception(Exception.ROUTER_HOST_NOT_FOUND)
  }
}
