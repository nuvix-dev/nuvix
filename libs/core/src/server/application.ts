import { HttpServer, NestApplicationOptions } from '@nestjs/common'
import {
  ApplicationConfig,
  GraphInspector,
  NestApplication,
  NestContainer,
} from '@nestjs/core'
import { optionalRequire } from '@nestjs/core/helpers/optional-require.js'
import { HooksContainer } from './hooks/container'
import { HooksModule } from './hooks/module'

const { MicroservicesModule } = optionalRequire(
  '@nestjs/microservices/microservices-module',
  () => require('@nestjs/microservices/microservices-module.js'),
)

// @ts-expect-error
export class NuvixApplication extends NestApplication {
  private readonly hooksModule: HooksModule
  private override readonly middlewareContainer = new HooksContainer(
    this.container,
  )
  private override readonly microservicesModule =
    MicroservicesModule && new MicroservicesModule()

  constructor(
    container: NestContainer,
    private override readonly httpAdapter: HttpServer,
    private override readonly config: ApplicationConfig,
    private override readonly graphInspector: GraphInspector,
    appOptions: NestApplicationOptions = {},
  ) {
    super(container, httpAdapter, config, graphInspector, appOptions)

    this.hooksModule = new HooksModule()
  }

  public override async registerModules(): Promise<void> {
    this.registerWsModule()

    if (this.microservicesModule) {
      this.microservicesModule.register(
        this.container,
        this.graphInspector,
        this.config,
        this.appOptions,
      )
      this.microservicesModule.setupClients(this.container)
    }

    await this.hooksModule.register(
      this.middlewareContainer,
      this.container,
      this.config,
      this.injector,
      this.httpAdapter,
      this.graphInspector,
      this.appOptions,
    )
  }

  private override async registerMiddleware(instance: any) {
    await this.hooksModule.registerMiddleware(
      this.middlewareContainer,
      instance,
    )
  }
}
