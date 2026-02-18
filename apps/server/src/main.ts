/**
 * Nuvix is a Open Source Backend that allows you to create a backend for your application in minutes.
 * This file is the entry point of the application, where the application is created and started.
 * @author Nuvix
 */

import fs from 'node:fs/promises'
import { ConsoleLogger, LOG_LEVELS, LogLevel } from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { SwaggerModule } from '@nestjs/swagger'
import {
  AppConfigService,
  configureDbFiltersAndFormats,
  configureHandlebarsHelpers,
  configurePgTypeParsers,
} from '@nuvix/core'
import { NuvixAdapter, NuvixFactory } from '@nuvix/core/server'
import { Authorization } from '@nuvix/db'
import {
  configuration,
  PROJECT_ROOT,
  validateRequiredConfig,
} from '@nuvix/utils'
import QueryString from 'qs'
import { AppModule } from './app.module'
import { applyAppConfig, openApiSetup } from './core'

configurePgTypeParsers()
configureDbFiltersAndFormats()
validateRequiredConfig()
configureHandlebarsHelpers()
Authorization.enableAsyncLocalStorage()

async function bootstrap() {
  const logLevels = configuration.app.isProduction
    ? (configuration.logLevels as LogLevel[])
    : undefined
  const logger = new ConsoleLogger({
    json: configuration.app.debug.json,
    colors: configuration.app.debug.colors,
    prefix: 'Nuvix',
    logLevels,
  })

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
      logger,
    },
  )

  app.useStaticAssets({
    root: `${PROJECT_ROOT}/public`,
    prefix: '/public/',
  })

  const config = app.get(AppConfigService)
  applyAppConfig(app, config)

  process.on('SIGINT', async () => {
    logger.warn('SIGINT received, shutting down gracefully...')
  })
  process.on('SIGTERM', async () => {
    logger.warn('SIGTERM received, shutting down gracefully...')
  })

  await SwaggerModule.loadPluginMetadata(async () => {
    try {
      // @ts-nocheck
      return await (await import('./metadata')).default()
    } catch (err) {
      logger.warn('No swagger metadata found, skipping...')
      logger.debug((err as Error).stack || err)
      return {}
    }
  })
  openApiSetup(app)

  // TODO: create a separate function to handle setup
  await fs.mkdir(configuration.storage.temp, { recursive: true }).catch(err => {
    if (err.code !== 'EEXIST') {
      logger.error(
        `Failed to create temp storage directory: ${err.message}`,
        'Bootstrap',
      )
      process.exit(1)
    }
  })

  const port = Number.parseInt(config.root.get('NUVIX_API_PORT', '4000'), 10)
  const host = '0.0.0.0'

  logger.setLogLevels(
    logLevels
      ? logLevels.filter(l => l !== 'log')
      : ['verbose', 'warn', 'error', 'fatal'],
  )
  await app.init()
  logger.setLogLevels(logLevels ?? LOG_LEVELS)

  await app.listen(port, host)

  logger.log(
    `🚀 Nuvix application is running on:  http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`,
    'Main',
  )
}

bootstrap()
