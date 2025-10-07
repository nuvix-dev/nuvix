import { NuvixAdapter, NuvixFactory } from '@nuvix/core/server'
import { AppModule } from './app.module'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ConsoleLogger, Logger, LogLevel, ValidationPipe } from '@nestjs/common'
import {
  configuration,
  Context,
  PROJECT_ROOT,
  validateRequiredConfig,
} from '@nuvix/utils'
import { Authorization, Doc, Role, storage } from '@nuvix/db'
import cookieParser from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import QueryString from 'qs'
import fs from 'fs/promises'
import { SwaggerModule } from '@nestjs/swagger'
import { ErrorFilter } from '@nuvix/core/filters'
import { AppConfigService } from '@nuvix/core'
import { openApiSetup } from './core'
import { Auth } from '@nuvix/core/helper/auth.helper.js'
import * as crypto from 'crypto'

validateRequiredConfig()
Authorization.enableAsyncLocalStorage()

export async function bootstrap() {
  const app = await NuvixFactory.create<NestFastifyApplication>(
    AppModule,
    new NuvixAdapter({
      trustProxy: true,
      skipMiddie: true,
      querystringParser(str) {
        return QueryString.parse(str)
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

  app.enableShutdownHooks()
  app.enableVersioning()
  // @ts-ignore
  app.register(cookieParser)
  // @ts-ignore
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
    attachFieldsToBody: true,
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

  const fastify = app.getHttpAdapter().getInstance()
  fastify.setGenReqId((_req: any) => {
    return crypto.randomUUID() as string
  })
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

  fastify.decorateRequest('hooks_args', null as any)
  fastify.addHook('onRequest', (req: any, res, done) => {
    let size = 0

    // Patch the raw stream push method
    const origPush = req.raw.push
    req.raw.push = function (chunk: any, encoding?: BufferEncoding) {
      if (chunk) {
        size += Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(chunk, encoding)
      }
      return origPush.call(this, chunk, encoding)
    }

    req['hooks_args'] = { onRequest: { sizeRef: () => size } }
    storage.run(new Map(), () => {
      req[Context.Project] = new Doc()
      Authorization.setDefaultStatus(true) // Set per-request default status
      Authorization.cleanRoles() // Reset roles per request
      Authorization.setRole(Role.any().toString())
      Auth.setPlatformActor(false)
      Auth.setTrustedActor(false)
      done()
    })
  })

  process.on('SIGINT', async () => {
    Logger.warn('SIGINT received, shutting down gracefully...')
  })
  process.on('SIGTERM', async () => {
    Logger.warn('SIGTERM received, shutting down gracefully...')
  })

  app.useGlobalFilters(new ErrorFilter(config))
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
    `🚀 Nuvix SERVER application is running on:  http://${host}:${port}`,
    'Bootstrap',
  )
}
