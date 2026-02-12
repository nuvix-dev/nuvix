/**
 * The main entry point for the Nuvix Platform application.
 * @author Nuvix-Tech
 * @version 1.0
 */

import cookieParser from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import {
  ConsoleLogger,
  LOG_LEVELS,
  LogLevel,
  ValidationPipe,
  VERSION_NEUTRAL,
  VersioningType,
} from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { SwaggerModule } from '@nestjs/swagger'
import {
  AppConfigService,
  configureDbFiltersAndFormats,
  configurePgTypeParsers,
} from '@nuvix/core'
import { ErrorFilter } from '@nuvix/core/filters'
import { Auth } from '@nuvix/core/helpers'
import { NuvixAdapter, NuvixFactory } from '@nuvix/core/server'
import { Authorization, Role, storage } from '@nuvix/db'
import {
  configuration,
  PROJECT_ROOT,
  parseNumber,
  validateRequiredConfig,
} from '@nuvix/utils'
import QueryString from 'qs'
import { AppModule } from './app.module'
import { initSetup } from './utils/initial-setup'
import { openApiSetup } from './utils/open-api'

configurePgTypeParsers()
configureDbFiltersAndFormats()
validateRequiredConfig()
Authorization.enableAsyncLocalStorage()

export async function bootstrap() {
  const logLevels = configuration.app.isProduction
    ? (configuration.logLevels as LogLevel[])
    : undefined
  const logger = new ConsoleLogger({
    json: configuration.app.debug.json,
    colors: configuration.app.debug.colors,
    prefix: 'Nuvix-Platform',
    logLevels,
  })

  const adapter = new NuvixAdapter({
    trustProxy: true,
    skipMiddie: true,
    routerOptions: {
      maxParamLength: 350,
      querystringParser(str) {
        return QueryString.parse(str)
      },
    },
    logger: {
      enabled: true,
      edgeLimit: 100,
      msgPrefix: '[Nuvix-Platform] ',
      safe: true,
      level: 'error',
    },
  })

  const app = await NuvixFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    {
      abortOnError: false,
      logger,
      autoFlushLogs: true,
    },
  )

  // @ts-expect-error
  app.register(cookieParser)
  // @ts-expect-error
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  })

  app.enableShutdownHooks()
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'X-API-Version',
    defaultVersion: VERSION_NEUTRAL,
  })
  app.useGlobalPipes(
    new ValidationPipe({
      stopAtFirstError: false,
      transform: true,
      transformOptions: {
        exposeDefaultValues: true,
      },
      whitelist: true,
    }),
  )

  const fastify = adapter.getInstance()
  const config = app.get(AppConfigService)

  fastify.addHook('onRequest', (req, res, done) => {
    res.header('X-Powered-By', 'Nuvix-Server')
    res.header('Server', 'Nuvix')
    /**
     * CORS headers are set here because
     * CorsHook works after project & host hooks - if an error is thrown before CorsHook
     * executes, we need these headers to prevent invalid CORS errors; CorsHook will
     * properly validate and block requests that aren't allowed
     */
    const origin = req.headers.origin
    res.header('Access-Control-Allow-Origin', origin || '*')
    if (origin) {
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    done()
  })

  app.useStaticAssets({
    root: `${PROJECT_ROOT}/public`,
    prefix: '/public/',
  })

  fastify.addHook('onRequest', (_, __, done) => {
    storage.run(new Map(), () => {
      Authorization.setDefaultStatus(true) // Set per-request default status
      Authorization.cleanRoles() // Reset roles per request
      Authorization.setRole(Role.any().toString())
      Auth.setPlatformActor(false)
      Auth.setTrustedActor(false)
      done()
    })
  })

  process.on('SIGINT', () => {
    logger.warn('SIGINT received, shutting down gracefully...')
  })
  process.on('SIGTERM', () => {
    logger.warn('SIGTERM received, shutting down gracefully...')
  })

  app.useGlobalFilters(new ErrorFilter(config))
  await initSetup(app, config as AppConfigService)
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

  const port = parseNumber(config.root.get('NUVIX_PLATFORM_PORT'), 4100)
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
    `🚀 Platform API application is running on: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`,
    'Main',
  )
}

bootstrap()
