/**
 * The main entry point for the Nuvix Platform application.
 * @author Nuvix-Tech
 * @version 1.0
 * @beta
 */
import { NuvixAdapter, NuvixFactory } from '@nuvix/core/server';
import { AppModule } from './app.module';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { config } from 'dotenv';
import {
  ConsoleLogger,
  Logger,
  LogLevel,
  ValidationPipe,
} from '@nestjs/common';
import {
  configuration,
  PROJECT_ROOT,
  validateRequiredConfig,
} from '@nuvix/utils';
import { Authorization, Role, storage } from '@nuvix/db';
import cookieParser from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import QueryString from 'qs';
import path from 'path';
import { initSetup } from './utils/initial-setup';
import { ErrorFilter } from '@nuvix/core/filters';
import { AppConfigService } from '@nuvix/core';
import { Auth } from '@nuvix/core/helper/auth.helper.js';

config({
  path: [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.platform'),
  ],
});

validateRequiredConfig();
Authorization.enableAsyncLocalStorage();

/**
 * Bootstraps and starts the Nuvix Platform Nest/Fastify application.
 *
 * Performs full runtime initialization: creates a NuvixAdapter and Nest application with a console logger, registers cookie and multipart handlers, enables shutdown hooks, applies a global ValidationPipe and global error filter, configures static asset serving and per-request hooks (response headers and per-request async storage/authorization defaults), registers SIGINT/SIGTERM handlers for graceful shutdown logging, runs platform-specific setup, and starts listening on the configured host and port.
 *
 * @returns A promise that resolves when the application has finished starting and is listening for requests.
 */
async function bootstrap() {
  const adapter = new NuvixAdapter({
    trustProxy: true,
    skipMiddie: true,
    maxParamLength: 350,
    querystringParser(str) {
      return QueryString.parse(str);
    },
    logger: {
      enabled: true,
      edgeLimit: 100,
      msgPrefix: '[Nuvix-Platform] ',
      safe: true,
      level: 'error',
    },
  });

  const app = await NuvixFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    {
      abortOnError: false,
      logger: new ConsoleLogger({
        json: configuration.app.debug.json,
        colors: configuration.app.debug.colors,
        prefix: 'Nuvix-Console',
        logLevels: configuration.app.isProduction
          ? (configuration.logLevels as LogLevel[])
          : undefined,
      }),
      autoFlushLogs: true,
    },
  );

  // @ts-ignore
  app.register(cookieParser);
  // @ts-ignore
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      stopAtFirstError: true,
      transform: true,
      transformOptions: {
        exposeDefaultValues: true,
      },
      whitelist: true,
    }),
  );

  const fastify = adapter.getInstance();
  const config = app.get(AppConfigService);

  fastify.addHook('onRequest', (req, res, done) => {
    res.header('X-Powered-By', 'Nuvix-Server');
    res.header('Server', 'Nuvix');
    done();
  });

  app.useStaticAssets({
    root: PROJECT_ROOT + '/public',
    prefix: '/public/',
  });

  fastify.addHook('onRequest', (_, __, done) => {
    storage.run(new Map(), () => {
      Authorization.setDefaultStatus(true); // Set per-request default status
      Authorization.cleanRoles(); // Reset roles per request
      Authorization.setRole(Role.any().toString());
      Auth.setPlatformActor(false);
      Auth.setTrustedActor(false);
      done();
    });
  });

  process.on('SIGINT', () => {
    Logger.warn('SIGINT received, shutting down gracefully...');
  });
  process.on('SIGTERM', () => {
    Logger.warn('SIGTERM received, shutting down gracefully...');
  });

  app.useGlobalFilters(new ErrorFilter(config));
  await initSetup(app, config as AppConfigService);

  const port = parseInt(config.root.get('APP_PLATFORM_PORT', '4100'), 10);
  const host = '0.0.0.0';
  await app.listen(port, host);

  Logger.log(
    `🚀 Platform API application is running on: http://${host}:${port}`,
    'Nuvix-Platform',
  );
}
bootstrap();
