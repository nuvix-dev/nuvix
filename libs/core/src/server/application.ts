import { HttpServer, NestApplicationOptions } from '@nestjs/common';
import {
  ApplicationConfig,
  GraphInspector,
  NestApplication,
  NestContainer,
} from '@nestjs/core';
import { HooksModule } from './hooks/module';
import { HooksContainer } from './hooks/container';
import { optionalRequire } from '@nestjs/core/helpers/optional-require';

// Properly handle optional microservices module
let MicroservicesModule: any = null;
try {
  // Attempt to load the module if available
  MicroservicesModule = optionalRequire('@nestjs/microservices/microservices-module');
} catch (e) {
  // Module not available, that's fine as it's optional
}

// @ts-ignore
export class NuvixApplication extends NestApplication {
  private readonly hooksModule: HooksModule;
  private readonly middlewareContainer = new HooksContainer(this.container);
  private override readonly microservicesModule =
    MicroservicesModule && new MicroservicesModule();

  constructor(
    container: NestContainer,
    private readonly httpAdapter: HttpServer,
    private readonly config: ApplicationConfig,
    private readonly graphInspector: GraphInspector,
    appOptions: NestApplicationOptions = {},
  ) {
    super(container, httpAdapter, config, graphInspector, appOptions);

    this.hooksModule = new HooksModule();
  }

  public override async registerModules(): Promise<void> {
    this.registerWsModule();

    if (this.microservicesModule) {
      this.microservicesModule.register(
        this.container,
        this.graphInspector,
        this.config,
        this.appOptions,
      );
      this.microservicesModule.setupClients(this.container);
    }

    await this.hooksModule.register(
      this.middlewareContainer,
      this.container,
      this.config,
      this.injector,
      this.httpAdapter,
      this.graphInspector,
      this.appOptions,
    );
  }

  private override async registerMiddleware(instance: any) {
    await this.hooksModule.registerMiddleware(
      this.middlewareContainer,
      instance,
    );
  }
}
