/**
 * Nuvix is a Backend as a Service (BaaS) that allows you to create a backend for your application in minutes.
 * This file is the entry point of the application, where the application is created and started.
 * @author Ravikant Saini
 * @version 1.0
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config } from 'dotenv';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { NextFunction, Request, Response } from 'express';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { APP_DEBUG_COLORS } from './Utils/constants';
const cookieParser = require('cookie-parser');

config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: false,
    logger: new ConsoleLogger({
      json: process.env.NODE_ENV === 'production',
      colors: APP_DEBUG_COLORS,
      prefix: 'Nuvix',
    }),
  });

  app.set('query parser', 'extended');

  app.enableVersioning();

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

  app.use(cookieParser());

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('X-Powered-By', 'Nuvix-Server');
    res.header('Server', 'Nuvix');
    next();
  });

  app.enableCors({
    origin: [
      ...(process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map((origin) => origin.trim()),
    ],
    methods: 'GET,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Content-Length',
      'Authorization',
      'X-Requested-With',
      'X-HTTP-Method-Override',
      'Accept',
      'range',
      'X-Nuvix-Project',
      'X-Nuvix-Key',
      'X-Nuvix-Locale',
      'X-Nuvix-Mode',
      'X-Nuvix-JWT',
      'X-Nuvix-id',
      'X-Nuvix-Response-Format',
      'X-Nuvix-Timeout',
      'x-sdk-language',
      'x-sdk-name',
      'x-sdk-platform',
      'x-sdk-version',
      'content-range',
      'x-fallback-cookies',
      'x-nuvix-session',
      ...(process.env.CORS_HEADERS ?? '')
        .split(',')
        .map((header) => header.trim()),
    ],
    exposedHeaders: ['X-Nuvix-Session', 'X-Fallback-Cookies'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
