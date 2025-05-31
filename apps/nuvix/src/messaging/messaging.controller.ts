import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
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

import { CreateMailgunProviderDTO } from './DTO/mailgun.dto';
import { Database } from '@nuvix/database';
import { CreateSendgridProviderDTO } from './DTO/sendgrid.dto';
import { CreateSMTPProviderDTO } from './DTO/smtp.dto';
import { CreateMsg91ProviderDTO } from './DTO/msg91.dto';
import { CreateTwilioProviderDTO } from './DTO/twilio.dto';
import { CreateTelesignProviderDTO } from './DTO/telesign.dto';
import { CreateTextmagicProviderDTO } from './DTO/textmagic.dto';
import { CreateVonageProviderDTO } from './DTO/vonage.dto';
import { CreateFcmProviderDTO } from './DTO/fcm.dto';
import { CreateApnsProviderDTO } from './DTO/apns.dto';

@Controller({ path: 'messaging', version: ['1'] })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

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
}
