import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config } from 'dotenv'
import { HttpExceptionFilter } from './core/filters/http-exception.filter';

config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use((req, res, next) => {
    res.header('X-Powered-By', 'Nuvix-Server');
    res.header('Server', 'Nuvix');
    next();
  });

  app.enableCors({
    origin: ['https://www.merabestie.com', 'http://localhost:3000', "https://nuvix-console.vercel.app", "*"],
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-HTTP-Method-Override', 'Accept'],
  })

  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
