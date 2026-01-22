/**
 * Nuvix is a Open Source Backend that allows you to create a backend for your application in minutes.
 * This file is the entry point of the application, where the application is created and started.
 * @author Nuvix-Tech
 * @version 0.1.0
 * @alpha
 */
import {
  AppConfigService,
  configureDbFiltersAndFormats,
  configurePgTypeParsers,
} from '@nuvix/core'
import { NuvixAdapter, NuvixFactory } from '@nuvix/core/server'
import { AppModule } from './app.module'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ConsoleLogger, Logger, LogLevel } from '@nestjs/common'
import {
  configuration,
  PROJECT_ROOT,
  validateRequiredConfig,
} from '@nuvix/utils'
import { Authorization } from '@nuvix/db'
import QueryString from 'qs'
import fs from 'fs/promises'
import { SwaggerModule } from '@nestjs/swagger'
import { applyAppConfig, openApiSetup } from './core'

configurePgTypeParsers()
configureDbFiltersAndFormats()
validateRequiredConfig()
Authorization.enableAsyncLocalStorage()

async function bootstrap() {
  const app = await NuvixFactory.create<NestFastifyApplication>(
    AppModule,
    new NuvixAdapter({
      trustProxy: true,
      skipMiddie: true,
      routerOptions: {
        querystringParser(str) {
          return QueryString.parse(str)
        },
      },
      exposeHeadRoutes: false,
      logger: {
        enabled: false,
        edgeLimit: 100,
        msgPrefix: '[Nuvix] ',
        safe: true,
      },
    }),
    {
      abortOnError: false,
      logger: new ConsoleLogger({
        json: configuration.app.debug.json,
        colors: configuration.app.debug.colors,
        prefix: 'Nuvix',
        logLevels: configuration.app.isProduction
          ? (configuration.logLevels as LogLevel[])
          : undefined,
      }),
    },
  )

  app.useStaticAssets({
    root: PROJECT_ROOT + '/public',
    prefix: '/public/',
  })

  const config = app.get(AppConfigService)
  applyAppConfig(app, config)

  process.on('SIGINT', async () => {
    Logger.warn('SIGINT received, shutting down gracefully...')
  })
  process.on('SIGTERM', async () => {
    Logger.warn('SIGTERM received, shutting down gracefully...')
  })

  await SwaggerModule.loadPluginMetadata(async () => {
    try {
      // @ts-ignore
      return await (await import('./metadata')).default()
    } catch (err) {
      Logger.warn('No swagger metadata found, skipping...')
      Logger.debug((err as Error).stack || err)
      return {}
    }
  })
  openApiSetup(app)

  // TODO: create a separate function to handle setup
  await fs.mkdir(configuration.storage.temp, { recursive: true }).catch(err => {
    if (err.code !== 'EEXIST') {
      Logger.error(
        `Failed to create temp storage directory: ${err.message}`,
        'Bootstrap',
      )
      process.exit(1)
    }
  })

  const port = parseInt(config.root.get('APP_SERVER_PORT', '4000'), 10)
  const host = '0.0.0.0'
  await app.listen(port, host)

  Logger.log(
    `🚀 Nuvix application is running on:  http://${host}:${port}`,
    'Bootstrap',
  )
}

bootstrap()
