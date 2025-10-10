import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

export function openApiSetup(app: NestFastifyApplication) {
  const config = new DocumentBuilder()
    .setTitle('Nuvix Platform')
    .setDescription('The platform to manage your Nuvix projects')
    .setVersion('1.0')
    .addTag('nuvix', 'platform')
    .addGlobalParameters({
      name: 'X-Nuvix-Project',
      in: 'header',
      required: false,
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
    ui: false,
  })
}
