import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors';
import {
  AuditEvent,
  AuthType,
  MessagingDatabase,
  Project,
  ResModel,
  Scope,
  Sdk,
} from '@nuvix/core/decorators';
import { Models } from '@nuvix/core/helper';
import { User } from '@nuvix/core/decorators/project-user.decorator';

import { CreateMailgunProviderDTO, UpdateMailgunProviderDTO } from './DTO/mailgun.dto';
import { Database, Query as Queries } from '@nuvix/database';
import { CreateSendgridProviderDTO, UpdateSendgridProviderDTO } from './DTO/sendgrid.dto';
import { CreateSMTPProviderDTO, UpdateSMTPProviderDTO } from './DTO/smtp.dto';
import { CreateMsg91ProviderDTO, UpdateMsg91ProviderDTO } from './DTO/msg91.dto';
import { CreateTwilioProviderDTO, UpdateTwilioProviderDTO } from './DTO/twilio.dto';
import { CreateTelesignProviderDTO, UpdateTelesignProviderDTO } from './DTO/telesign.dto';
import { CreateTextmagicProviderDTO, UpdateTextmagicProviderDTO } from './DTO/textmagic.dto';
import { CreateVonageProviderDTO, UpdateVonageProviderDTO } from './DTO/vonage.dto';
import { CreateFcmProviderDTO, UpdateFcmProviderDTO } from './DTO/fcm.dto';
import { CreateApnsProviderDTO, UpdateApnsProviderDTO } from './DTO/apns.dto';
import { ParseQueryPipe } from '@nuvix/core/pipes';

@Controller({ path: 'messaging', version: ['1'] })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) { }

  @Post('providers/mailgun')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createMailgunProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a Mailgun provider',
  })
  async createMailgunProvider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateMailgunProviderDTO,
  ) {
    return await this.messagingService.createMailgunProvider({
      db,
      input,
    });
  }

  @Post('providers/sendgrid')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createSendgridProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a Sendgrid provider',
  })
  async createSendgridProvider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateSendgridProviderDTO,
  ) {
    return await this.messagingService.createSendGridProvider({
      db,
      input,
    });
  }

  @Post('providers/smtp')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createSmtpProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a SMTP provider',
  })
  async createSMTPProvider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateSMTPProviderDTO,
  ) {
    return await this.messagingService.createSmtpProvider({
      db,
      input,
    });
  }

  @Post('providers/msg91')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createMsg91Provider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a Msg91 provider',
  })
  async createMsg91Provider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateMsg91ProviderDTO,
  ) {
    return await this.messagingService.createMsg91Provider({
      db,
      input,
    });
  }

  @Post('providers/telesign')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createTelesignProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a Telesign provider',
  })
  async createTelesignProvider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateTelesignProviderDTO,
  ) {
    return await this.messagingService.createTelesignProvider({
      db,
      input,
    });
  }

  @Post('providers/textmagic')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createTextmagicProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a Textmagic provider',
  })
  async createTextmagicProvider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateTextmagicProviderDTO,
  ) {
    return await this.messagingService.createTextMagicProvider({
      db,
      input,
    });
  }

  @Post('providers/twilio')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createTwilioProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a Twilio provider',
  })
  async createTwilioProvider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateTwilioProviderDTO,
  ) {
    return await this.messagingService.createTwilioProvider({
      db,
      input,
    });
  }

  @Post('providers/vonage')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createVonageProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a Vonage provider',
  })
  async createVonageProvider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateVonageProviderDTO,
  ) {
    return await this.messagingService.createVonageProvider({
      db,
      input,
    });
  }

  @Post('providers/fcm')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createFcmProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a FCM provider',
  })
  async createFcmProvider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateFcmProviderDTO,
  ) {
    return await this.messagingService.createFcmProvider({
      db,
      input,
    });
  }

  @Post('providers/apns')
  @Scope('providers.create')
  @AuditEvent('provider.create', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'createApnsProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a APNs provider',
  })
  async createApnsProvider(
    @MessagingDatabase() db: Database,
    @Body() input: CreateApnsProviderDTO,
  ) {
    return await this.messagingService.createApnsProvider({
      db,
      input,
    });
  }

  @Get('providers')
  @Scope('providers.read')
  @ResModel(Models.PROVIDER, { list: true })
  @Sdk({
    name: 'listProviders',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'List all providers',
  })
  async listProviders(
    @MessagingDatabase() db: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.messagingService.listProviders({
      db,
      queries,
      search,
    });
  }

  @Get('providers/:providerId')
  @Scope('providers.read')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'getProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Get provider',
  })
  async getProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
  ) {
    return await this.messagingService.getProvider(db, providerId)
  }

  @Patch('providers/mailgun/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateMailgunProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update Mailgun provider',
  })
  async updateMailgunProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateMailgunProviderDTO,
  ) {
    return await this.messagingService.updateMailgunProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('providers/sendgrid/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateSendgridProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update Sendgrid provider',
  })
  async updateSendgridProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateSendgridProviderDTO,
  ) {
    return await this.messagingService.updateSendgridProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('providers/smtp/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateSmtpProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update SMTP provider',
  })
  async updateSmtpProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateSMTPProviderDTO,
  ) {
    return await this.messagingService.updateSmtpProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('providers/msg91/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateMsg91Provider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update Msg91 provider',
  })
  async updateMsg91Provider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateMsg91ProviderDTO,
  ) {
    return await this.messagingService.updateMsg91Provider({
      db,
      providerId,
      input,
    });
  }

  @Patch('providers/telesign/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateTelesignProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update Telesign provider',
  })
  async updateTelesignProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateTelesignProviderDTO,
  ) {
    return await this.messagingService.updateTelesignProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('providers/textmagic/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateTextmagicProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update Textmagic provider',
  })
  async updateTextmagicProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateTextmagicProviderDTO,
  ) {
    return await this.messagingService.updateTextmagicProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('providers/twilio/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateTwilioProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update Twilio provider',
  })
  async updateTwilioProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateTwilioProviderDTO,
  ) {
    return await this.messagingService.updateTwilioProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('providers/vonage/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateVonageProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update Vonage provider',
  })
  async updateVonageProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateVonageProviderDTO,
  ) {
    return await this.messagingService.updateVonageProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('providers/fcm/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateFcmProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update FCM provider',
  })
  async updateFcmProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateFcmProviderDTO,
  ) {
    return await this.messagingService.updateFcmProvider({
      db,
      providerId,
      input,
    });
  }

  @Patch('providers/apns/:providerId')
  @Scope('providers.update')
  @AuditEvent('provider.update', 'provider/{res.$id}')
  @ResModel(Models.PROVIDER)
  @Sdk({
    name: 'updateApnsProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update APNs provider',
  })
  async updateApnsProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateApnsProviderDTO,
  ) {
    return await this.messagingService.updateApnsProvider({
      db,
      providerId,
      input,
    });
  }
}
