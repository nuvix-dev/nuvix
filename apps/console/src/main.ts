/**
 * The main entry point for the Nuvix Console application.
 * @author Nuvix-Tech
 * @version 1.0
 * @beta
 */
import { NuvixAdapter, NuvixFactory } from '@nuvix/core/server';
import { ConsoleModule } from './console.module';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { config } from 'dotenv';
import { HttpExceptionFilter } from '@nuvix/core/filters/http-exception.filter';
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
} from '@nuvix/utils/constants';
import { Authorization, Role, storage } from '@nuvix/database';
import { ErrorFilter } from '@nuvix/core/filters/globle-error.filter';
import cookieParser from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import QueryString from 'qs';
import path from 'path';

config({
  path: [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.console'),
  ],
});

Authorization.enableStorage();

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
      msgPrefix: '[Nuvix-Console] ',
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
    ConsoleModule,
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

  fastify.addHook('onRequest', (req, res, done) => {
    res.header('X-Powered-By', 'Nuvix-Server');
    res.header('Server', 'Nuvix');
    done();
  });

  app.useStaticAssets({
    root: PROJECT_ROOT + '/public',
    prefix: '/public/',
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

  app.useGlobalFilters(new HttpExceptionFilter(), new ErrorFilter());

  const port = parseInt(process.env.APP_CONSOLE_PORT, 10) || 4100;
  const host = '0.0.0.0';
  await app.listen(port, host);

  Logger.log(
    `🚀 Console API application is running on: http://${host}:${port}`,
    'Bootstrap',
  );
}
bootstrap();
