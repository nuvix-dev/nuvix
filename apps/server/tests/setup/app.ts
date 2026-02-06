import { ConsoleLogger, LOG_LEVELS } from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import {
  AppConfigService,
  configureDbFiltersAndFormats,
  configurePgTypeParsers,
} from '@nuvix/core'
import { NuvixAdapter } from '@nuvix/core/server'
import { Test, TestingModule } from '@nuvix/core/server/test'
import { Authorization } from '@nuvix/db'
import { configuration, validateRequiredConfig } from '@nuvix/utils'
import { AppModule } from 'apps/server/src/app.module'
import QueryString from 'qs'
import { applyAppConfig } from '../../src/core'
import { dbSetup } from './db'

configurePgTypeParsers()
configureDbFiltersAndFormats()
validateRequiredConfig()
Authorization.enableAsyncLocalStorage()
let app: NestFastifyApplication

export async function getApp(): Promise<NestFastifyApplication> {
  if (!app) {
    const logLevels = configuration.logLevels as typeof LOG_LEVELS
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    const logger = new ConsoleLogger({
      prefix: 'nx-test',
      colors: false,
      forceConsole: true,
      logLevels,
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
    logger.setLogLevels(logLevels)
  }
  return app
}

export async function closeApp() {
  if (app) {
    await app.close()
    app = undefined!
  }
}
