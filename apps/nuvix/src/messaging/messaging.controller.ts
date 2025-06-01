import {
  Body,
  Controller,
  Delete,
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

import {
  CreateMailgunProviderDTO,
  UpdateMailgunProviderDTO,
} from './DTO/mailgun.dto';
import { Database, Document, Query as Queries } from '@nuvix/database';
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
import { ParseQueryPipe } from '@nuvix/core/pipes';
import { CreateTopicDTO, UpdateTopicDTO } from './DTO/topics.dto';
import { CreateSubscriberDTO } from './DTO/subscriber.dto';
import { CreateEmailMessageDTO, CreatePushMessageDTO, CreateSmsMessageDTO } from './DTO/message.dto';

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
    return await this.messagingService.getProvider(db, providerId);
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
    return await this.messagingService.updateSendGridProvider({
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
    return await this.messagingService.updateTextMagicProvider({
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

  @Delete('providers/:providerId')
  @Scope('providers.delete')
  @AuditEvent('provider.delete', 'provider/{req.providerId}')
  @ResModel(Models.NONE)
  @Sdk({
    name: 'deleteProvider',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.NO_CONTENT,
    description: 'Delete provider',
  })
  async deleteProvider(
    @Param('providerId') providerId: string,
    @MessagingDatabase() db: Database,
  ) {
    return await this.messagingService.deleteProvider(db, providerId);
  }

  @Post('topics')
  @Scope('topics.create')
  @AuditEvent('topic.create', 'topic/{res.$id}')
  @ResModel(Models.TOPIC)
  @Sdk({
    name: 'createTopic',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a topic',
  })
  async createTopic(
    @MessagingDatabase() db: Database,
    @Body() input: CreateTopicDTO,
  ) {
    return await this.messagingService.createTopic({
      db,
      input,
    });
  }

  @Get('topics')
  @Scope('topics.read')
  @ResModel(Models.TOPIC, { list: true })
  @Sdk({
    name: 'listTopics',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'List all topics',
  })
  async listTopics(
    @MessagingDatabase() db: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.messagingService.listTopics({
      db,
      queries,
      search,
    });
  }

  @Get('topics/:topicId')
  @Scope('topics.read')
  @ResModel(Models.TOPIC)
  @Sdk({
    name: 'getTopic',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Get topic',
  })
  async getTopic(
    @Param('topicId') topicId: string,
    @MessagingDatabase() db: Database,
  ) {
    return await this.messagingService.getTopic(db, topicId);
  }

  @Patch('topics/:topicId')
  @Scope('topics.update')
  @AuditEvent('topic.update', 'topic/{res.$id}')
  @ResModel(Models.TOPIC)
  @Sdk({
    name: 'updateTopic',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Update topic',
  })
  async updateTopic(
    @Param('topicId') topicId: string,
    @MessagingDatabase() db: Database,
    @Body() input: UpdateTopicDTO,
  ) {
    return await this.messagingService.updateTopic({
      db,
      topicId,
      input,
    });
  }

  @Delete('topics/:topicId')
  @Scope('topics.delete')
  @AuditEvent('topic.delete', 'topic/{req.topicId}')
  @ResModel(Models.NONE)
  @Sdk({
    name: 'deleteTopic',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.NO_CONTENT,
    description: 'Delete topic',
  })
  async deleteTopic(
    @Param('topicId') topicId: string,
    @MessagingDatabase() db: Database,
  ) {
    return await this.messagingService.deleteTopic(db, topicId);
  }

  @Post('topics/:topicId/subscribers')
  @Scope('subscribers.create')
  @AuditEvent('subscriber.create', 'subscriber/{res.$id}')
  @ResModel(Models.SUBSCRIBER)
  @Sdk({
    name: 'createSubscriber',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create a subscriber for a topic',
  })
  async createSubscriber(
    @Param('topicId') topicId: string,
    @MessagingDatabase() db: Database,
    @Body() input: CreateSubscriberDTO,
  ) {
    return await this.messagingService.createSubscriber({
      db,
      topicId,
      input,
    });
  }

  @Get('topics/:topicId/subscribers')
  @Scope('subscribers.read')
  @ResModel(Models.SUBSCRIBER, { list: true })
  @Sdk({
    name: 'listSubscribers',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'List all subscribers for a topic',
  })
  async listSubscribers(
    @Param('topicId') topicId: string,
    @MessagingDatabase() db: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.messagingService.listSubscribers({
      db,
      topicId,
      queries,
      search,
    });
  }

  @Get('topics/:topicId/subscribers/:subscriberId')
  @Scope('subscribers.read')
  @ResModel(Models.SUBSCRIBER)
  @Sdk({
    name: 'getSubscriber',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.OK,
    description: 'Get a subscriber for a topic',
  })
  async getSubscriber(
    @Param('topicId') topicId: string,
    @Param('subscriberId') subscriberId: string,
    @MessagingDatabase() db: Database,
  ) {
    return await this.messagingService.getSubscriber(db, topicId, subscriberId);
  }

  @Delete('topics/:topicId/subscribers/:subscriberId')
  @Scope('subscribers.delete')
  @AuditEvent('subscriber.delete', 'subscriber/{req.subscriberId}')
  @ResModel(Models.NONE)
  @Sdk({
    name: 'deleteSubscriber',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.NO_CONTENT,
    description: 'Delete a subscriber for a topic',
  })
  async deleteSubscriber(
    @Param('topicId') topicId: string,
    @Param('subscriberId') subscriberId: string,
    @MessagingDatabase() db: Database,
  ) {
    return await this.messagingService.deleteSubscriber(db, topicId, subscriberId);
  }

  @Post('messages/email')
  @Scope('messages.create')
  @AuditEvent('message.create', 'message/{res.$id}')
  @ResModel(Models.MESSAGE)
  @Sdk({
    name: 'createEmail',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create email',
  })
  async createEmail(
    @MessagingDatabase() db: Database,
    @Body() input: CreateEmailMessageDTO,
    @Project() project: Document,
  ) {
    return await this.messagingService.createEmailMessage({
      db,
      input,
      project
    });
  }

  @Post('messages/sms')
  @Scope('messages.create')
  @AuditEvent('message.create', 'message/{res.$id}')
  @ResModel(Models.MESSAGE)
  @Sdk({
    name: 'createSms',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create SMS',
  })
  async createSms(
    @MessagingDatabase() db: Database,
    @Body() input: CreateSmsMessageDTO,
    @Project() project: Document,
  ) {
    return await this.messagingService.createSmsMessage({
      db,
      input,
      project
    });
  }

  @Post('messages/push')
  @Scope('messages.create')
  @AuditEvent('message.create', 'message/{res.$id}')
  @ResModel(Models.MESSAGE)
  @Sdk({
    name: 'createPush',
    auth: [AuthType.ADMIN, AuthType.KEY],
    code: HttpStatus.CREATED,
    description: 'Create push notification',
  })
  async createPush(
    @MessagingDatabase() db: Database,
    @Body() input: CreatePushMessageDTO,
    @Project() project: Document,
  ) {
    return await this.messagingService.createPushMessage({
      db,
      input,
      project
    });
  }

}
