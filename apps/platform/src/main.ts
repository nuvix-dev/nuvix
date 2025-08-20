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
  APP_DEBUG_COLORS,
  APP_DEBUG_FORMAT,
  IS_PRODUCTION,
  LOG_LEVELS,
  PROJECT_ROOT,
  SERVER_CONFIG,
} from '@nuvix/utils';
import { Authorization, Role, storage } from '@nuvix-tech/db';
import cookieParser from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import QueryString from 'qs';
import path from 'path';
import { initSetup } from './utils/initial-setup';
import { ErrorFilter } from '@nuvix/core/filters';
import { AppConfigService } from '@nuvix/core';

config({
  path: [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.console'),
  ],
});

Authorization.enableAsyncLocalStorage();

async function bootstrap() {
  const adapter = new NuvixAdapter({
    trustProxy: true,
    skipMiddie: true,
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

  adapter.enableCors({
    origin: SERVER_CONFIG.allowedOrigins,
    methods: SERVER_CONFIG.methods,
    allowedHeaders: SERVER_CONFIG.allowedHeaders,
    exposedHeaders: SERVER_CONFIG.exposedHeaders,
    maxAge: SERVER_CONFIG.maxAge,
    credentials: SERVER_CONFIG.credentials,
    preflightContinue: false,
  });

  // @ts-ignore
  adapter.register(cookieParser);
  // @ts-ignore
  adapter.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  const app = await NuvixFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    {
      abortOnError: false,
      logger: new ConsoleLogger({
        json: APP_DEBUG_FORMAT,
        colors: APP_DEBUG_COLORS,
        prefix: 'Nuvix-Console',
        logLevels: IS_PRODUCTION
          ? (Object.keys(LOG_LEVELS) as LogLevel[])
          : undefined,
      }),
      autoFlushLogs: true,
    },
  );

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
  await initSetup(config as AppConfigService);

  const port = parseInt(config.root.get('APP_PLATFORM_PORT', '4100'), 10);
  const host = '0.0.0.0';
  await app.listen(port, host);

  Logger.log(
    `🚀 Platform API application is running on: http://${host}:${port}`,
    'Nuvix-Platform',
  );
}
bootstrap();
