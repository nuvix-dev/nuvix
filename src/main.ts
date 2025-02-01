import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config } from 'dotenv';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { NextFunction, Request, Response } from 'express';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { Exception } from './core/extend/exception';
const cookieParser = require('cookie-parser');

config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: false,
    logger: new ConsoleLogger({
      json: process.env.NODE_ENV === 'production',
      colors: process.env.NODE_ENV !== 'production',
      prefix: 'Nuvix',
    }),
  });

  app.set('query parser', 'extended');

  app.enableVersioning();

  app.useGlobalPipes(
    new ValidationPipe({
      enableDebugMessages: true,
      stopAtFirstError: false,
      // transform: true,
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
    origin: [...(process.env.CORS_ORIGIN ?? '').split(',')],
    methods: 'GET,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-HTTP-Method-Override',
      'Accept',
      'X-Nuvix-Project',
      'X-Nuvix-Key',
      'X-Nuvix-Locale',
      'X-Nuvix-Mode',
      'X-Nuvix-JWT',
      'X-Nuvix-Response-Format',
      'X-Nuvix-Timeout',
      'x-sdk-language',
      'x-sdk-name',
      'x-sdk-platform',
      'x-sdk-version',
      'x-fallback-cookies',
      'x-nuvix-session',
      ...(process.env.CORS_HEADERS ?? '').split(','),
    ],
    exposedHeaders: ['X-Nuvix-Session', 'X-Fallback-Cookies'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
