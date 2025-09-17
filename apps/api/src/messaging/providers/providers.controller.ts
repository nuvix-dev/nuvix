import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards';
import {
  ApiInterceptor,
  ResponseInterceptor,
} from '@nuvix/core/resolvers/interceptors';
import {
  AuditEvent,
  ProjectDatabase,
  AuthType,
  Namespace,
  ResModel,
  Scope,
  Sdk,
  Auth,
} from '@nuvix/core/decorators';
import { Models } from '@nuvix/core/helper';

import {
  CreateMailgunProviderDTO,
  UpdateMailgunProviderDTO,
} from './DTO/mailgun.dto';
import { Database, Query as Queries } from '@nuvix-tech/db';
import {
  CreateSendgridProviderDTO,
  UpdateSendgridProviderDTO,
} from './DTO/sendgrid.dto';
import { CreateSMTPProviderDTO, UpdateSMTPProviderDTO } from './DTO/smtp.dto';
import {
  CreateMsg91ProviderDTO,
  UpdateMsg91ProviderDTO,
} from './DTO/msg91.dto';
import {
  CreateTwilioProviderDTO,
  UpdateTwilioProviderDTO,
} from './DTO/twilio.dto';
import {
  CreateTelesignProviderDTO,
  UpdateTelesignProviderDTO,
} from './DTO/telesign.dto';
import {
  CreateTextmagicProviderDTO,
  UpdateTextmagicProviderDTO,
} from './DTO/textmagic.dto';
import {
  CreateVonageProviderDTO,
  UpdateVonageProviderDTO,
} from './DTO/vonage.dto';
import { CreateFcmProviderDTO, UpdateFcmProviderDTO } from './DTO/fcm.dto';
import { CreateApnsProviderDTO, UpdateApnsProviderDTO } from './DTO/apns.dto';
import { ProvidersQueryPipe } from '@nuvix/core/pipes/queries';

@Namespace('messaging')
@UseGuards(ProjectGuard)
@Auth([AuthType.ADMIN, AuthType.KEY])
@Controller({ path: 'messaging/providers', version: ['1'] })
@UseInterceptors(ApiInterceptor, ResponseInterceptor)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post('mailgun')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createMailgunProvider',
    code: HttpStatus.CREATED,
    description: 'Create a Mailgun provider',
  })
  async createMailgunProvider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateMailgunProviderDTO,
  ) {
    return this.providersService.createMailgunProvider({
      db,
      input,
    });
  }

  @Post('sendgrid')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createSendgridProvider',
    code: HttpStatus.CREATED,
    description: 'Create a Sendgrid provider',
  })
  async createSendgridProvider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateSendgridProviderDTO,
  ) {
    return this.providersService.createSendGridProvider({
      db,
      input,
    });
  }

  @Post('smtp')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createSmtpProvider',
    code: HttpStatus.CREATED,
    description: 'Create a SMTP provider',
  })
  async createSMTPProvider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateSMTPProviderDTO,
  ) {
    return this.providersService.createSmtpProvider({
      db,
      input,
    });
  }

  @Post('msg91')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createMsg91Provider',
    code: HttpStatus.CREATED,
    description: 'Create a Msg91 provider',
  })
  async createMsg91Provider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateMsg91ProviderDTO,
  ) {
    return this.providersService.createMsg91Provider({
      db,
      input,
    });
  }

  @Post('telesign')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createTelesignProvider',
    code: HttpStatus.CREATED,
    description: 'Create a Telesign provider',
  })
  async createTelesignProvider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateTelesignProviderDTO,
  ) {
    return this.providersService.createTelesignProvider({
      db,
      input,
    });
  }

  @Post('textmagic')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createTextmagicProvider',
    code: HttpStatus.CREATED,
    description: 'Create a Textmagic provider',
  })
  async createTextmagicProvider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateTextmagicProviderDTO,
  ) {
    return this.providersService.createTextMagicProvider({
      db,
      input,
    });
  }

  @Post('twilio')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createTwilioProvider',
    code: HttpStatus.CREATED,
    description: 'Create a Twilio provider',
  })
  async createTwilioProvider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateTwilioProviderDTO,
  ) {
    return this.providersService.createTwilioProvider({
      db,
      input,
    });
  }

  @Post('vonage')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createVonageProvider',
    code: HttpStatus.CREATED,
    description: 'Create a Vonage provider',
  })
  async createVonageProvider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateVonageProviderDTO,
  ) {
    return this.providersService.createVonageProvider({
      db,
      input,
    });
  }

  @Post('fcm')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createFcmProvider',
    code: HttpStatus.CREATED,
    description: 'Create a FCM provider',
  })
  async createFcmProvider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateFcmProviderDTO,
  ) {
    return this.providersService.createFcmProvider({
      db,
      input,
    });
  }

  @Post('apns')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createApnsProvider',
    code: HttpStatus.CREATED,
    description: 'Create a APNs provider',
  })
  async createApnsProvider(
    @ProjectDatabase() db: Database,
    @Body() input: CreateApnsProviderDTO,
  ) {
    return this.providersService.createApnsProvider({
      db,
      input,
    });
  }

  @Get()
  @Scope('providers.read')
  @ResModel(Models.PROVIDER, { list: true })
  @Sdk({
    name: 'listProviders',
    code: HttpStatus.OK,
    description: 'List all providers',
  })
  async listProviders(
    @ProjectDatabase() db: Database,
    @Query('queries', ProvidersQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return this.providersService.listProviders({
      db,
      queries,
      search,
    });
  }

  @Get(':providerId')
  @Scope('providers.read')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'getProvider',
    code: HttpStatus.OK,
    description: 'Get provider',
  })
  async getProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
  ) {
    return this.providersService.getProvider(db, providerId);
  }

  @Patch('mailgun/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateMailgunProvider',
    code: HttpStatus.OK,
    description: 'Update Mailgun provider',
  })
  async updateMailgunProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateMailgunProviderDTO,
  ) {
    return this.providersService.updateMailgunProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('sendgrid/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateSendgridProvider',
    code: HttpStatus.OK,
    description: 'Update Sendgrid provider',
  })
  async updateSendgridProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateSendgridProviderDTO,
  ) {
    return this.providersService.updateSendGridProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('smtp/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateSmtpProvider',
    code: HttpStatus.OK,
    description: 'Update SMTP provider',
  })
  async updateSmtpProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateSMTPProviderDTO,
  ) {
    return this.providersService.updateSmtpProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('msg91/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateMsg91Provider',
    code: HttpStatus.OK,
    description: 'Update Msg91 provider',
  })
  async updateMsg91Provider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateMsg91ProviderDTO,
  ) {
    return this.providersService.updateMsg91Provider({
      db,
      providerId,
      input,
    });
  }

  @Patch('telesign/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateTelesignProvider',
    code: HttpStatus.OK,
    description: 'Update Telesign provider',
  })
  async updateTelesignProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateTelesignProviderDTO,
  ) {
    return this.providersService.updateTelesignProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('textmagic/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateTextmagicProvider',
    code: HttpStatus.OK,
    description: 'Update Textmagic provider',
  })
  async updateTextmagicProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateTextmagicProviderDTO,
  ) {
    return this.providersService.updateTextMagicProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('twilio/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateTwilioProvider',
    code: HttpStatus.OK,
    description: 'Update Twilio provider',
  })
  async updateTwilioProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateTwilioProviderDTO,
  ) {
    return this.providersService.updateTwilioProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('vonage/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateVonageProvider',
    code: HttpStatus.OK,
    description: 'Update Vonage provider',
  })
  async updateVonageProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateVonageProviderDTO,
  ) {
    return this.providersService.updateVonageProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('fcm/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateFcmProvider',
    code: HttpStatus.OK,
    description: 'Update FCM provider',
  })
  async updateFcmProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateFcmProviderDTO,
  ) {
    return this.providersService.updateFcmProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('apns/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateApnsProvider',
    code: HttpStatus.OK,
    description: 'Update APNs provider',
  })
  async updateApnsProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
    @Body() input: UpdateApnsProviderDTO,
  ) {
    return this.providersService.updateApnsProvider({
      db,
      providerId,
      input,
    });
  }

  @Delete(':providerId')
  @Scope('providers.delete')
  @AuditEvent('provider.delete', 'provider/{params.providerId}')
  @ResModel(Models.NONE)
  @Sdk({
    name: 'deleteProvider',
    code: HttpStatus.NO_CONTENT,
    description: 'Delete provider',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(
    @Param('providerId') providerId: string,
    @ProjectDatabase() db: Database,
  ) {
    return this.providersService.deleteProvider(db, providerId);
  }
}
