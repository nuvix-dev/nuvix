import { NuvixAdapter } from '@nuvix/core/server'
import { Test, TestingModule } from '@nuvix/core/server/test'
import { AppModule } from 'apps/server/src/app.module'
import QueryString from 'qs'
import {
  configureDbFiltersAndFormats,
  configurePgTypeParsers,
} from '@nuvix/core'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe } from '@nestjs/common'
import { Context } from '@nuvix/utils'
import { Authorization, Doc, Role, storage } from '@nuvix/db'
import cookieParser from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import { ErrorFilter } from '@nuvix/core/filters'
import { AppConfigService } from '@nuvix/core'
import { Auth } from '@nuvix/core/helpers'
import * as crypto from 'crypto'

configurePgTypeParsers()
configureDbFiltersAndFormats()
Authorization.enableAsyncLocalStorage()
let app: NestFastifyApplication

export async function getApp(): Promise<NestFastifyApplication> {
  if (!app) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication(
      new NuvixAdapter({
        trustProxy: true,
        skipMiddie: true,
        routerOptions: {
          querystringParser(str) {
            return { project: 'default', ...QueryString.parse(str) }
          },
        },
        exposeHeadRoutes: false,
      }),
    )
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
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    )

    const fastify = app.getHttpAdapter().getInstance()
    fastify.setGenReqId((_req: any) => {
      return crypto.randomUUID() as string
    })
    console.log(fastify.printRoutes())
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
    app.useGlobalFilters(new ErrorFilter(config))

    await app.init()
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
