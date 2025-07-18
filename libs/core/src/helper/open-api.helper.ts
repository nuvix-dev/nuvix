import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export function openApiSetup(app: NestFastifyApplication) {
  const config = new DocumentBuilder()
    .setTitle('Nuvix API')
    .setDescription('A powerful BaaS for your next project')
    .setVersion('1.0')
    .addTag('nuvix')
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      deepScanRoutes: true,
    });
  SwaggerModule.setup('api', app, documentFactory, {
    swaggerUiEnabled: true,
    raw: ['json'],
  });

  // TODO: ---------
  app.getHttpAdapter().get('/reference', (req, res) => {
    apiReference({
      content: documentFactory(),
      withFastify: true,
    })(req as any, res.raw as any);
  });
}
