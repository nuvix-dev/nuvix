import { Doc, ID, Query, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'
import type { Providers } from '../../types/generated'
import { formatProvider, type ProviderView } from './formatter'

export interface BaseProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
}

export interface MailgunProviderInput extends BaseProviderInput {
  apiKey?: string
  domain?: string
  isEuRegion?: boolean
  fromName?: string
  fromEmail?: string
  replyToName?: string
  replyToEmail?: string
}

export interface SendgridProviderInput extends BaseProviderInput {
  apiKey?: string
  fromName?: string
  fromEmail?: string
  replyToName?: string
  replyToEmail?: string
}

export interface SmtpProviderInput extends BaseProviderInput {
  host?: string
  port?: number
  username?: string
  password?: string
  encryption?: string
  autoTls?: boolean
  mailer?: string
  fromName?: string
  fromEmail?: string
  replyToName?: string
  replyToEmail?: string
}

export interface TwilioProviderInput extends BaseProviderInput {
  accountSid?: string
  authToken?: string
  from?: string
}

export interface TextmagicProviderInput extends BaseProviderInput {
  username?: string
  apiKey?: string
  from?: string
}

export interface VonageProviderInput extends BaseProviderInput {
  apiKey?: string
  apiSecret?: string
  from?: string
}

export interface Msg91ProviderInput extends BaseProviderInput {
  authKey?: string
  senderId?: string
  templateId?: string
}

export interface TelesignProviderInput extends BaseProviderInput {
  customerId?: string
  apiKey?: string
  from?: string
}

export interface FcmProviderInput extends BaseProviderInput {
  serviceAccountJSON?: string | Record<string, unknown>
}

export interface ApnsProviderInput extends BaseProviderInput {
  authKey?: string
  authKeyId?: string
  teamId?: string
  bundleId?: string
  sandbox?: boolean
}

export class ProvidersService {
  constructor(private readonly session: Session) {}

  /**
   * Common helper to create a provider doc.
   */
  private async createProvider<T extends BaseProviderInput>(
    input: T,
    providerType: string,
    messageType: string,
    credentialFields: Record<string, keyof T>,
    optionFields: Record<string, keyof T>,
  ): Promise<ProviderView> {
    const providerId =
      !input.providerId || input.providerId === 'unique()' ? ID.unique() : input.providerId

    const existing = await this.session.getDocument('providers', providerId)
    if (!existing.empty()) {
      throw new ConflictError('Provider already exists', {
        code: 'messaging_provider_already_exists',
      })
    }

    const credentials: Record<string, unknown> = {}
    const options: Record<string, unknown> = {}

    for (const [key, inputKey] of Object.entries(credentialFields)) {
      if (input[inputKey] !== undefined) {
        credentials[key] = input[inputKey]
      }
    }
    for (const [key, inputKey] of Object.entries(optionFields)) {
      if (input[inputKey] !== undefined) {
        options[key] = input[inputKey]
      }
    }

    const providerDoc = new Doc<Providers>({
      $id: providerId,
      name: input.name,
      provider: providerType,
      type: messageType,
      enabled: input.enabled ?? true,
      credentials,
      options,
      search: [providerId, input.name, providerType, messageType].join(' '),
    })

    const created = await this.session.createDocument('providers', providerDoc)
    return formatProvider(created)
  }

  /**
   * Common helper to update a provider doc.
   */
  private async updateProvider<T extends Partial<BaseProviderInput>>(
    providerId: string,
    input: T,
    credentialFields: Record<string, keyof T>,
    optionFields: Record<string, keyof T>,
  ): Promise<ProviderView> {
    const doc = await this.session.getDocument('providers', providerId)
    if (doc.empty()) {
      throw new NotFoundError('Provider not found', {
        code: 'messaging_provider_not_found',
      })
    }

    if (input.name !== undefined) {
      doc.set('name', input.name)
      doc.set('search', [providerId, input.name, doc.get('provider'), doc.get('type')].join(' '))
    }
    if (input.enabled !== undefined) {
      doc.set('enabled', input.enabled)
    }

    const credentials = (doc.get('credentials') as Record<string, unknown>) ?? {}
    for (const [key, inputKey] of Object.entries(credentialFields)) {
      if (input[inputKey] !== undefined) {
        credentials[key] = input[inputKey]
      }
    }
    doc.set('credentials', credentials)

    const options = (doc.get('options') as Record<string, unknown>) ?? {}
    for (const [key, inputKey] of Object.entries(optionFields)) {
      if (input[inputKey] !== undefined) {
        options[key] = input[inputKey]
      }
    }
    doc.set('options', options)

    const updated = await this.session.updateDocument('providers', providerId, doc)
    return formatProvider(updated)
  }

  // --- Email Providers ---

  async createMailgunProvider(input: MailgunProviderInput): Promise<ProviderView> {
    return this.createProvider(
      input,
      'mailgun',
      'email',
      { isEuRegion: 'isEuRegion', apiKey: 'apiKey', domain: 'domain' },
      {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
    )
  }

  async updateMailgunProvider(
    providerId: string,
    input: Partial<MailgunProviderInput>,
  ): Promise<ProviderView> {
    return this.updateProvider(
      providerId,
      input,
      { isEuRegion: 'isEuRegion', apiKey: 'apiKey', domain: 'domain' },
      {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
    )
  }

  async createSendgridProvider(input: SendgridProviderInput): Promise<ProviderView> {
    return this.createProvider(
      input,
      'sendgrid',
      'email',
      { apiKey: 'apiKey' },
      {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
    )
  }

  async updateSendgridProvider(
    providerId: string,
    input: Partial<SendgridProviderInput>,
  ): Promise<ProviderView> {
    return this.updateProvider(
      providerId,
      input,
      { apiKey: 'apiKey' },
      {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
    )
  }

  async createSmtpProvider(input: SmtpProviderInput): Promise<ProviderView> {
    return this.createProvider(
      input,
      'smtp',
      'email',
      {
        host: 'host',
        port: 'port',
        username: 'username',
        password: 'password',
        encryption: 'encryption',
        autoTls: 'autoTls',
        mailer: 'mailer',
      },
      {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
    )
  }

  async updateSmtpProvider(
    providerId: string,
    input: Partial<SmtpProviderInput>,
  ): Promise<ProviderView> {
    return this.updateProvider(
      providerId,
      input,
      {
        host: 'host',
        port: 'port',
        username: 'username',
        password: 'password',
        encryption: 'encryption',
        autoTls: 'autoTls',
        mailer: 'mailer',
      },
      {
        fromName: 'fromName',
        fromEmail: 'fromEmail',
        replyToName: 'replyToName',
        replyToEmail: 'replyToEmail',
      },
    )
  }

  // --- SMS Providers ---

  async createTwilioProvider(input: TwilioProviderInput): Promise<ProviderView> {
    return this.createProvider(
      input,
      'twilio',
      'sms',
      { accountSid: 'accountSid', authToken: 'authToken' },
      { from: 'from' },
    )
  }

  async updateTwilioProvider(
    providerId: string,
    input: Partial<TwilioProviderInput>,
  ): Promise<ProviderView> {
    return this.updateProvider(
      providerId,
      input,
      { accountSid: 'accountSid', authToken: 'authToken' },
      { from: 'from' },
    )
  }

  async createTextmagicProvider(input: TextmagicProviderInput): Promise<ProviderView> {
    return this.createProvider(
      input,
      'textmagic',
      'sms',
      { username: 'username', apiKey: 'apiKey' },
      { from: 'from' },
    )
  }

  async updateTextmagicProvider(
    providerId: string,
    input: Partial<TextmagicProviderInput>,
  ): Promise<ProviderView> {
    return this.updateProvider(
      providerId,
      input,
      { username: 'username', apiKey: 'apiKey' },
      { from: 'from' },
    )
  }

  async createVonageProvider(input: VonageProviderInput): Promise<ProviderView> {
    return this.createProvider(
      input,
      'vonage',
      'sms',
      { apiKey: 'apiKey', apiSecret: 'apiSecret' },
      { from: 'from' },
    )
  }

  async updateVonageProvider(
    providerId: string,
    input: Partial<VonageProviderInput>,
  ): Promise<ProviderView> {
    return this.updateProvider(
      providerId,
      input,
      { apiKey: 'apiKey', apiSecret: 'apiSecret' },
      { from: 'from' },
    )
  }

  async createMsg91Provider(input: Msg91ProviderInput): Promise<ProviderView> {
    return this.createProvider(
      input,
      'msg91',
      'sms',
      { authKey: 'authKey' },
      { senderId: 'senderId', templateId: 'templateId' },
    )
  }

  async updateMsg91Provider(
    providerId: string,
    input: Partial<Msg91ProviderInput>,
  ): Promise<ProviderView> {
    return this.updateProvider(
      providerId,
      input,
      { authKey: 'authKey' },
      { senderId: 'senderId', templateId: 'templateId' },
    )
  }

  async createTelesignProvider(input: TelesignProviderInput): Promise<ProviderView> {
    return this.createProvider(
      input,
      'telesign',
      'sms',
      { customerId: 'customerId', apiKey: 'apiKey' },
      { from: 'from' },
    )
  }

  async updateTelesignProvider(
    providerId: string,
    input: Partial<TelesignProviderInput>,
  ): Promise<ProviderView> {
    return this.updateProvider(
      providerId,
      input,
      { customerId: 'customerId', apiKey: 'apiKey' },
      { from: 'from' },
    )
  }

  // --- Push Providers ---

  async createFcmProvider(input: FcmProviderInput): Promise<ProviderView> {
    const creds =
      typeof input.serviceAccountJSON === 'string'
        ? JSON.parse(input.serviceAccountJSON)
        : input.serviceAccountJSON
    return this.createProvider(
      { ...input, serviceAccountJSON: creds },
      'fcm',
      'push',
      { serviceAccountJSON: 'serviceAccountJSON' },
      {},
    )
  }

  async updateFcmProvider(
    providerId: string,
    input: Partial<FcmProviderInput>,
  ): Promise<ProviderView> {
    const creds =
      typeof input.serviceAccountJSON === 'string'
        ? JSON.parse(input.serviceAccountJSON)
        : input.serviceAccountJSON
    return this.updateProvider(
      providerId,
      { ...input, serviceAccountJSON: creds },
      { serviceAccountJSON: 'serviceAccountJSON' },
      {},
    )
  }

  async createApnsProvider(input: ApnsProviderInput): Promise<ProviderView> {
    return this.createProvider(
      input,
      'apns',
      'push',
      { authKey: 'authKey', authKeyId: 'authKeyId', teamId: 'teamId', bundleId: 'bundleId' },
      { sandbox: 'sandbox' },
    )
  }

  async updateApnsProvider(
    providerId: string,
    input: Partial<ApnsProviderInput>,
  ): Promise<ProviderView> {
    return this.updateProvider(
      providerId,
      input,
      { authKey: 'authKey', authKeyId: 'authKeyId', teamId: 'teamId', bundleId: 'bundleId' },
      { sandbox: 'sandbox' },
    )
  }

  // --- List, Get, Delete ---

  async listProviders(
    queries: Query[] = [],
    search?: string,
  ): Promise<{ total: number; providers: ProviderView[] }> {
    const q = [...queries]
    if (search) {
      q.push(Query.search('search', search))
    }
    const filterQueries = Query.groupByType(q).filters

    const docs = await this.session.find('providers', q)
    const total = await this.session.count('providers', filterQueries)

    return { total, providers: docs.map(formatProvider) }
  }

  async getProvider(providerId: string): Promise<ProviderView> {
    const doc = await this.session.getDocument('providers', providerId)
    if (doc.empty()) {
      throw new NotFoundError('Provider not found', {
        code: 'messaging_provider_not_found',
      })
    }
    return formatProvider(doc)
  }

  async deleteProvider(providerId: string): Promise<void> {
    const doc = await this.session.getDocument('providers', providerId)
    if (doc.empty()) {
      throw new NotFoundError('Provider not found', {
        code: 'messaging_provider_not_found',
      })
    }
    await this.session.deleteDocument('providers', providerId)
  }
}
