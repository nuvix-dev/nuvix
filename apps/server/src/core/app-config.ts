import * as crypto from 'node:crypto'
import cookieParser from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import { ValidationPipe } from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ErrorFilter } from '@nuvix/core/filters'
import { Authorization, Role, storage } from '@nuvix/db'
import handlebars from 'handlebars'
import { AppMode, configuration } from '@nuvix/utils'
import { CoreService } from '@nuvix/core/core.service'
import { RequestContext } from '@nuvix/core/helpers'
import { Exception } from '@nuvix/core/extend/exception'

/**
 * Applies common app configuration to the given NestFastifyApplication instance.
 */
export const applyAppConfig = (app: NestFastifyApplication): void => {
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

  app.setViewEngine({
    engine: {
      handlebars,
    },
    templates: configuration.assets.views,
    layout: 'layout.hbs',
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
  fastify.setGenReqId(() => {
    return crypto.randomUUID() as string
  })

  const coreService = app.get(CoreService)
  const internaldb = coreService.getInternalDatabase()

  fastify.decorateRequest('hooks_args')
  fastify.addHook('onRequest', (_req, _, done) => {
    storage.run(new Map(), () => {
      Authorization.setDefaultStatus(true) // Set per-request default status
      Authorization.cleanRoles() // Reset roles per request
      Authorization.setRole(Role.any().toString())
      done()
    })
  })

  fastify.addHook('onRequest', async req => {
    const request = req as unknown as NuvixRequest
    const project = await internaldb.getDocument(
      'projects',
      configuration.app.projectId,
    )

    if (project.empty()) {
      request.context = new RequestContext()
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found', 404)
    }

    const mode = (request.query as { mode?: string }).mode as string | undefined

    if (mode && ![AppMode.ADMIN, AppMode.DEFAULT].includes(mode as AppMode)) {
      throw new Exception(Exception.INVALID_PARAMS, 'Invalid mode', 400)
    }

    request.context = new RequestContext({
      project,
      mode: mode === AppMode.ADMIN ? AppMode.ADMIN : AppMode.DEFAULT,
    })
  })

  app.useGlobalFilters(new ErrorFilter())
}
