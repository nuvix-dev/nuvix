import { NuvixAdapter, NuvixFactory } from '@nuvix/core/server'
import { AppModule } from './app.module'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import {
  ConsoleLogger,
  Logger,
  LogLevel,
  ValidationPipe,
  VERSION_NEUTRAL,
  VersioningType,
} from '@nestjs/common'
import {
  configuration,
  parseNumber,
  PROJECT_ROOT,
  validateRequiredConfig,
} from '@nuvix/utils'
import { Authorization, Role, storage } from '@nuvix/db'
import cookieParser from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import QueryString from 'qs'
import { initSetup } from './utils/initial-setup'
import { ErrorFilter } from '@nuvix/core/filters'
import { AppConfigService } from '@nuvix/core'
import { Auth } from '@nuvix/core/helper/auth.helper.js'
import { SwaggerModule } from '@nestjs/swagger'
import { openApiSetup } from './utils/open-api'

validateRequiredConfig()
Authorization.enableAsyncLocalStorage()

export async function bootstrap() {
  const adapter = new NuvixAdapter({
    trustProxy: true,
    skipMiddie: true,
    maxParamLength: 350,
    querystringParser(str) {
      return QueryString.parse(str)
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
      logger: new ConsoleLogger({
        json: configuration.app.debug.json,
        colors: configuration.app.debug.colors,
        prefix: 'Nuvix-Console',
        logLevels: configuration.app.isProduction
          ? (configuration.logLevels as LogLevel[])
          : undefined,
      }),
      autoFlushLogs: true,
    },
  )

  // @ts-ignore
  app.register(cookieParser)
  // @ts-ignore
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
      validateCustomDecorators: true,
      whitelist: true,
      forbidNonWhitelisted: true,
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
    if (origin) res.header('Access-Control-Allow-Credentials', 'true')
    done()
  })

  app.useStaticAssets({
    root: PROJECT_ROOT + '/public',
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
    Logger.warn('SIGINT received, shutting down gracefully...')
  })
  process.on('SIGTERM', () => {
    Logger.warn('SIGTERM received, shutting down gracefully...')
  })

  app.useGlobalFilters(new ErrorFilter(config))
  await initSetup(app, config as AppConfigService)
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

  const port = parseNumber(config.root.get('APP_PLATFORM_PORT'), 4100)
  const host = '0.0.0.0'
  await app.listen(port, host)

  Logger.log(
    `🚀 Platform API application is running on: http://${host}:${port}`,
    'Nuvix-Platform',
  )
}
