import { HttpServer, NestApplicationOptions } from '@nestjs/common';
import {
  ApplicationConfig,
  GraphInspector,
  NestApplication,
  NestContainer,
} from '@nestjs/core';
import { HooksModule } from './hooks/module';
import { HooksContainer } from './hooks/container';

// @ts-ignore
export class NuvixApplication extends NestApplication {
  private readonly hooksModule: HooksModule;
  private readonly middlewareContainer = new HooksContainer(this.container);

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

  public async registerModules(): Promise<void> {
    await super.registerModules();

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
