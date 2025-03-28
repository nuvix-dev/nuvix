/**
 * Nuvix is a Backend as a Service (BaaS) that allows you to create a backend for your application in minutes.
 * This file is the entry point of the application, where the application is created and started.
 * @author Nuvix-Tech
 * @version 1.0
 * @beta
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import cookieParser from '@fastify/cookie';
import { config } from 'dotenv';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { APP_DEBUG_COLORS, APP_DEBUG_FORMAT } from './Utils/constants';
import { Authorization, Role, storage } from '@nuvix/database';
import { ErrorFilter } from './core/filters/globle-error.filter';
import fastifyMultipart from '@fastify/multipart';

config();
Authorization.enableStorage();

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
      skipMiddie: true,
      logger: true,
    }),
    {
      abortOnError: false,
      logger: new ConsoleLogger({
        json: APP_DEBUG_FORMAT,
        colors: APP_DEBUG_COLORS,
        prefix: 'Nuvix',
      }),
    },
  );

  app.enableVersioning();
  app.register(cookieParser);
  app.register(fastifyMultipart);

  app.useGlobalPipes(
    new ValidationPipe({
      enableDebugMessages: true,
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
    root: __dirname + '../public',
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

  app.useGlobalFilters(new HttpExceptionFilter(), new ErrorFilter());
  await app.listen(process.env.PORT ?? 3000, '127.0.0.1');
}
bootstrap();
