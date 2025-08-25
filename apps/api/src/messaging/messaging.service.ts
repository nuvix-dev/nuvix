import { Injectable } from '@nestjs/common';
import type {
  CreateApnsProvider,
  CreateEmailMessage,
  CreateFcmProvider,
  CreateMailgunProvider,
  CreateMsg91Provider,
  CreateProviderInput,
  CreatePushMessage,
  CreateSendgridProvider,
  CreateSmsMessage,
  CreateSmtpProvider,
  CreateSubscriber,
  CreateTelesignProvider,
  CreateTextmagicProvider,
  CreateTopic,
  CreateTwilioProvider,
  CreateVonageProvider,
  ListMessages,
  ListProviders,
  ListSubscribers,
  ListTargets,
  ListTopics,
  UpdateApnsProvider,
  UpdateEmailMessage,
  UpdateFcmProvider,
  UpdateMailgunProvider,
  UpdateMsg91Provider,
  UpdatePushMessage,
  UpdateSendgridProvider,
  UpdateSmsMessage,
  UpdateSmtpProvider,
  UpdateTelesignProvider,
  UpdateTextmagicProvider,
  UpdateTopic,
  UpdateTwilioProvider,
  UpdateVonageProvider,
} from './messaging.types';
import {
  Authorization,
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix-tech/db';
import { Exception } from '@nuvix/core/extend/exception';
import {
  MessageType,
  QueueFor,
  ScheduleResourceType,
  Schemas,
} from '@nuvix/utils';
import { MessageStatus } from '@nuvix/core/messaging/status';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  MessagingJob,
  MessagingJobData,
} from '@nuvix/core/resolvers/queues/messaging.queue';
import { CoreService, AppConfigService } from '@nuvix/core';
import type {
  Messages,
  Providers,
  Schedules,
  Subscribers,
  Topics,
} from '@nuvix/utils/types';

@Injectable()
export class MessagingService {
  private readonly dbForPlatform: Database;

  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
    private readonly jwtService: JwtService,
    @InjectQueue(QueueFor.MESSAGING)
    private readonly queue: Queue<MessagingJobData, any, MessagingJob>,
  ) {
    this.dbForPlatform = this.coreService.getPlatformDb();
  }

  /**
   * Common method to create a provider.
   */
  private async createProvider<T extends CreateProviderInput>({
    input,
    db,
    providerType,
    messageType,
    credentialFields,
    optionFields,
    enabledCondition,
  }: {
    input: T;
    db: Database;
    providerType: string;
    messageType: string;
    credentialFields: Record<string, keyof typeof input>;
    optionFields: Record<string, keyof typeof input>;
    enabledCondition: (
      credentials: Record<string, keyof typeof input>,
      options: Record<string, keyof typeof input>,
    ) => boolean;
  }) {
    const { providerId: inputProviderId, name, enabled: inputEnabled } = input;
    const providerId =
      inputProviderId === 'unique()' ? ID.unique() : inputProviderId;

    const credentials: Record<string, any> = {};
    const options: Record<string, any> = {};

    Object.entries(credentialFields).forEach(([key, inputKey]) => {
      if (input[inputKey as keyof typeof input]) {
        credentials[key] = input[inputKey as keyof typeof input];
      }
    });
    Object.entries(optionFields).forEach(([key, inputKey]) => {
      if (input[inputKey as keyof typeof input]) {
        options[key] = input[inputKey as keyof typeof input];
      }
    });

    const enabled =
      inputEnabled === true && enabledCondition(credentials, options);

    const provider = new Doc<Providers>({
      $id: providerId,
      name,
      provider: providerType,
      type: messageType,
      enabled,
      credentials,
      options,
    });

    try {
      const createdProvider = await db.createDocument('providers', provider);
      // TODO: queue for events
      // this.queueForEvents.setParam('providerId', createdProvider.getId());
      return createdProvider;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.PROVIDER_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Creates a Mailgun provider.
   */
  async createMailgunProvider({ input, db }: CreateMailgunProvider) {
    return this.createProvider({
      input,
      db,
      providerType: 'mailgun',
      messageType: MessageType.EMAIL,
      credentialFields: {
        isEuRegion: 'isEuRegion',
        apiKey: 'apiKey',
        domain: 'domain',
      },
      optionFields: {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
      enabledCondition: (credentials, options) =>
        !!options['fromEmail'] &&
        credentials.hasOwnProperty('isEuRegion') &&
        credentials.hasOwnProperty('apiKey') &&
        credentials.hasOwnProperty('domain'),
    });
  }

  /**
   * Creates a SendGrid provider.
   */
  async createSendGridProvider({ input, db }: CreateSendgridProvider) {
    return this.createProvider({
      input,
      db,
      providerType: 'sendgrid',
      messageType: MessageType.EMAIL,
      credentialFields: {
        apiKey: 'apiKey',
      },
      optionFields: {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
      enabledCondition: (credentials, options) =>
        !!options['fromEmail'] && credentials.hasOwnProperty('apiKey'),
    });
  }

  /**
   * Creates an SMTP provider.
   */
  async createSmtpProvider({ input, db }: CreateSmtpProvider) {
    return this.createProvider({
      input,
      db,
      providerType: 'smtp',
      messageType: MessageType.EMAIL,
      credentialFields: {
        port: 'port',
        username: 'username',
        password: 'password',
        host: 'host',
      },
      optionFields: {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
        encryption: 'encryption',
        autoTLS: 'autoTLS',
        mailer: 'mailer',
      },
      enabledCondition: (credentials, options) =>
        !!options['fromEmail'] && credentials.hasOwnProperty('host'),
    });
  }

  /**
   * Creates a MSG91 provider.
   */
  async createMsg91Provider({ input, db }: CreateMsg91Provider) {
    return this.createProvider({
      input,
      db,
      providerType: 'msg91',
      messageType: MessageType.SMS,
      credentialFields: {
        templateId: 'templateId',
        senderId: 'senderId',
        authKey: 'authKey',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('senderId') &&
        credentials.hasOwnProperty('authKey') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Creates a Telesign provider.
   */
  async createTelesignProvider({ input, db }: CreateTelesignProvider) {
    return this.createProvider({
      input,
      db,
      providerType: 'telesign',
      messageType: MessageType.SMS,
      credentialFields: {
        customerId: 'customerId',
        apiKey: 'apiKey',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('customerId') &&
        credentials.hasOwnProperty('apiKey') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Creates a TextMagic provider.
   */
  async createTextMagicProvider({ input, db }: CreateTextmagicProvider) {
    return this.createProvider({
      input,
      db,
      providerType: 'textmagic',
      messageType: MessageType.SMS,
      credentialFields: {
        username: 'username',
        apiKey: 'apiKey',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('username') &&
        credentials.hasOwnProperty('apiKey') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Creates a Twilio provider.
   */
  async createTwilioProvider({ input, db }: CreateTwilioProvider) {
    return this.createProvider({
      input,
      db,
      providerType: 'twilio',
      messageType: MessageType.SMS,
      credentialFields: {
        accountSid: 'accountSid',
        authToken: 'authToken',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('accountSid') &&
        credentials.hasOwnProperty('authToken') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Creates a Vonage provider.
   */
  async createVonageProvider({ input, db }: CreateVonageProvider) {
    return this.createProvider({
      input,
      db,
      providerType: 'vonage',
      messageType: MessageType.SMS,
      credentialFields: {
        apiKey: 'apiKey',
        apiSecret: 'apiSecret',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('apiKey') &&
        credentials.hasOwnProperty('apiSecret') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Creates a Firebase Cloud Messaging (FCM) provider.
   */
  async createFcmProvider({ input, db }: CreateFcmProvider) {
    return this.createProvider({
      input,
      db,
      providerType: 'fcm',
      messageType: MessageType.PUSH,
      credentialFields: {
        serviceAccountJSON: 'serviceAccountJSON',
      },
      optionFields: {},
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('serviceAccountJSON'),
    });
  }

  /**
   * Creates an APNS provider.
   */
  async createApnsProvider({ input, db }: CreateApnsProvider) {
    return this.createProvider({
      input,
      db,
      providerType: 'apns',
      messageType: MessageType.PUSH,
      credentialFields: {
        authKey: 'authKey',
        authKeyId: 'authKeyId',
        teamId: 'teamId',
        bundleId: 'bundleId',
      },
      optionFields: {
        sandbox: 'sandbox',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('authKey') &&
        credentials.hasOwnProperty('authKeyId') &&
        credentials.hasOwnProperty('teamId') &&
        credentials.hasOwnProperty('bundleId'),
    });
  }

  /**
   * Lists all providers.
   */
  async listProviders({ db, queries, search }: ListProviders) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const { filters } = Query.groupByType(queries);

    const providers = await db.find('providers', queries);
    const total = await db.count('providers', filters);

    return {
      providers,
      total,
    };
  }

  /**
   * Get Provider
   */
  async getProvider(db: Database, id: string) {
    const provider = await db.getDocument('providers', id);

    if (provider.empty()) {
      throw new Exception(Exception.PROVIDER_NOT_FOUND);
    }

    return provider;
  }

  /**
   * Common method to update a provider.
   */
  private async updateProvider<T extends Record<string, any>>({
    providerId,
    db,
    providerType,
    updatedFields,
    credentialFields,
    optionFields,
    enabledCondition,
  }: {
    providerId: string;
    db: Database;
    providerType: string;
    updatedFields: T;
    credentialFields: Record<string, keyof typeof updatedFields>;
    optionFields: Record<string, keyof typeof updatedFields>;
    enabledCondition: (
      credentials: Record<string, keyof typeof updatedFields>,
      options: Record<string, keyof typeof updatedFields>,
    ) => boolean;
  }) {
    const provider = await db.getDocument('providers', providerId);

    if (provider.empty()) {
      throw new Exception(Exception.PROVIDER_NOT_FOUND);
    }

    if (provider.get('provider') !== providerType) {
      throw new Exception(Exception.PROVIDER_INCORRECT_TYPE);
    }

    if (updatedFields['name']) {
      provider.set('name', updatedFields['name']);
    }

    // Update credentials
    const credentials = provider.get('credentials', {}) as Record<string, any>;
    Object.entries(credentialFields).forEach(([key, inputKey]) => {
      if (
        updatedFields[inputKey] !== undefined &&
        updatedFields[inputKey] !== ''
      ) {
        credentials[key] = updatedFields[inputKey];
      }
    });
    provider.set('credentials', credentials);

    // Update options
    const options = provider.get('options') || {};
    Object.entries(optionFields).forEach(([key, inputKey]) => {
      if (
        updatedFields[inputKey] !== undefined &&
        updatedFields[inputKey] !== ''
      ) {
        options[key] = updatedFields[inputKey];
      }
    });
    provider.set('options', options);

    // Update enabled status
    if (
      updatedFields['enabled'] !== undefined &&
      updatedFields['enabled'] !== null
    ) {
      if (updatedFields['enabled']) {
        if (enabledCondition(credentials, options)) {
          provider.set('enabled', true);
        } else {
          throw new Exception(Exception.PROVIDER_MISSING_CREDENTIALS);
        }
      } else {
        provider.set('enabled', false);
      }
    }

    const updatedProvider = await db.updateDocument(
      'providers',
      provider.getId(),
      provider,
    );
    // TODO: queue for events
    // this.queueForEvents.setParam('providerId', updatedProvider.getId());

    return updatedProvider;
  }

  /**
   * Updates a Mailgun provider.
   */
  async updateMailgunProvider({
    providerId,
    db,
    input,
  }: UpdateMailgunProvider) {
    return this.updateProvider({
      providerId,
      db,
      providerType: 'mailgun',
      updatedFields: input,
      credentialFields: {
        isEuRegion: 'isEuRegion',
        apiKey: 'apiKey',
        domain: 'domain',
      },
      optionFields: {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
      enabledCondition: (credentials, options) =>
        options.hasOwnProperty('fromEmail') &&
        credentials.hasOwnProperty('isEuRegion') &&
        credentials.hasOwnProperty('apiKey') &&
        credentials.hasOwnProperty('domain'),
    });
  }

  /**
   * Updates a SendGrid provider.
   */
  async updateSendGridProvider({
    providerId,
    db,
    input,
  }: UpdateSendgridProvider) {
    return this.updateProvider({
      providerId,
      db,
      providerType: 'sendgrid',
      updatedFields: input,
      credentialFields: {
        apiKey: 'apiKey',
      },
      optionFields: {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
      enabledCondition: (credentials, options) =>
        options.hasOwnProperty('fromEmail') &&
        credentials.hasOwnProperty('apiKey'),
    });
  }

  /**
   * Updates an SMTP provider.
   */
  async updateSmtpProvider({ providerId, db, input }: UpdateSmtpProvider) {
    return this.updateProvider({
      providerId,
      db,
      providerType: 'smtp',
      updatedFields: input,
      credentialFields: {
        host: 'host',
        port: 'port',
        username: 'username',
        password: 'password',
      },
      optionFields: {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
        encryption: 'encryption',
        autoTLS: 'autoTLS',
        mailer: 'mailer',
      },
      enabledCondition: (credentials, options) =>
        options.hasOwnProperty('fromEmail') &&
        credentials.hasOwnProperty('host'),
    });
  }

  /**
   * Updates a MSG91 provider.
   */
  async updateMsg91Provider({ providerId, db, input }: UpdateMsg91Provider) {
    return this.updateProvider({
      providerId,
      db,
      providerType: 'msg91',
      updatedFields: input,
      credentialFields: {
        templateId: 'templateId',
        senderId: 'senderId',
        authKey: 'authKey',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('senderId') &&
        credentials.hasOwnProperty('authKey') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Updates a Telesign provider.
   */
  async updateTelesignProvider({
    providerId,
    db,
    input,
  }: UpdateTelesignProvider) {
    return this.updateProvider({
      providerId,
      db,
      providerType: 'telesign',
      updatedFields: input,
      credentialFields: {
        customerId: 'customerId',
        apiKey: 'apiKey',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('customerId') &&
        credentials.hasOwnProperty('apiKey') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Updates a TextMagic provider.
   */
  async updateTextMagicProvider({
    providerId,
    db,
    input,
  }: UpdateTextmagicProvider) {
    return this.updateProvider({
      providerId,
      db,
      providerType: 'textmagic',
      updatedFields: input,
      credentialFields: {
        username: 'username',
        apiKey: 'apiKey',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('username') &&
        credentials.hasOwnProperty('apiKey') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Updates a Twilio provider.
   */
  async updateTwilioProvider({ providerId, db, input }: UpdateTwilioProvider) {
    return this.updateProvider({
      providerId,
      db,
      providerType: 'twilio',
      updatedFields: input,
      credentialFields: {
        accountSid: 'accountSid',
        authToken: 'authToken',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('accountSid') &&
        credentials.hasOwnProperty('authToken') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Updates a Vonage provider.
   */
  async updateVonageProvider({ providerId, db, input }: UpdateVonageProvider) {
    return this.updateProvider({
      providerId,
      db,
      providerType: 'vonage',
      updatedFields: input,
      credentialFields: {
        apiKey: 'apiKey',
        apiSecret: 'apiSecret',
      },
      optionFields: {
        from: 'from',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('apiKey') &&
        credentials.hasOwnProperty('apiSecret') &&
        options.hasOwnProperty('from'),
    });
  }

  /**
   * Updates an FCM provider.
   */
  async updateFcmProvider({ providerId, db, input }: UpdateFcmProvider) {
    // Handle serviceAccountJSON parsing if it's a string
    if (
      input.serviceAccountJSON &&
      typeof input.serviceAccountJSON === 'string'
    ) {
      input.serviceAccountJSON = JSON.parse(input.serviceAccountJSON);
    }

    return this.updateProvider({
      providerId,
      db,
      providerType: 'fcm',
      updatedFields: input,
      credentialFields: {
        serviceAccountJSON: 'serviceAccountJSON',
      },
      optionFields: {},
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('serviceAccountJSON'),
    });
  }

  /**
   * Updates an APNS provider.
   */
  async updateApnsProvider({ providerId, db, input }: UpdateApnsProvider) {
    return this.updateProvider({
      providerId,
      db,
      providerType: 'apns',
      updatedFields: input,
      credentialFields: {
        authKey: 'authKey',
        authKeyId: 'authKeyId',
        teamId: 'teamId',
        bundleId: 'bundleId',
      },
      optionFields: {
        sandbox: 'sandbox',
      },
      enabledCondition: (credentials, options) =>
        credentials.hasOwnProperty('authKey') &&
        credentials.hasOwnProperty('authKeyId') &&
        credentials.hasOwnProperty('teamId') &&
        credentials.hasOwnProperty('bundleId'),
    });
  }

  /**
   * Deletes a provider.
   */
  async deleteProvider(db: Database, providerId: string) {
    const provider = await db.getDocument('providers', providerId);

    if (provider.empty()) {
      throw new Exception(Exception.PROVIDER_NOT_FOUND);
    }

    await db.deleteDocument('providers', providerId);

    // TODO: queue for events
    // this.queueForEvents.setParam('providerId', providerId);

    return {};
  }

  /**
   * Create Topic
   */
  async createTopic({ input, db }: CreateTopic) {
    const { topicId: inputTopicId, name, subscribe } = input;
    const topicId = inputTopicId === 'unique()' ? ID.unique() : inputTopicId;

    const topic = new Doc<Topics>({
      $id: topicId,
      name,
      subscribe,
    });

    try {
      const createdTopic = await db.createDocument('topics', topic);
      // TODO: queue for events
      // this.queueForEvents.setParam('topicId', createdTopic.getId());
      return createdTopic;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.TOPIC_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Lists all topics.
   */
  async listTopics({ db, queries, search }: ListTopics) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const { filters } = Query.groupByType(queries);

    const topics = await db.find('topics', queries);
    const total = await db.count('topics', filters);

    return {
      topics,
      total,
    };
  }

  /**
   * Get Topic
   */
  async getTopic(db: Database, id: string) {
    const topic = await db.getDocument('topics', id);

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND);
    }

    return topic;
  }

  /**
   * Updates a topic.
   */
  async updateTopic({ topicId, db, input }: UpdateTopic) {
    const topic = await db.getDocument('topics', topicId);

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND);
    }

    if (input.name !== undefined && input.name !== null) {
      topic.set('name', input.name);
    }

    if (input.subscribe !== undefined && input.subscribe !== null) {
      topic.set('subscribe', input.subscribe);
    }

    const updatedTopic = await db.updateDocument('topics', topicId, topic);

    // TODO: queue for events
    // this.queueForEvents.setParam('topicId', updatedTopic.getId());

    return updatedTopic;
  }

  /**
   * Deletes a topic.
   */
  async deleteTopic(db: Database, topicId: string) {
    const topic = await db.getDocument('topics', topicId);

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND);
    }

    await db.deleteDocument('topics', topicId);

    // queueForDeletes
    //         .setType(DELETE_TYPE_TOPIC)
    //         .setDocument(topic);

    // queueForEvents
    //   .setParam('topicId', topic.getId());

    return;
  }

  /**
   * Create Subscriber
   */
  async createSubscriber({ input, db, topicId }: CreateSubscriber) {
    const { subscriberId: inputSubscriberId, targetId } = input;
    const subscriberId =
      inputSubscriberId === 'unique()' ? ID.unique() : inputSubscriberId;

    const topic = await Authorization.skip(() =>
      db.getDocument('topics', topicId),
    );

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND);
    }

    const validator = new Authorization('subscribe' as any);
    if (!validator.$valid(topic.get('subscribe'))) {
      throw new Exception(Exception.USER_UNAUTHORIZED, validator.$description);
    }

    const target = await Authorization.skip(() =>
      db.withSchema(Schemas.Auth, () => db.getDocument('targets', targetId)),
    );

    if (target.empty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    const user = await Authorization.skip(() =>
      db.withSchema(Schemas.Auth, () =>
        db.getDocument('users', target.get('userId')),
      ),
    );

    const subscriber = new Doc<Subscribers>({
      $id: subscriberId,
      $permissions: [
        Permission.read(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ],
      topicId,
      topicInternalId: topic.getSequence(),
      targetId,
      targetInternalId: target.getSequence(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      providerType: target.get('providerType'),
      search: [
        subscriberId,
        targetId,
        user.getId(),
        target.get('providerType'),
      ].join(' '),
    });

    try {
      const createdSubscriber = await db.createDocument(
        'subscribers',
        subscriber,
      );

      const totalAttribute = (() => {
        switch (target.get('providerType')) {
          case MessageType.EMAIL:
            return 'emailTotal';
          case MessageType.SMS:
            return 'smsTotal';
          case MessageType.PUSH:
            return 'pushTotal';
          default:
            throw new Exception(Exception.TARGET_PROVIDER_INVALID_TYPE);
        }
      })();

      await Authorization.skip(() =>
        db.increaseDocumentAttribute('topics', topicId, totalAttribute),
      );

      // TODO: queue for events
      // this.queueForEvents
      //   .setParam('topicId', topic.getId())
      //   .setParam('subscriberId', createdSubscriber.getId());

      createdSubscriber.set('target', target).set('userName', user.get('name'));

      return createdSubscriber;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.SUBSCRIBER_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Lists all subscribers for a topic.
   */
  async listSubscribers({ db, topicId, queries, search }: ListSubscribers) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const topic = await Authorization.skip(() =>
      db.getDocument('topics', topicId),
    );

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND);
    }

    const { filters } = Query.groupByType(queries);

    queries.push(Query.equal('topicInternalId', [topic.getSequence()]));
    const subscribers = await db.find('subscribers', queries);
    const total = await db.count('subscribers', filters);

    // Batch process subscribers to add target and userName
    const enrichedSubscribers = await Promise.all(
      subscribers.map(async subscriber => {
        const target = await Authorization.skip(() =>
          db.withSchema(Schemas.Auth, () =>
            db.getDocument('targets', subscriber.get('targetId')),
          ),
        );
        const user = await Authorization.skip(() =>
          db.withSchema(Schemas.Auth, () =>
            db.getDocument('users', target.get('userId')),
          ),
        );

        return subscriber
          .set('target', target)
          .set('userName', user.get('name'));
      }),
    );

    return {
      subscribers: enrichedSubscribers,
      total,
    };
  }

  /**
   * Get Subscriber
   */
  async getSubscriber(db: Database, topicId: string, subscriberId: string) {
    const topic = await Authorization.skip(() =>
      db.getDocument('topics', topicId),
    );

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND);
    }

    const subscriber = await db.getDocument('subscribers', subscriberId);

    if (subscriber.empty() || subscriber.get('topicId') !== topicId) {
      throw new Exception(Exception.SUBSCRIBER_NOT_FOUND);
    }

    const target = await Authorization.skip(() =>
      db.withSchema(Schemas.Auth, () =>
        db.getDocument('targets', subscriber.get('targetId')),
      ),
    );
    const user = await Authorization.skip(() =>
      db.withSchema(Schemas.Auth, () =>
        db.getDocument('users', target.get('userId')),
      ),
    );

    subscriber.set('target', target).set('userName', user.get('name'));

    return subscriber;
  }

  /**
   * Deletes a subscriber.
   */
  async deleteSubscriber(db: Database, topicId: string, subscriberId: string) {
    const topic = await Authorization.skip(() =>
      db.getDocument('topics', topicId),
    );

    if (topic.empty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND);
    }

    const subscriber = await db.getDocument('subscribers', subscriberId);

    if (subscriber.empty() || subscriber.get('topicId') !== topicId) {
      throw new Exception(Exception.SUBSCRIBER_NOT_FOUND);
    }

    const target = await db.withSchema(Schemas.Auth, () =>
      db.getDocument('targets', subscriber.get('targetId')),
    );

    await db.deleteDocument('subscribers', subscriberId);

    const totalAttribute = (() => {
      switch (target.get('providerType')) {
        case MessageType.EMAIL:
          return 'emailTotal';
        case MessageType.SMS:
          return 'smsTotal';
        case MessageType.PUSH:
          return 'pushTotal';
        default:
          throw new Exception(Exception.TARGET_PROVIDER_INVALID_TYPE);
      }
    })();

    await Authorization.skip(() =>
      db.decreaseDocumentAttribute('topics', topicId, totalAttribute, 0),
    );

    // TODO: queue for events
    // this.queueForEvents
    //   .setParam('topicId', topic.getId())
    //   .setParam('subscriberId', subscriber.getId());

    return {};
  }

  /**
   * Create Email Message
   */
  async createEmailMessage({ input, db, project }: CreateEmailMessage) {
    const {
      messageId: inputMessageId,
      subject,
      content,
      topics = [],
      users = [],
      targets = [],
      cc = [],
      bcc = [],
      attachments = [],
      draft = false,
      html = false,
      scheduledAt = null,
    } = input;

    const messageId =
      inputMessageId === 'unique()' ? ID.unique() : inputMessageId;

    const status = draft
      ? MessageStatus.DRAFT
      : scheduledAt
        ? MessageStatus.SCHEDULED
        : MessageStatus.PROCESSING;

    if (
      status !== MessageStatus.DRAFT &&
      topics.length === 0 &&
      users.length === 0 &&
      targets.length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET);
    }

    if (status === MessageStatus.SCHEDULED && !scheduledAt) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE);
    }

    const mergedTargets = [...targets, ...cc, ...bcc];

    if (mergedTargets.length > 0) {
      const foundTargets = await db.withSchema(Schemas.Auth, () =>
        db.find('targets', qb =>
          qb
            .equal('$id', ...mergedTargets)
            .equal('providerType', MessageType.EMAIL)
            .limit(mergedTargets.length),
        ),
      );

      if (foundTargets.length !== mergedTargets.length) {
        throw new Exception(Exception.MESSAGE_TARGET_NOT_EMAIL);
      }

      for (const target of foundTargets) {
        if (target.empty()) {
          throw new Exception(Exception.USER_TARGET_NOT_FOUND);
        }
      }
    }

    const processedAttachments = [];
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        const [bucketId, fileId] = attachment.split(':') as [string, string];

        const bucket = await db.getDocument('buckets', bucketId);
        if (bucket.empty()) {
          throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
        }

        const file = await db.getDocument(
          `bucket_${bucket.getSequence()}`,
          fileId,
        );
        if (file.empty()) {
          throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
        }

        processedAttachments.push({
          bucketId,
          fileId,
        });
      }
    }

    const message = new Doc<Messages>({
      $id: messageId,
      providerType: MessageType.EMAIL,
      topics,
      users,
      targets,
      scheduledAt,
      data: {
        subject,
        content,
        html,
        cc,
        bcc,
        attachments: processedAttachments,
      },
      status,
    });

    const createdMessage = await db.createDocument('messages', message);

    switch (status) {
      case MessageStatus.PROCESSING:
        await this.queue.add(MessagingJob.EXTERNAL, {
          project,
          message: createdMessage,
        });
        break;
      case MessageStatus.SCHEDULED:
        const schedule = new Doc<Schedules>({
          region: project.get('region'),
          resourceType: ScheduleResourceType.MESSAGE,
          resourceId: createdMessage.getId(),
          resourceInternalId: createdMessage.getSequence(),
          resourceUpdatedAt: new Date().toISOString(),
          projectId: project.getId(),
          schedule: scheduledAt,
          active: true,
        });

        const createdSchedule = await this.dbForPlatform.createDocument(
          'schedules',
          schedule,
        );
        createdMessage.set('scheduleId', createdSchedule.getId());
        await db.updateDocument(
          'messages',
          createdMessage.getId(),
          createdMessage,
        );
        break;
    }

    // queueForEvents.setParam('messageId', createdMessage.getId());

    return createdMessage;
  }

  /**
   * Create SMS Message
   */
  async createSmsMessage({ input, db, project }: CreateSmsMessage) {
    const {
      messageId: inputMessageId,
      content,
      topics = [],
      users = [],
      targets = [],
      draft = false,
      scheduledAt = null,
    } = input;

    const messageId =
      inputMessageId === 'unique()' ? ID.unique() : inputMessageId;

    const status = draft
      ? MessageStatus.DRAFT
      : scheduledAt
        ? MessageStatus.SCHEDULED
        : MessageStatus.PROCESSING;

    if (
      status !== MessageStatus.DRAFT &&
      topics.length === 0 &&
      users.length === 0 &&
      targets.length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET);
    }

    if (status === MessageStatus.SCHEDULED && !scheduledAt) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE);
    }

    if (targets.length > 0) {
      const foundTargets = await db.withSchema(Schemas.Auth, () =>
        db.find('targets', qb =>
          qb
            .equal('$id', ...targets)
            .equal('providerType', MessageType.SMS)
            .limit(targets.length),
        ),
      );

      if (foundTargets.length !== targets.length) {
        throw new Exception(Exception.MESSAGE_TARGET_NOT_SMS);
      }

      for (const target of foundTargets) {
        if (target.empty()) {
          throw new Exception(Exception.USER_TARGET_NOT_FOUND);
        }
      }
    }

    const message = new Doc<Messages>({
      $id: messageId,
      providerType: MessageType.SMS,
      topics,
      users,
      targets,
      scheduledAt,
      data: {
        content,
      },
      status,
    });

    const createdMessage = await db.createDocument('messages', message);

    switch (status) {
      case MessageStatus.PROCESSING:
        await this.queue.add(MessagingJob.EXTERNAL, {
          project,
          message: createdMessage,
        });
        break;
      case MessageStatus.SCHEDULED:
        const schedule = new Doc<Schedules>({
          region: project.get('region'),
          resourceType: ScheduleResourceType.MESSAGE,
          resourceId: createdMessage.getId(),
          resourceInternalId: createdMessage.getSequence(),
          resourceUpdatedAt: new Date().toISOString(),
          projectId: project.getId(),
          schedule: scheduledAt,
          active: true,
        });

        const createdSchedule = await this.dbForPlatform.createDocument(
          'schedules',
          schedule,
        );
        createdMessage.set('scheduleId', createdSchedule.getId());
        await db.updateDocument(
          'messages',
          createdMessage.getId(),
          createdMessage,
        );
        break;
    }

    // queueForEvents.setParam('messageId', createdMessage.getId());

    return createdMessage;
  }

  /**
   * Create Push Message
   */
  async createPushMessage({ input, db, project }: CreatePushMessage) {
    const {
      messageId: inputMessageId,
      title = '',
      body = '',
      topics = [],
      users = [],
      targets = [],
      data = null,
      action = '',
      image = '',
      icon = '',
      sound = '',
      color = '',
      tag = '',
      badge = -1,
      draft = false,
      scheduledAt = null,
      contentAvailable = false,
      critical = false,
      priority = 'high',
    } = input;

    const messageId =
      inputMessageId === 'unique()' ? ID.unique() : inputMessageId;

    const status = draft
      ? MessageStatus.DRAFT
      : scheduledAt
        ? MessageStatus.SCHEDULED
        : MessageStatus.PROCESSING;

    if (
      status !== MessageStatus.DRAFT &&
      topics.length === 0 &&
      users.length === 0 &&
      targets.length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET);
    }

    if (status === MessageStatus.SCHEDULED && !scheduledAt) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE);
    }

    if (targets.length > 0) {
      const foundTargets = await db.withSchema(Schemas.Auth, () =>
        db.find('targets', qb =>
          qb
            .equal('$id', ...targets)
            .equal('providerType', MessageType.PUSH)
            .limit(targets.length),
        ),
      );

      if (foundTargets.length !== targets.length) {
        throw new Exception(Exception.MESSAGE_TARGET_NOT_PUSH);
      }

      for (const target of foundTargets) {
        if (target.empty()) {
          throw new Exception(Exception.USER_TARGET_NOT_FOUND);
        }
      }
    }

    let processedImage: any = null;
    if (image) {
      const [bucketId, fileId] = image.split(':') as [string, string];

      const bucket = await db.getDocument('buckets', bucketId);
      if (bucket.empty()) {
        throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
      }

      const file = await db.getDocument(
        `bucket_${bucket.getSequence()}`,
        fileId,
      );
      if (file.empty()) {
        throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
      }

      const allowedMimeTypes = ['image/png', 'image/jpeg'];
      if (!allowedMimeTypes.includes(file.get('mimeType'))) {
        throw new Exception(Exception.STORAGE_FILE_TYPE_UNSUPPORTED);
      }

      const host = this.appConfig.get('app').domain || 'localhost';
      const protocol = this.appConfig.get('app').forceHttps ? 'https' : 'http';
      const scheduleTime = scheduledAt;

      // Set expiry to 15 days from now
      let expiry: number;
      if (scheduleTime) {
        const expiryDate = new Date(scheduleTime);
        expiryDate.setDate(expiryDate.getDate() + 15);
        expiry = Math.floor(expiryDate.getTime() / 1000);
      } else {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 15);
        expiry = Math.floor(expiryDate.getTime() / 1000);
      }

      const jwt = this.jwtService.sign(
        {
          bucketId: bucket.getId(),
          fileId: file.getId(),
          projectId: project.getId(),
        },
        {
          expiresIn: expiry,
          algorithm: 'HS256',
        },
      );

      processedImage = {
        bucketId: bucket.getId(),
        fileId: file.getId(),
        url: `${protocol}://${host}/v1/storage/buckets/${bucket.getId()}/files/${file.getId()}/push?project=${project.getId()}&jwt=${jwt}`,
      };
    }

    const pushData: Record<string, any> = {};

    if (title) pushData['title'] = title;
    if (body) pushData['body'] = body;
    if (data) pushData['data'] = data;
    if (action) pushData['action'] = action;
    if (processedImage) pushData['image'] = processedImage;
    if (icon) pushData['icon'] = icon;
    if (sound) pushData['sound'] = sound;
    if (color) pushData['color'] = color;
    if (tag) pushData['tag'] = tag;
    if (badge >= 0) pushData['badge'] = badge;
    if (contentAvailable) pushData['contentAvailable'] = true;
    if (critical) pushData['critical'] = true;
    if (priority) pushData['priority'] = priority;

    const message = new Doc<Messages>({
      $id: messageId,
      providerType: MessageType.PUSH,
      topics,
      users,
      targets,
      scheduledAt,
      data: pushData,
      status,
    });

    const createdMessage = await db.createDocument('messages', message);

    switch (status) {
      case MessageStatus.PROCESSING:
        await this.queue.add(MessagingJob.EXTERNAL, {
          project,
          message: createdMessage,
        });
        break;
      case MessageStatus.SCHEDULED:
        const schedule = new Doc({
          region: project.get('region'),
          resourceType: ScheduleResourceType.MESSAGE,
          resourceId: createdMessage.getId(),
          resourceInternalId: createdMessage.getSequence(),
          resourceUpdatedAt: new Date().toISOString(),
          projectId: project.getId(),
          schedule: scheduledAt,
          active: true,
        });

        const createdSchedule = await this.dbForPlatform.createDocument(
          'schedules',
          schedule,
        );
        createdMessage.set('scheduleId', createdSchedule.getId());
        await db.updateDocument(
          'messages',
          createdMessage.getId(),
          createdMessage,
        );
        break;
    }

    // queueForEvents.setParam('messageId', createdMessage.getId());

    return createdMessage;
  }

  /**
   * Lists all messages.
   */
  async listMessages({ db, queries, search }: ListMessages) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const { filters } = Query.groupByType(queries);

    const messages = await db.find('messages', queries);
    const total = await db.count('messages', filters);

    return {
      messages,
      total,
    };
  }

  /**
   * Get Message
   */
  async getMessage(db: Database, id: string) {
    const message = await db.getDocument('messages', id);

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND);
    }

    return message;
  }

  /**
   *  List targets for a message.
   */
  async listTargets({ db, messageId, queries }: ListTargets) {
    const message = await db.getDocument('messages', messageId);

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND);
    }

    const targetIDs = message.get('targets');
    if (!targetIDs || targetIDs.length === 0) {
      return {
        targets: [],
        total: 0,
      };
    }

    const { filters } = Query.groupByType(queries);

    queries.push(Query.equal('$id', targetIDs));
    const { targets, total } = await db.withSchema(Schemas.Auth, async () => {
      const targets = await db.find('targets', queries);
      const total = await db.count('targets', filters);
      return { targets, total };
    });

    return {
      targets,
      total,
    };
  }

  /**
   * Update Email Message
   */
  async updateEmailMessage({
    messageId,
    input,
    db,
    project,
  }: UpdateEmailMessage) {
    const message = await db.getDocument('messages', messageId);

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND);
    }

    let status: string;
    if (input.draft !== undefined || input.scheduledAt !== undefined) {
      if (input.draft) {
        status = MessageStatus.DRAFT;
      } else {
        status = input.scheduledAt
          ? MessageStatus.SCHEDULED
          : MessageStatus.PROCESSING;
      }
    } else {
      status = message.get('status');
    }

    if (
      status !== MessageStatus.DRAFT &&
      (input.topics ?? message.get('topics', [])).length === 0 &&
      (input.users ?? message.get('users', [])).length === 0 &&
      (input.targets ?? message.get('targets', [])).length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET);
    }

    const currentScheduledAt = message.get('scheduledAt');

    switch (message.get('status')) {
      case MessageStatus.PROCESSING:
        throw new Exception(Exception.MESSAGE_ALREADY_PROCESSING);
      case MessageStatus.SENT:
        throw new Exception(Exception.MESSAGE_ALREADY_SENT);
      case MessageStatus.FAILED:
        throw new Exception(Exception.MESSAGE_ALREADY_FAILED);
    }

    if (
      status === MessageStatus.SCHEDULED &&
      !input.scheduledAt &&
      !currentScheduledAt
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE);
    }

    if (
      currentScheduledAt &&
      new Date(currentScheduledAt as string) < new Date()
    ) {
      throw new Exception(Exception.MESSAGE_ALREADY_SCHEDULED);
    }

    if (!currentScheduledAt && input.scheduledAt) {
      const schedule = new Doc<Schedules>({
        region: project.get('region'),
        resourceType: 'message',
        resourceId: message.getId(),
        resourceInternalId: message.getSequence(),
        resourceUpdatedAt: new Date().toISOString(),
        projectId: project.getId(),
        schedule: input.scheduledAt,
        active: status === MessageStatus.SCHEDULED,
      });

      const createdSchedule = await this.dbForPlatform.createDocument(
        'schedules',
        schedule,
      );
      message.set('scheduleId', createdSchedule.getId());
    }

    if (currentScheduledAt) {
      const schedule = await this.dbForPlatform.getDocument(
        'schedules',
        message.get('scheduleId'),
      );
      const scheduledStatus = status === MessageStatus.SCHEDULED;

      if (schedule.empty()) {
        throw new Exception(Exception.SCHEDULE_NOT_FOUND);
      }

      schedule
        .set('resourceUpdatedAt', new Date().toISOString())
        .set('active', scheduledStatus);

      if (input.scheduledAt) {
        schedule.set('schedule', input.scheduledAt);
      }

      await this.dbForPlatform.updateDocument(
        'schedules',
        schedule.getId(),
        schedule,
      );
    }

    if (input.scheduledAt) {
      message.set('scheduledAt', input.scheduledAt);
    }

    if (input.topics !== undefined) {
      message.set('topics', input.topics);
    }

    if (input.users !== undefined) {
      message.set('users', input.users);
    }

    if (input.targets !== undefined) {
      message.set('targets', input.targets);
    }

    const data = message.get('data');

    if (input.subject !== undefined) {
      data['subject'] = input.subject;
    }

    if (input.content !== undefined) {
      data['content'] = input.content;
    }

    if (input.attachments !== undefined) {
      const processedAttachments = [];
      for (const attachment of input.attachments) {
        const [bucketId, fileId] = attachment.split(':') as [string, string];

        const bucket = await db.getDocument('buckets', bucketId);
        if (bucket.empty()) {
          throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
        }

        const file = await db.getDocument(
          `bucket_${bucket.getSequence()}`,
          fileId,
        );
        if (file.empty()) {
          throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
        }

        processedAttachments.push({
          bucketId,
          fileId,
        });
      }
      data['attachments'] = processedAttachments;
    }

    if (input.html !== undefined) {
      data['html'] = input.html;
    }

    if (input.cc !== undefined) {
      data['cc'] = input.cc;
    }

    if (input.bcc !== undefined) {
      data['bcc'] = input.bcc;
    }

    message.set('data', data);
    if (status) {
      message.set('status', status);
    }

    const updatedMessage = await db.updateDocument(
      'messages',
      message.getId(),
      message,
    );

    if (status === MessageStatus.PROCESSING) {
      await this.queue.add(MessagingJob.EXTERNAL, {
        project,
        message: updatedMessage,
      });
    }

    // queueForEvents.setParam('messageId', updatedMessage.getId());

    return updatedMessage;
  }

  /**
   * Update SMS Message
   */
  async updateSmsMessage({ messageId, input, db, project }: UpdateSmsMessage) {
    const message = await db.getDocument('messages', messageId);

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND);
    }

    let status: string;
    if (input.draft !== undefined || input.scheduledAt !== undefined) {
      if (input.draft) {
        status = MessageStatus.DRAFT;
      } else {
        status = input.scheduledAt
          ? MessageStatus.SCHEDULED
          : MessageStatus.PROCESSING;
      }
    } else {
      status = message.get('status');
    }

    if (
      status !== MessageStatus.DRAFT &&
      (input.topics ?? message.get('topics', [])).length === 0 &&
      (input.users ?? message.get('users', [])).length === 0 &&
      (input.targets ?? message.get('targets', [])).length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET);
    }

    const currentScheduledAt = message.get('scheduledAt');

    switch (message.get('status')) {
      case MessageStatus.PROCESSING:
        throw new Exception(Exception.MESSAGE_ALREADY_PROCESSING);
      case MessageStatus.SENT:
        throw new Exception(Exception.MESSAGE_ALREADY_SENT);
      case MessageStatus.FAILED:
        throw new Exception(Exception.MESSAGE_ALREADY_FAILED);
    }

    if (
      status === MessageStatus.SCHEDULED &&
      !input.scheduledAt &&
      !currentScheduledAt
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE);
    }

    if (
      currentScheduledAt &&
      new Date(currentScheduledAt as string) < new Date()
    ) {
      throw new Exception(Exception.MESSAGE_ALREADY_SCHEDULED);
    }

    if (!currentScheduledAt && input.scheduledAt) {
      const schedule = new Doc<Schedules>({
        region: project.get('region'),
        resourceType: 'message',
        resourceId: message.getId(),
        resourceInternalId: message.getSequence(),
        resourceUpdatedAt: new Date().toISOString(),
        projectId: project.getId(),
        schedule: input.scheduledAt,
        active: status === MessageStatus.SCHEDULED,
      });

      const createdSchedule = await this.dbForPlatform.createDocument(
        'schedules',
        schedule,
      );
      message.set('scheduleId', createdSchedule.getId());
    }

    if (currentScheduledAt) {
      const schedule = await this.dbForPlatform.getDocument(
        'schedules',
        message.get('scheduleId'),
      );
      const scheduledStatus = status === MessageStatus.SCHEDULED;

      if (schedule.empty()) {
        throw new Exception(Exception.SCHEDULE_NOT_FOUND);
      }

      schedule
        .set('resourceUpdatedAt', new Date().toISOString())
        .set('active', scheduledStatus);

      if (input.scheduledAt) {
        schedule.set('schedule', input.scheduledAt);
      }

      await this.dbForPlatform.updateDocument(
        'schedules',
        schedule.getId(),
        schedule,
      );
    }

    if (input.scheduledAt) {
      message.set('scheduledAt', input.scheduledAt);
    }

    if (input.topics !== undefined) {
      message.set('topics', input.topics);
    }

    if (input.users !== undefined) {
      message.set('users', input.users);
    }

    if (input.targets !== undefined) {
      message.set('targets', input.targets);
    }

    const data = message.get('data');

    if (input.content !== undefined) {
      data['content'] = input.content;
    }

    message.set('data', data);

    if (status) {
      message.set('status', status);
    }

    const updatedMessage = await db.updateDocument(
      'messages',
      message.getId(),
      message,
    );

    if (status === MessageStatus.PROCESSING) {
      await this.queue.add(MessagingJob.EXTERNAL, {
        project,
        message: updatedMessage,
      });
    }

    // queueForEvents.setParam('messageId', updatedMessage.getId());

    return updatedMessage;
  }

  /**
   * Update Push Message
   */
  async updatePushMessage({
    messageId,
    input,
    db,
    project,
  }: UpdatePushMessage) {
    const message = await db.getDocument('messages', messageId);

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND);
    }

    let status: string;
    if (input.draft !== undefined || input.scheduledAt !== undefined) {
      if (input.draft) {
        status = MessageStatus.DRAFT;
      } else {
        status = input.scheduledAt
          ? MessageStatus.SCHEDULED
          : MessageStatus.PROCESSING;
      }
    } else {
      status = message.get('status');
    }

    if (
      status !== MessageStatus.DRAFT &&
      (input.topics ?? message.get('topics', [])).length === 0 &&
      (input.users ?? message.get('users', [])).length === 0 &&
      (input.targets ?? message.get('targets', [])).length === 0
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_TARGET);
    }

    const currentScheduledAt = message.get('scheduledAt');

    switch (message.get('status')) {
      case MessageStatus.PROCESSING:
        throw new Exception(Exception.MESSAGE_ALREADY_PROCESSING);
      case MessageStatus.SENT:
        throw new Exception(Exception.MESSAGE_ALREADY_SENT);
      case MessageStatus.FAILED:
        throw new Exception(Exception.MESSAGE_ALREADY_FAILED);
    }

    if (
      status === MessageStatus.SCHEDULED &&
      !input.scheduledAt &&
      !currentScheduledAt
    ) {
      throw new Exception(Exception.MESSAGE_MISSING_SCHEDULE);
    }

    if (
      currentScheduledAt &&
      new Date(currentScheduledAt as string) < new Date()
    ) {
      throw new Exception(Exception.MESSAGE_ALREADY_SCHEDULED);
    }

    if (!currentScheduledAt && input.scheduledAt) {
      const schedule = new Doc<Schedules>({
        region: project.get('region'),
        resourceType: 'message',
        resourceId: message.getId(),
        resourceInternalId: message.getSequence(),
        resourceUpdatedAt: new Date().toISOString(),
        projectId: project.getId(),
        schedule: input.scheduledAt,
        active: status === MessageStatus.SCHEDULED,
      });

      const createdSchedule = await this.dbForPlatform.createDocument(
        'schedules',
        schedule,
      );
      message.set('scheduleId', createdSchedule.getId());
    }

    // Handle schedule updates
    if (currentScheduledAt) {
      const schedule = await this.dbForPlatform.getDocument(
        'schedules',
        message.get('scheduleId'),
      );
      const scheduledStatus = status === MessageStatus.SCHEDULED;

      if (schedule.empty()) {
        throw new Exception(Exception.SCHEDULE_NOT_FOUND);
      }

      schedule
        .set('resourceUpdatedAt', new Date().toISOString())
        .set('active', scheduledStatus);

      if (input.scheduledAt) {
        schedule.set('schedule', input.scheduledAt);
      }

      await this.dbForPlatform.updateDocument(
        'schedules',
        schedule.getId(),
        schedule,
      );
    }

    if (input.scheduledAt) {
      message.set('scheduledAt', input.scheduledAt);
    }

    if (input.topics !== undefined) {
      message.set('topics', input.topics);
    }

    if (input.users !== undefined) {
      message.set('users', input.users);
    }

    if (input.targets !== undefined) {
      message.set('targets', input.targets);
    }

    const pushData = message.get('data');
    if (input.title !== undefined) {
      pushData['title'] = input.title;
    }

    if (input.body !== undefined) {
      pushData['body'] = input.body;
    }

    if (input.data !== undefined) {
      pushData['data'] = input.data;
    }

    if (input.action !== undefined) {
      pushData['action'] = input.action;
    }

    if (input.icon !== undefined) {
      pushData['icon'] = input.icon;
    }

    if (input.sound !== undefined) {
      pushData['sound'] = input.sound;
    }

    if (input.color !== undefined) {
      pushData['color'] = input.color;
    }

    if (input.tag !== undefined) {
      pushData['tag'] = input.tag;
    }

    if (input.badge !== undefined) {
      pushData['badge'] = input.badge;
    }

    if (input.contentAvailable !== undefined) {
      pushData['contentAvailable'] = input.contentAvailable;
    }

    if (input.critical !== undefined) {
      pushData['critical'] = input.critical;
    }

    if (input.priority !== undefined) {
      pushData['priority'] = input.priority;
    }

    if (input.image !== undefined) {
      const [bucketId, fileId] = input.image.split(':') as [string, string];

      const bucket = await db.getDocument('buckets', bucketId);
      if (bucket.empty()) {
        throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
      }

      const file = await db.getDocument(
        `bucket_${bucket.getSequence()}`,
        fileId,
      );
      if (file.empty()) {
        throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
      }

      const allowedMimeTypes = ['image/png', 'image/jpeg'];
      if (!allowedMimeTypes.includes(file.get('mimeType'))) {
        throw new Exception(Exception.STORAGE_FILE_TYPE_UNSUPPORTED);
      }

      const host = this.appConfig.get('app').domain || 'localhost';
      const protocol = this.appConfig.get('app').forceHttps ? 'https' : 'http';

      const scheduleTime = currentScheduledAt || input.scheduledAt;
      let expiry: number;
      if (scheduleTime) {
        const expiryDate = new Date(scheduleTime as string);
        expiryDate.setDate(expiryDate.getDate() + 15);
        expiry = Math.floor(expiryDate.getTime() / 1000);
      } else {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 15);
        expiry = Math.floor(expiryDate.getTime() / 1000);
      }

      const jwt = this.jwtService.sign(
        {
          bucketId: bucket.getId(),
          fileId: file.getId(),
          projectId: project.getId(),
        },
        {
          expiresIn: expiry,
          algorithm: 'HS256',
        },
      );

      pushData['image'] = {
        bucketId: bucket.getId(),
        fileId: file.getId(),
        url: `${protocol}://${host}/v1/storage/buckets/${bucket.getId()}/files/${file.getId()}/push?project=${project.getId()}&jwt=${jwt}`,
      };
    }

    message.set('data', pushData);

    if (status) {
      message.set('status', status);
    }

    const updatedMessage = await db.updateDocument(
      'messages',
      message.getId(),
      message,
    );

    if (status === MessageStatus.PROCESSING) {
      await this.queue.add(MessagingJob.EXTERNAL, {
        project,
        message: updatedMessage,
      });
    }

    // queueForEvents.setParam('messageId', updatedMessage.getId());

    return updatedMessage;
  }

  /**
   * Deletes a message.
   */
  async deleteMessage(db: Database, messageId: string) {
    const message = await db.getDocument('messages', messageId);

    if (message.empty()) {
      throw new Exception(Exception.MESSAGE_NOT_FOUND);
    }

    switch (message.get('status')) {
      case MessageStatus.PROCESSING:
        throw new Exception(Exception.MESSAGE_ALREADY_SCHEDULED);
      case MessageStatus.SCHEDULED:
        const scheduleId = message.get('scheduleId');
        const scheduledAt = message.get('scheduledAt');

        const now = new Date();
        const scheduledDate = new Date(scheduledAt as string);
        if (now > scheduledDate) {
          throw new Exception(Exception.MESSAGE_ALREADY_SCHEDULED);
        }

        if (scheduleId) {
          try {
            await this.dbForPlatform.deleteDocument('schedules', scheduleId);
          } catch (error) {
            // Ignore
          }
        }
        break;
      default:
        break;
    }

    await db.deleteDocument('messages', message.getId());

    // TODO: queue for events
    // this.queueForEvents
    //   .setParam('messageId', message.getId())
    //   .setPayload(response.output(message, Response.MODEL_MESSAGE));

    return {};
  }
}
