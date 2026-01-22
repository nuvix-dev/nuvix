import { NuvixAdapter } from '@nuvix/core/server'
import { Test, TestingModule } from '@nuvix/core/server/test'
import { AppModule } from 'apps/server/src/app.module'
import QueryString from 'qs'
import {
  configureDbFiltersAndFormats,
  configurePgTypeParsers,
} from '@nuvix/core'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ConsoleLogger, LOG_LEVELS, Logger } from '@nestjs/common'
import { validateRequiredConfig } from '@nuvix/utils'
import { Authorization } from '@nuvix/db'
import { AppConfigService } from '@nuvix/core'
import { initSetup } from '../../../platform/src/utils/initial-setup'
import { applyAppConfig } from '../../src/core'
import { dbSetup } from './db-setup'

configurePgTypeParsers()
configureDbFiltersAndFormats()
validateRequiredConfig()
Authorization.enableAsyncLocalStorage()
let app: NestFastifyApplication

export async function getApp(): Promise<NestFastifyApplication> {
  if (!app) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    const logger = new ConsoleLogger({
      prefix: 'nx-test',
      colors: false,
    })
    app = moduleFixture.createNestApplication(
      new NuvixAdapter({
        trustProxy: true,
        skipMiddie: true,
        routerOptions: {
          querystringParser(str) {
            return { project: 'test', ...QueryString.parse(str) }
          },
        },
        exposeHeadRoutes: false,
      }),
      {
        logger,
      },
    )

    const config = app.get(AppConfigService)
    applyAppConfig(app, config)
    await dbSetup(app, config)

    logger.setLogLevels([])
    await app.init()
    logger.setLogLevels(LOG_LEVELS)
    await app.listen(0) // required for Fastify hooks
  }
  return app
}

export async function closeApp() {
  if (app) {
    await app.close()
    app = undefined!
  }
}
