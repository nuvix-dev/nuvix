import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'

export function openApiSetup(app: NestFastifyApplication) {
  const config = new DocumentBuilder()
    .setTitle('Nuvix API')
    .setDescription('A powerful Backend for your next project')
    .setVersion('1.0')
    .addTag('nuvix')
    .addGlobalParameters({
      name: 'X-Nuvix-Project',
      in: 'header',
      required: true,
      description: 'Project ID.',
      schema: {
        type: 'string',
      },
    })
    .addCookieAuth('session')
    .addGlobalResponse({
      status: '5XX',
      description: 'Internal server error',
      schema: {
        type: 'object',
        properties: {
          code: {
            type: 'number',
            description: 'Error code',
          },
          type: {
            type: 'string',
            description: 'Error type',
          },
          message: {
            type: 'string',
            description: 'Error message',
          },
          version: {
            type: 'string',
            description: 'API version',
          },
        },
        required: ['code', 'type', 'message', 'version'],
      },
    })
    .build()

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      deepScanRoutes: true,
    })
  SwaggerModule.setup('api', app, documentFactory, {
    raw: true,
    ui: false,
  })

  // TODO: ---------
  app.getHttpAdapter().get('/reference', (req, res) => {
    apiReference({
      content: documentFactory(),
      withFastify: true,
    })(req as any, res.raw as any)
  })
}
