import { InjectionToken, Type } from '@nestjs/common';
import { MiddlewareConfiguration } from '@nestjs/common/interfaces/middleware/middleware-configuration.interface';
import { getClassScope } from '@nestjs/core/helpers/get-class-scope';
import { isDurable } from '@nestjs/core/helpers/is-durable';
import { NestContainer } from '@nestjs/core/injector/container';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

export class HooksContainer {
  private readonly middleware = new Map<
    string,
    Map<InjectionToken, InstanceWrapper>
  >();
  private readonly configurationSets = new Map<
    string,
    Set<MiddlewareConfiguration>
  >();

  constructor(private readonly container: NestContainer) {}

  public getMiddlewareCollection(
    moduleKey: string,
  ): Map<InjectionToken, InstanceWrapper> {
    if (!this.middleware.has(moduleKey)) {
      const moduleRef = this.container.getModuleByKey(moduleKey)!;
      this.middleware.set(moduleKey, moduleRef.middlewares);
    }
    return this.middleware.get(moduleKey)!;
  }

  public getConfigurations(): Map<string, Set<MiddlewareConfiguration>> {
    return this.configurationSets;
  }

  private a = 0;

  public insertConfig(
    configList: MiddlewareConfiguration[],
    moduleKey: string,
  ) {
    const middleware = this.getMiddlewareCollection(moduleKey);
    const targetConfig = this.getTargetConfig(moduleKey)!;
    const configurations = configList || [];
    const insertMiddleware = <T extends Type<unknown>>(metatype: T) => {
      const token = metatype;
      middleware.set(
        token,
        new InstanceWrapper({
          scope: getClassScope(metatype),
          durable: isDurable(metatype),
          name: token?.name ?? token,
          metatype,
          token,
        }),
      );
    };
    configurations.forEach(config => {
      [].concat(config.middleware).map(insertMiddleware);
      targetConfig.add(config);
    });
    this.a++;
  }

  private getTargetConfig(moduleName: string) {
    if (!this.configurationSets.has(moduleName)) {
      this.configurationSets.set(
        moduleName,
        new Set<MiddlewareConfiguration>(),
      );
    }
    return this.configurationSets.get(moduleName);
  }
}
