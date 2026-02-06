import * as crypto from 'node:crypto'
import cookieParser from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import { ValidationPipe } from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppConfigService } from '@nuvix/core'
import { ErrorFilter } from '@nuvix/core/filters'
import { Auth } from '@nuvix/core/helpers'
import { Authorization, Doc, Role, storage } from '@nuvix/db'
import { Context } from '@nuvix/utils'

/**
 * Applies common app configuration to the given NestFastifyApplication instance.
 */
export const applyAppConfig = (
  app: NestFastifyApplication,
  config: AppConfigService,
): void => {
  app.enableShutdownHooks()
  app.enableVersioning()
  // @ts-expect-error
  app.register(cookieParser)
  // @ts-expect-error
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
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )

  const fastify = app.getHttpAdapter().getInstance()
  fastify.setGenReqId((_req: any) => {
    return crypto.randomUUID() as string
  })

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

  fastify.decorateRequest('hooks_args', null as any)
  fastify.addHook('onRequest', (req: any, _, done) => {
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

    req.hooks_args = { onRequest: { sizeRef: () => size } }
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

  app.useGlobalFilters(new ErrorFilter(config))
}
