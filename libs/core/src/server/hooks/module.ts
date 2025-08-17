import { HttpServer, InjectionToken, Logger } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common/enums/request-method.enum';
import {
  MiddlewareConfiguration,
  RouteInfo,
} from '@nestjs/common/interfaces/middleware';
import { NestApplicationContextOptions } from '@nestjs/common/interfaces/nest-application-context-options.interface';
import { isUndefined } from '@nestjs/common/utils/shared.utils';
import { ApplicationConfig } from '@nestjs/core/application-config';
import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception';
import { ContextIdFactory } from '@nestjs/core/helpers/context-id-factory';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { STATIC_CONTEXT } from '@nestjs/core/injector/constants';
import { NestContainer } from '@nestjs/core/injector/container';
import { Injector } from '@nestjs/core/injector/injector';
import {
  ContextId,
  InstanceWrapper,
} from '@nestjs/core/injector/instance-wrapper';
import { Module } from '@nestjs/core/injector/module';
import { GraphInspector } from '@nestjs/core/inspector/graph-inspector';
import {
  Entrypoint,
  MiddlewareEntrypointMetadata,
} from '@nestjs/core/inspector/interfaces/entrypoint.interface';
import { REQUEST_CONTEXT_ID } from '@nestjs/core/router/request/request-constants';
import { RouterExceptionFilters } from '@nestjs/core/router/router-exception-filters';
import { RouterProxy } from '@nestjs/core/router/router-proxy';
import { isRequestMethodAll } from '@nestjs/core/router/utils';
import { MiddlewareBuilder } from '@nestjs/core/middleware/builder';
import { HooksContainer } from './container';
import { MiddlewareResolver } from '@nestjs/core/middleware/resolver';
import { RouteInfoPathExtractor } from '@nestjs/core/middleware/route-info-path-extractor';
import { RoutesMapper } from '@nestjs/core/middleware/routes-mapper';
import { Hook, HookMethods } from './interface';

export class HooksModule<
  TAppOptions extends
    NestApplicationContextOptions = NestApplicationContextOptions,
> {
  private readonly routerProxy = new RouterProxy();
  private readonly exceptionFiltersCache = new WeakMap();
  private readonly logger = new Logger(HooksModule.name);

  declare private injector: Injector;
  declare private routerExceptionFilter: RouterExceptionFilters;
  declare private routesMapper: RoutesMapper;
  declare private resolver: MiddlewareResolver;
  declare private container: NestContainer;
  declare private httpAdapter: HttpServer;
  declare private graphInspector: GraphInspector;
  declare private appOptions: TAppOptions;
  declare private routeInfoPathExtractor: RouteInfoPathExtractor;

  public async register(
    HooksContainer: HooksContainer,
    container: NestContainer,
    config: ApplicationConfig,
    injector: Injector,
    httpAdapter: HttpServer,
    graphInspector: GraphInspector,
    options: TAppOptions,
  ) {
    this.appOptions = options;

    const appRef = container.getHttpAdapterRef();
    this.routerExceptionFilter = new RouterExceptionFilters(
      container,
      config,
      appRef,
    );
    this.routesMapper = new RoutesMapper(container, config);
    this.resolver = new MiddlewareResolver(HooksContainer as any, injector);
    this.routeInfoPathExtractor = new RouteInfoPathExtractor(config);
    this.injector = injector;
    this.container = container;
    this.httpAdapter = httpAdapter;
    this.graphInspector = graphInspector;

    const modules = container.getModules();
    await this.resolveMiddleware(HooksContainer, modules);
  }

  public async resolveMiddleware(
    HooksContainer: HooksContainer,
    modules: Map<string, Module>,
  ) {
    const moduleEntries = [...modules.entries()];
    const loadMiddlewareConfiguration = async ([moduleName, moduleRef]: [
      string,
      Module,
    ]) => {
      await this.loadConfiguration(HooksContainer, moduleRef, moduleName);
      await this.resolver.resolveInstances(moduleRef, moduleName);
    };
    await Promise.all(moduleEntries.map(loadMiddlewareConfiguration));
  }

  public async loadConfiguration(
    HooksContainer: HooksContainer,
    moduleRef: Module,
    moduleKey: string,
  ) {
    const { instance } = moduleRef;
    if (!instance.configure) {
      return;
    }
    const middlewareBuilder = new MiddlewareBuilder(
      this.routesMapper,
      this.httpAdapter,
      this.routeInfoPathExtractor,
    );
    try {
      await instance.configure(middlewareBuilder);
    } catch (err) {
      if (!this.appOptions.preview) {
        throw err;
      }
      const warningMessage =
        `Warning! "${moduleRef.name}" module exposes a "configure" method that throws an exception in the preview mode` +
        ` (possibly due to missing dependencies). Note: you can ignore this message, just be aware that some of those conditional middlewares will not be reflected in your graph.`;
      this.logger.warn(warningMessage);
    }

    if (!(middlewareBuilder instanceof MiddlewareBuilder)) {
      return;
    }
    const config = middlewareBuilder.build();
    HooksContainer.insertConfig(config, moduleKey);
  }

  public async registerMiddleware(
    HooksContainer: HooksContainer,
    applicationRef: any,
  ) {
    const configs = HooksContainer.getConfigurations();
    const registerAllConfigs = async (
      moduleKey: string,
      middlewareConfig: MiddlewareConfiguration[],
    ) => {
      for (const config of middlewareConfig) {
        await this.registerMiddlewareConfig(
          HooksContainer,
          config,
          moduleKey,
          applicationRef,
        );
      }
    };

    const entriesSortedByDistance = [...configs.entries()].sort(
      ([moduleA], [moduleB]) => {
        const moduleARef = this.container.getModuleByKey(moduleA)!;
        const moduleBRef = this.container.getModuleByKey(moduleB)!;
        const isModuleAGlobal = moduleARef.distance === Number.MAX_VALUE;
        const isModuleBGlobal = moduleBRef.distance === Number.MAX_VALUE;
        if (isModuleAGlobal && isModuleBGlobal) {
          return 0;
        }
        if (isModuleAGlobal) {
          return -1;
        }
        if (isModuleBGlobal) {
          return 1;
        }
        return moduleARef.distance - moduleBRef.distance;
      },
    );
    for (const [moduleRef, moduleConfigurations] of entriesSortedByDistance) {
      await registerAllConfigs(moduleRef, [...moduleConfigurations]);
    }
  }

  public async registerMiddlewareConfig(
    HooksContainer: HooksContainer,
    config: MiddlewareConfiguration,
    moduleKey: string,
    applicationRef: any,
  ) {
    const { forRoutes } = config;
    for (const routeInfo of forRoutes) {
      await this.registerRouteMiddleware(
        HooksContainer,
        routeInfo as RouteInfo,
        config,
        moduleKey,
        applicationRef,
      );
    }
  }

  public async registerRouteMiddleware(
    HooksContainer: HooksContainer,
    routeInfo: RouteInfo,
    config: MiddlewareConfiguration,
    moduleKey: string,
    applicationRef: any,
  ) {
    const middlewareCollection = [].concat(config.middleware);
    const moduleRef = this.container.getModuleByKey(moduleKey)!;

    for (const metatype of middlewareCollection) {
      const collection = HooksContainer.getMiddlewareCollection(moduleKey);
      const instanceWrapper = collection.get(metatype);

      if (isUndefined(instanceWrapper)) {
        throw new RuntimeException();
      }
      if (instanceWrapper.isTransient) {
        return;
      }

      this.graphInspector.insertClassNode(
        moduleRef,
        instanceWrapper,
        'middleware',
      );
      const middlewareDefinition: Entrypoint<MiddlewareEntrypointMetadata> = {
        type: 'middleware',
        methodName: 'use',
        className: instanceWrapper.name,
        classNodeId: instanceWrapper.id,
        metadata: {
          key: routeInfo.path,
          path: routeInfo.path,
          requestMethod:
            (RequestMethod[routeInfo.method] as keyof typeof RequestMethod) ??
            'ALL',
          version: routeInfo.version,
        },
      };
      this.graphInspector.insertEntrypointDefinition(
        middlewareDefinition,
        instanceWrapper.id,
      );

      await this.bindHandler(
        instanceWrapper,
        applicationRef,
        routeInfo,
        moduleRef,
        collection,
      );
    }
  }

  // #CUSTOM
  private async bindHandler(
    wrapper: InstanceWrapper<Hook>,
    applicationRef: HttpServer,
    routeInfo: RouteInfo,
    moduleRef: Module,
    collection: Map<InjectionToken, InstanceWrapper>,
  ) {
    const { instance, metatype } = wrapper;
    const hasAnyHookMethod = new Set(
      HookMethods.filter(method => !isUndefined(instance?.[method])),
    );

    if (!hasAnyHookMethod.size) {
      throw new InvalidHookException(metatype!.name);
    }

    const isStatic = wrapper.isDependencyTreeStatic();
    if (isStatic) {
      for (const method of hasAnyHookMethod) {
        const proxy = await this.createProxy(instance, method);
        this.registerHandler(applicationRef, routeInfo, method, proxy);
      }
      return;
    }
    const isTreeDurable = wrapper.isDependencyTreeDurable();

    for (const method of hasAnyHookMethod) {
      await this.registerHandler(
        applicationRef,
        routeInfo,
        method,
        async <TRequest, TResponse>(
          req: TRequest,
          res: TResponse,
          next: VoidFunction,
          ...rest: any
        ) => {
          try {
            const contextId = this.getContextId(req, isTreeDurable);
            const contextInstance = await this.injector.loadPerContext(
              instance,
              moduleRef,
              collection,
              contextId,
            );
            const proxy = await this.createProxy<TRequest, TResponse>(
              contextInstance,
              method,
              contextId,
            );
            return proxy(req, res, next, ...rest);
          } catch (err) {
            let exceptionsHandler = this.exceptionFiltersCache.get(
              instance[method]!,
            );
            if (!exceptionsHandler) {
              exceptionsHandler = this.routerExceptionFilter.create(
                instance,
                instance[method] as any,
                undefined,
              );
              this.exceptionFiltersCache.set(
                instance[method]!,
                exceptionsHandler,
              );
            }
            const host = new ExecutionContextHost([req, res]);
            exceptionsHandler.next(err, host);
          }
        },
      );
    }
  }

  // #CUSTOM
  private async createProxy<TRequest = unknown, TResponse = unknown>(
    instance: Hook,
    method: string,
    contextId = STATIC_CONTEXT,
  ): Promise<
    (
      req: TRequest,
      res: TResponse,
      next: VoidFunction,
      ...rest: any
    ) => Promise<void>
  > {
    const exceptionsHandler = this.routerExceptionFilter.create(
      instance,
      instance[method as keyof Hook] as any,
      undefined,
      contextId,
    );
    const middleware = instance[method as keyof Hook]!.bind(instance) as any;
    return this.routerProxy.createProxy(middleware, exceptionsHandler) as any;
  }

  private async registerHandler(
    applicationRef: HttpServer,
    routeInfo: RouteInfo,
    hookName: string,
    proxy: <TRequest, TResponse>(
      req: TRequest,
      res: TResponse,
      next: VoidFunction,
      ...rest: any
    ) => void,
  ): Promise<void> {
    const { method } = routeInfo;
    const paths = this.routeInfoPathExtractor.extractPathsFrom(routeInfo);
    const isMethodAll = isRequestMethodAll(method);
    const requestMethod = RequestMethod[method];
    const router = await applicationRef.createMiddlewareFactory(method);
    const middlewareFunction = isMethodAll
      ? proxy
      : async <TRequest, TResponse>(
          req: TRequest,
          res: TResponse,
          next: VoidFunction,
          ...rest: any
        ) => {
          if (applicationRef.getRequestMethod?.(req) === requestMethod) {
            return await proxy(req, res, next, ...rest);
          }
          return Promise.resolve();
        };
    const pathsToApplyMiddleware = [] as string[];
    paths.some(path => path.match(/^\/?$/))
      ? pathsToApplyMiddleware.push('/')
      : pathsToApplyMiddleware.push(...paths);
    pathsToApplyMiddleware.forEach(path =>
      (router as any)(path, middlewareFunction, hookName),
    );
  }

  private getContextId(request: unknown, isTreeDurable: boolean): ContextId {
    const contextId = ContextIdFactory.getByRequest(request as object);
    if (!request![REQUEST_CONTEXT_ID as keyof object]) {
      Object.defineProperty(request, REQUEST_CONTEXT_ID, {
        value: contextId,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      const requestProviderValue = isTreeDurable
        ? contextId.payload
        : Object.assign(request as object, contextId.payload);
      this.container.registerRequestProvider(requestProviderValue, contextId);
    }
    return contextId;
  }
}

export class InvalidHookException extends RuntimeException {
  constructor(hook: string) {
    super(`Invalid hook "${hook}"`);
  }
}
