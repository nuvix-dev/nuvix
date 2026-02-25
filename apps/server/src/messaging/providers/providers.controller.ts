import {
  Body,
  Controller,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import {
  Auth,
  AuthType,
  Namespace,
  ProjectDatabase,
  QueryFilter,
  QuerySearch,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { ProvidersQueryPipe } from '@nuvix/core/pipes/queries'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import { Database, Query as Queries } from '@nuvix/db'
import { IListResponse, IResponse } from '@nuvix/utils'
import { ProvidersDoc } from '@nuvix/utils/types'
import { CreateApnsProviderDTO, UpdateApnsProviderDTO } from './DTO/apns.dto'
import { ProviderParamsDTO } from './DTO/base.dto'
import { CreateFcmProviderDTO, UpdateFcmProviderDTO } from './DTO/fcm.dto'
import {
  CreateMailgunProviderDTO,
  UpdateMailgunProviderDTO,
} from './DTO/mailgun.dto'
import { CreateMsg91ProviderDTO, UpdateMsg91ProviderDTO } from './DTO/msg91.dto'
import {
  CreateSendgridProviderDTO,
  UpdateSendgridProviderDTO,
} from './DTO/sendgrid.dto'
import { CreateSMTPProviderDTO, UpdateSMTPProviderDTO } from './DTO/smtp.dto'
import {
  CreateTelesignProviderDTO,
  UpdateTelesignProviderDTO,
} from './DTO/telesign.dto'
import {
  CreateTextmagicProviderDTO,
  UpdateTextmagicProviderDTO,
} from './DTO/textmagic.dto'
import {
  CreateTwilioProviderDTO,
  UpdateTwilioProviderDTO,
} from './DTO/twilio.dto'
import {
  CreateVonageProviderDTO,
  UpdateVonageProviderDTO,
} from './DTO/vonage.dto'
import { ProvidersService } from './providers.service'

@Namespace('messaging')
@UseGuards(ProjectGuard)
@Auth([AuthType.ADMIN, AuthType.KEY])
@Controller({ path: 'messaging/providers', version: ['1'] })
@UseInterceptors(ApiInterceptor, ResponseInterceptor)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post('mailgun', {
    summary: 'Create Mailgun provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createMailgunProvider',
      descMd: '/docs/references/messaging/create-mailgun-provider.md',
    },
  })
  async createMailgunProvider(
    @Body() input: CreateMailgunProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createMailgunProvider({
      db,
      input,
    })
  }

  @Post('sendgrid', {
    summary: 'Create Sendgrid provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createSendgridProvider',
      descMd: '/docs/references/messaging/create-sendgrid-provider.md',
    },
  })
  async createSendgridProvider(
    @Body() input: CreateSendgridProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createSendGridProvider({
      db,
      input,
    })
  }

  @Post('smtp', {
    summary: 'Create SMTP provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createSmtpProvider',
      descMd: '/docs/references/messaging/create-smtp-provider.md',
    },
  })
  async createSMTPProvider(
    @Body() input: CreateSMTPProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createSmtpProvider({
      db,
      input,
    })
  }

  @Post('msg91', {
    summary: 'Create Msg91 provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createMsg91Provider',
      descMd: '/docs/references/messaging/create-msg91-provider.md',
    },
  })
  async createMsg91Provider(
    @Body() input: CreateMsg91ProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createMsg91Provider({
      db,
      input,
    })
  }

  @Post('telesign', {
    summary: 'Create Telesign provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createTelesignProvider',
      descMd: '/docs/references/messaging/create-telesign-provider.md',
    },
  })
  async createTelesignProvider(
    @Body() input: CreateTelesignProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createTelesignProvider({
      db,
      input,
    })
  }

  @Post('textmagic', {
    summary: 'Create Textmagic provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createTextmagicProvider',
      descMd: '/docs/references/messaging/create-textmagic-provider.md',
    },
  })
  async createTextmagicProvider(
    @Body() input: CreateTextmagicProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createTextMagicProvider({
      db,
      input,
    })
  }

  @Post('twilio', {
    summary: 'Create Twilio provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createTwilioProvider',
      descMd: '/docs/references/messaging/create-twilio-provider.md',
    },
  })
  async createTwilioProvider(
    @Body() input: CreateTwilioProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createTwilioProvider({
      db,
      input,
    })
  }

  @Post('vonage', {
    summary: 'Create Vonage provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createVonageProvider',
      descMd: '/docs/references/messaging/create-vonage-provider.md',
    },
  })
  async createVonageProvider(
    @Body() input: CreateVonageProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createVonageProvider({
      db,
      input,
    })
  }

  @Post('fcm', {
    summary: 'Create FCM provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createFcmProvider',
      descMd: '/docs/references/messaging/create-fcm-provider.md',
    },
  })
  async createFcmProvider(
    @Body() input: CreateFcmProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createFcmProvider({
      db,
      input,
    })
  }

  @Post('apns', {
    summary: 'Create APNS provider',
    scopes: 'providers.create',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.create',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'createApnsProvider',
      descMd: '/docs/references/messaging/create-apns-provider.md',
    },
  })
  async createApnsProvider(
    @Body() input: CreateApnsProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.createApnsProvider({
      db,
      input,
    })
  }

  @Get('', {
    summary: 'List providers',
    scopes: 'providers.read',
    model: { type: Models.PROVIDER, list: true },
    sdk: {
      name: 'listProviders',
      descMd: '/docs/references/messaging/list-providers.md',
    },
  })
  async listProviders(
    @QueryFilter(ProvidersQueryPipe) queries: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<ProvidersDoc>> {
    return this.providersService.listProviders({
      db,
      queries,
      search,
    })
  }

  @Get(':providerId', {
    summary: 'Get provider',
    scopes: 'providers.read',
    model: Models.PROVIDER,
    sdk: {
      name: 'getProvider',
      descMd: '/docs/references/messaging/get-provider.md',
    },
  })
  async getProvider(
    @Param() { providerId }: ProviderParamsDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.getProvider(db, providerId)
  }

  @Patch('mailgun/:providerId', {
    summary: 'Update Mailgun provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateMailgunProvider',
      descMd: '/docs/references/messaging/update-mailgun-provider.md',
    },
  })
  async updateMailgunProvider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateMailgunProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateMailgunProvider({
      db,
      providerId,
      input,
    })
  }

  @Patch('sendgrid/:providerId', {
    summary: 'Update Sendgrid provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateSendgridProvider',
      descMd: '/docs/references/messaging/update-sendgrid-provider.md',
    },
  })
  async updateSendgridProvider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateSendgridProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateSendGridProvider({
      db,
      providerId,
      input,
    })
  }

  @Patch('smtp/:providerId', {
    summary: 'Update SMTP provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateSmtpProvider',
      descMd: '/docs/references/messaging/update-smtp-provider.md',
    },
  })
  async updateSmtpProvider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateSMTPProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateSmtpProvider({
      db,
      providerId,
      input,
    })
  }

  @Patch('msg91/:providerId', {
    summary: 'Update Msg91 provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateMsg91Provider',
      descMd: '/docs/references/messaging/update-msg91-provider.md',
    },
  })
  async updateMsg91Provider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateMsg91ProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateMsg91Provider({
      db,
      providerId,
      input,
    })
  }

  @Patch('telesign/:providerId', {
    summary: 'Update Telesign provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateTelesignProvider',
      descMd: '/docs/references/messaging/update-telesign-provider.md',
    },
  })
  async updateTelesignProvider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateTelesignProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateTelesignProvider({
      db,
      providerId,
      input,
    })
  }

  @Patch('textmagic/:providerId', {
    summary: 'Update Textmagic provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateTextmagicProvider',
      descMd: '/docs/references/messaging/update-textmagic-provider.md',
    },
  })
  async updateTextmagicProvider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateTextmagicProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateTextMagicProvider({
      db,
      providerId,
      input,
    })
  }

  @Patch('twilio/:providerId', {
    summary: 'Update Twilio provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateTwilioProvider',
      descMd: '/docs/references/messaging/update-twilio-provider.md',
    },
  })
  async updateTwilioProvider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateTwilioProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateTwilioProvider({
      db,
      providerId,
      input,
    })
  }

  @Patch('vonage/:providerId', {
    summary: 'Update Vonage provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateVonageProvider',
      descMd: '/docs/references/messaging/update-vonage-provider.md',
    },
  })
  async updateVonageProvider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateVonageProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateVonageProvider({
      db,
      providerId,
      input,
    })
  }

  @Patch('fcm/:providerId', {
    summary: 'Update FCM provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateFcmProvider',
      descMd: '/docs/references/messaging/update-fcm-provider.md',
    },
  })
  async updateFcmProvider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateFcmProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateFcmProvider({
      db,
      providerId,
      input,
    })
  }

  @Patch('apns/:providerId', {
    summary: 'Update APNS provider',
    scopes: 'providers.update',
    model: Models.PROVIDER,
    audit: {
      key: 'provider.update',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'updateApnsProvider',
      descMd: '/docs/references/messaging/update-apns-provider.md',
    },
  })
  async updateApnsProvider(
    @Param() { providerId }: ProviderParamsDTO,

    @Body() input: UpdateApnsProviderDTO,
  ): Promise<IResponse<ProvidersDoc>> {
    return this.providersService.updateApnsProvider({
      db,
      providerId,
      input,
    })
  }

  @Delete(':providerId', {
    summary: 'Delete provider',
    scopes: 'providers.delete',
    audit: {
      key: 'provider.delete',
      resource: 'provider/{res.$id}',
    },
    sdk: {
      name: 'deleteProvider',
      descMd: '/docs/references/messaging/delete-provider.md',
    },
  })
  async deleteProvider(
    @Param() { providerId }: ProviderParamsDTO,
  ): Promise<void> {
    return this.providersService.deleteProvider(db, providerId)
  }
}
