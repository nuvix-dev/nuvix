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
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import {
  APP_DEBUG_COLORS,
  APP_DEBUG_FORMAT,
  PROJECT_ROOT,
  SERVER_CONFIG,
} from '@nuvix/utils/constants';
import { Authorization, Role, storage } from '@nuvix/database';
import { ErrorFilter } from '@nuvix/core/filters/globle-error.filter';
import cookieParser from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import QueryString from 'qs';

config();
Authorization.enableStorage();

async function bootstrap() {
  const app = await NuvixFactory.create<NestFastifyApplication>(
    ConsoleModule,
    new NuvixAdapter({
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
      },
    }),
    {
      abortOnError: false,
      logger: new ConsoleLogger({
        json: APP_DEBUG_FORMAT,
        colors: APP_DEBUG_COLORS,
        prefix: 'Nuvix-Console',
      }),
      autoFlushLogs: true,
    },
  );

  app.enableShutdownHooks();
  // @ts-ignore
  app.register(cookieParser);
  // @ts-ignore
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
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
    root: PROJECT_ROOT + 'public',
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

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  app.useGlobalFilters(new HttpExceptionFilter(), new ErrorFilter());
  await app.listen(process.env.PORT ?? 3000, '127.0.0.1');
}
bootstrap();
