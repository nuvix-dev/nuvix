import { Injectable } from '@nestjs/common';
import type {
  CreateApnsProvider,
  CreateFcmProvider,
  CreateMailgunProvider,
  CreateMsg91Provider,
  CreateSendgridProvider,
  CreateSmtpProvider,
  CreateTelesignProvider,
  CreateTextmagicProvider,
  CreateTopic,
  CreateTwilioProvider,
  CreateVonageProvider,
  ListProviders,
  ListTopics,
  UpdateApnsProvider,
  UpdateFcmProvider,
  UpdateMailgunProvider,
  UpdateMsg91Provider,
  UpdateSendgridProvider,
  UpdateSmtpProvider,
  UpdateTelesignProvider,
  UpdateTextmagicProvider,
  UpdateTwilioProvider,
  UpdateVonageProvider,
} from './messaging.types';
import {
  Authorization,
  CursorValidator,
  Database,
  DatabaseError,
  Document,
  DuplicateException,
  ID,
  Query,
} from '@nuvix/database';
import { Exception } from '@nuvix/core/extend/exception';
import {
  MESSAGE_TYPE_EMAIL,
  MESSAGE_TYPE_PUSH,
  MESSAGE_TYPE_SMS,
} from '@nuvix/utils/constants';

@Injectable()
export class MessagingService {
  constructor() { }

  /**
   * Common method to create a provider.
   */
  private async createProvider({
    input,
    db,
    providerType,
    messageType,
    credentialFields,
    optionFields,
    enabledCondition,
  }: {
    input: any;
    db: Database;
    providerType: string;
    messageType: string;
    credentialFields: Record<string, string>;
    optionFields: Record<string, string>;
    enabledCondition: (
      credentials: Record<string, any>,
      options: Record<string, any>,
    ) => boolean;
  }) {
    const { providerId: inputProviderId, name, enabled: inputEnabled } = input;
    const providerId =
      inputProviderId === 'unique()' ? ID.unique() : inputProviderId;

    const credentials: Record<string, any> = {};
    const options: Record<string, any> = {};

    // Map credential fields
    Object.entries(credentialFields).forEach(([key, inputKey]) => {
      if (input[inputKey]) {
        credentials[key] = input[inputKey];
      }
    });

    // Map option fields
    Object.entries(optionFields).forEach(([key, inputKey]) => {
      if (input[inputKey]) {
        options[key] = input[inputKey];
      }
    });

    const enabled =
      inputEnabled === true && enabledCondition(credentials, options);

    const provider = new Document({
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
      messageType: MESSAGE_TYPE_EMAIL,
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
        options.fromEmail &&
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
      messageType: MESSAGE_TYPE_EMAIL,
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
        options.fromEmail && credentials.hasOwnProperty('apiKey'),
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
      messageType: MESSAGE_TYPE_EMAIL,
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
        options.fromEmail && credentials.hasOwnProperty('host'),
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
      messageType: MESSAGE_TYPE_SMS,
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
      messageType: MESSAGE_TYPE_SMS,
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
      messageType: MESSAGE_TYPE_SMS,
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
      messageType: MESSAGE_TYPE_SMS,
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
      messageType: MESSAGE_TYPE_SMS,
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
      messageType: MESSAGE_TYPE_PUSH,
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
      messageType: MESSAGE_TYPE_PUSH,
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

    // Get cursor document if there was a cursor query
    const cursor = queries.find(
      query =>
        [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(query.getMethod())
    );

    if (cursor) {
      const validator = new CursorValidator();
      if (!validator.isValid(cursor)) {
        throw new Exception(
          Exception.GENERAL_QUERY_INVALID,
          validator.getDescription(),
        );
      }

      const providerId = cursor.getValue();
      const cursorDocument = await Authorization.skip(
        async () => await db.getDocument('providers', providerId),
      );

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          `Provider '${providerId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    try {
      const providers = await db.find('providers', queries);
      const total = await db.count('providers', queries);

      return {
        providers,
        total,
      };
    } catch (error) {
      // TODO: OrderException
      if (error instanceof DatabaseError) {
        throw new Exception(
          Exception.DATABASE_QUERY_ORDER_NULL,
          `The order attribute '${(error as any).attribute}' had a null value. Cursor pagination requires all documents order attribute values are non-null.`,
        );
      }
      throw error;
    }
  }

  /**
   * Get Provider
   */
  async getProvider(db: Database, id: string) {
    const provider = await db.getDocument('providers', id);

    if (provider.isEmpty()) {
      throw new Exception(Exception.PROVIDER_NOT_FOUND);
    }

    return provider;
  }

  /**
   * Common method to update a provider.
   */
  private async updateProvider({
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
    updatedFields: Record<string, any>;
    credentialFields: Record<string, string>;
    optionFields: Record<string, string>;
    enabledCondition: (
      credentials: Record<string, any>,
      options: Record<string, any>,
    ) => boolean;
  }) {
    const provider = await db.getDocument('providers', providerId);

    if (provider.isEmpty()) {
      throw new Exception(Exception.PROVIDER_NOT_FOUND);
    }

    if (provider.getAttribute('provider') !== providerType) {
      throw new Exception(Exception.PROVIDER_INCORRECT_TYPE);
    }

    if (updatedFields.name) {
      provider.setAttribute('name', updatedFields.name);
    }

    // Update credentials
    const credentials = provider.getAttribute('credentials') || {};
    Object.entries(credentialFields).forEach(([key, inputKey]) => {
      if (
        updatedFields[inputKey] !== undefined &&
        updatedFields[inputKey] !== ''
      ) {
        credentials[key] = updatedFields[inputKey];
      }
    });
    provider.setAttribute('credentials', credentials);

    // Update options
    const options = provider.getAttribute('options') || {};
    Object.entries(optionFields).forEach(([key, inputKey]) => {
      if (
        updatedFields[inputKey] !== undefined &&
        updatedFields[inputKey] !== ''
      ) {
        options[key] = updatedFields[inputKey];
      }
    });
    provider.setAttribute('options', options);

    // Update enabled status
    if (updatedFields.enabled !== undefined && updatedFields.enabled !== null) {
      if (updatedFields.enabled) {
        if (enabledCondition(credentials, options)) {
          provider.setAttribute('enabled', true);
        } else {
          throw new Exception(Exception.PROVIDER_MISSING_CREDENTIALS);
        }
      } else {
        provider.setAttribute('enabled', false);
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

    if (provider.isEmpty()) {
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

    const topic = new Document({
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

    // Get cursor document if there was a cursor query
    const cursor = queries.find(query =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(query.getMethod())
    );

    if (cursor) {
      const validator = new CursorValidator();
      if (!validator.isValid(cursor)) {
        throw new Exception(
          Exception.GENERAL_QUERY_INVALID,
          validator.getDescription(),
        );
      }

      const topicId = cursor.getValue();
      const cursorDocument = await Authorization.skip(
        async () => await db.getDocument('topics', topicId),
      );

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Topic '${topicId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    try {
      const topics = await db.find('topics', queries);
      const total = await db.count('topics', queries);

      return {
        topics,
        total,
      };
    } catch (error) {
      // TODO: OrderException
      if (error instanceof DatabaseError) {
        throw new Exception(
          Exception.DATABASE_QUERY_ORDER_NULL,
          `The order attribute '${(error as any).attribute}' had a null value. Cursor pagination requires all documents order attribute values are non-null.`,
        );
      }
      throw error;
    }
  }

  /**
   * Get Topic
   */
  async getTopic(db: Database, id: string) {
    const topic = await db.getDocument('topics', id);

    if (topic.isEmpty()) {
      throw new Exception(Exception.TOPIC_NOT_FOUND);
    }

    return topic;
  }

}
