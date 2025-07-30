/**
 * Nuvix is a Backend as a Service (BaaS) that allows you to create a backend for your application in minutes.
 * This file is the entry point of the application, where the application is created and started.
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
  APP_STORAGE_TEMP,
  IS_PRODUCTION,
  LOG_LEVELS,
  PROJECT_ROOT,
  SERVER_CONFIG,
} from '@nuvix/utils/constants';
import { Authorization, Role, storage } from '@nuvix/database';
import cookieParser from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { openApiSetup } from '@nuvix/core/helper';
import QueryString from 'qs';
import path from 'path';
import fs from 'fs/promises';
import metadata from './metadata';
import { SwaggerModule } from '@nestjs/swagger';
import { ErrorFilter } from '@nuvix/core/filters';

config({
  path: [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.api'),
  ],
});

Authorization.enableStorage();

async function bootstrap() {
  const app = await NuvixFactory.create<NestFastifyApplication>(
    AppModule,
    new NuvixAdapter({
      trustProxy: true,
      skipMiddie: true,
      querystringParser(str) {
        return QueryString.parse(str);
      },
      logger: {
        enabled: true,
        edgeLimit: 100,
        msgPrefix: '[Nuvix] ',
        safe: true,
      },
    }),
    {
      abortOnError: false,
      logger: new ConsoleLogger({
        json: APP_DEBUG_FORMAT,
        colors: APP_DEBUG_COLORS,
        prefix: 'Nuvix',
        logLevels: IS_PRODUCTION
          ? (Object.keys(LOG_LEVELS) as LogLevel[])
          : undefined,
      }),
    },
  );

  app.enableShutdownHooks();
  app.enableVersioning();
  // @ts-ignore
  app.register(cookieParser);
  // @ts-ignore
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
    attachFieldsToBody: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      stopAtFirstError: false,
      transform: true,
      transformOptions: {
        exposeDefaultValues: true,
      },
    }),
  );

  const fastify = app.getHttpAdapter().getInstance();

  fastify.addHook('onRequest', (req, res, done) => {
    res.header('X-Powered-By', 'Nuvix-Server');
    res.header('Server', 'Nuvix');
    done();
  });

  app.useStaticAssets({
    root: PROJECT_ROOT + '/public',
    prefix: '/public/',
  });

  app.enableCors({
    origin: SERVER_CONFIG.allowedOrigins,
    methods: SERVER_CONFIG.methods,
    allowedHeaders: SERVER_CONFIG.allowedHeaders,
    exposedHeaders: SERVER_CONFIG.exposedHeaders,
    maxAge: SERVER_CONFIG.maxAge,
    credentials: SERVER_CONFIG.credentials,
  });

  fastify.addHook('onRequest', (req, res, done) => {
    if (Authorization['useStorage']) {
      storage.run(new Map(), () => {
        Authorization.setDefaultStatus(true); // Set per-request default status
        Authorization.cleanRoles(); // Reset roles per request
        Authorization.setRole(Role.any().toString());
        done();
      });
    } else {
      // Fallback to default static behavior
      Authorization.setDefaultStatus(true);
      Authorization.cleanRoles();
      Authorization.setRole(Role.any().toString());
      done();
    }
  });
  fastify.decorateRequest('hooks_args', null);

  process.on('SIGINT', async () => {
    Logger.log('SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    Logger.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  app.useGlobalFilters(new ErrorFilter());
  await SwaggerModule.loadPluginMetadata(metadata);
  openApiSetup(app);

  // TODO: create a separate function to handle setup
  await fs.mkdir(APP_STORAGE_TEMP, { recursive: true }).catch(err => {
    if (err.code !== 'EEXIST') {
      Logger.error(
        `Failed to create temp storage directory: ${err.message}`,
        'Bootstrap',
      );
      process.exit(1);
    }
  });

  const port = parseInt(process.env.APP_API_PORT, 10) || 4000;
  const host = '0.0.0.0';
  await app.listen(port, host);

  Logger.log(
    `🚀 Nuvix API application is running on:  http://${host}:${port}`,
    'Bootstrap',
  );
}
bootstrap();
