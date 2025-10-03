import { INestApplication } from '@nestjs/common'
import { NuvixAdapter } from '@nuvix/core/server'
import { Test, TestingModule } from '@nuvix/core/server/test'
import { AppModule } from 'apps/server/src/app.module'
import QueryString from 'qs'

let app: INestApplication

export async function getApp(): Promise<INestApplication> {
  if (!app) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication(
      new NuvixAdapter({
        trustProxy: true,
        skipMiddie: true,
        querystringParser: str => QueryString.parse(str) ?? {},
        exposeHeadRoutes: false,
      }),
    )

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
