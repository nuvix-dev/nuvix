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
import { APP_DEBUG_COLORS, APP_DEBUG_FORMAT } from './Utils/constants';
import { Authorization, Role, storage } from '@nuvix/database';
import cookieParser from 'cookie-parser';

config();
Authorization.enableStorage();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: false,
    logger: new ConsoleLogger({
      json: APP_DEBUG_FORMAT,
      colors: APP_DEBUG_COLORS,
      prefix: 'Nuvix',
    }),
  });

  app.set('query parser', 'extended');
  app.set('trust proxy', 'loopback');

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

  app.useStaticAssets('public');

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (Authorization['useStorage']) {
      storage.run(new Map(), () => {
        Authorization.setDefaultStatus(true); // Set per-request default status
        Authorization.cleanRoles(); // Reset roles per request
        Authorization.setRole(Role.any().toString());
        next();
      });
    } else {
      // Fallback to default static behavior
      Authorization.setDefaultStatus(true);
      Authorization.cleanRoles();
      Authorization.setRole(Role.any().toString());
      next();
    }
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
