import { ID } from '@nuvix/core'
import { Doc, Query, type Session } from '@nuvix/db'
import { ConflictError, NotFoundError } from '../../shared/errors'
import type { Providers } from '../../types/generated'
import { formatProvider } from './formatter'
import type {
  CreateApnsProviderInput,
  CreateFcmProviderInput,
  CreateMailgunProviderInput,
  CreateMsg91ProviderInput,
  CreateSendgridProviderInput,
  CreateSmtpProviderInput,
  CreateTelesignProviderInput,
  CreateTextmagicProviderInput,
  CreateTwilioProviderInput,
  CreateVonageProviderInput,
  ProviderView,
  UpdateApnsProviderInput,
  UpdateFcmProviderInput,
  UpdateMailgunProviderInput,
  UpdateMsg91ProviderInput,
  UpdateSendgridProviderInput,
  UpdateSmtpProviderInput,
  UpdateTelesignProviderInput,
  UpdateTextmagicProviderInput,
  UpdateTwilioProviderInput,
  UpdateVonageProviderInput,
} from './types'

// ---------- helpers ----------

function providerEnabled(credentials: Record<string, unknown>): boolean {
  return Object.values(credentials).some((v) => v !== undefined && v !== null && v !== '')
}

async function createProvider(
  session: Session,
  opts: {
    providerId?: string
    name: string
    enabled?: boolean
    providerType: string
    channelType: string
    credentials: Record<string, unknown>
    options: Record<string, unknown>
  },
): Promise<ProviderView> {
  const docId = opts.providerId && opts.providerId !== 'unique()' ? opts.providerId : ID.unique()
  const enabled = (opts.enabled ?? true) && providerEnabled(opts.credentials)

  const doc = new Doc<Providers>({
    $id: docId,
    name: opts.name,
    provider: opts.providerType,
    type: opts.channelType,
    enabled,
    credentials: opts.credentials,
    options: opts.options,
  })

  try {
    const created = await session.createDocument('providers', doc)
    return formatProvider(created)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('duplicate') || msg.includes('unique')) {
      throw new ConflictError('Provider already exists', { code: 'provider_already_exists' })
    }
    throw err
  }
}

async function patchProvider(
  session: Session,
  providerId: string,
  credentials: Record<string, unknown>,
  options: Record<string, unknown>,
  patch: { name?: string; enabled?: boolean },
): Promise<ProviderView> {
  const doc = await session.getDocument('providers', providerId).catch(() => null)
  if (!doc || doc.empty()) {
    throw new NotFoundError('Provider not found', { code: 'provider_not_found' })
  }

  const merged = {
    credentials: { ...(doc.get('credentials') as Record<string, unknown>), ...credentials },
    options: { ...(doc.get('options') as Record<string, unknown>), ...options },
  }

  if (patch.name !== undefined) doc.set('name', patch.name)
  if (patch.enabled !== undefined) {
    const isEnabled = patch.enabled && providerEnabled(merged.credentials)
    doc.set('enabled', isEnabled)
  }
  doc.set('credentials', merged.credentials)
  doc.set('options', merged.options)

  const updated = await session.updateDocument('providers', providerId, doc)
  return formatProvider(updated)
}

// ---------- ProvidersService ----------

export class ProvidersService {
  constructor(private readonly session: Session) {}

  async listProviders(opts: {
    limit?: number
    offset?: number
    type?: string
  }): Promise<{ providers: ProviderView[]; total: number }> {
    const limit = opts.limit ?? 25
    const offset = opts.offset ?? 0
    const queries: Query[] = [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc('$createdAt'),
    ]

    if (opts.type) {
      queries.push(Query.equal('type', [opts.type]))
    }

    const countQueries = opts.type ? [Query.equal('type', [opts.type])] : []
    const docs = await this.session.find('providers', queries)
    const total = await this.session.count('providers', countQueries)

    return { providers: docs.map(formatProvider), total }
  }

  async getProvider(providerId: string): Promise<ProviderView> {
    const doc = await this.session.getDocument('providers', providerId).catch(() => null)
    if (!doc || doc.empty()) {
      throw new NotFoundError('Provider not found', { code: 'provider_not_found' })
    }
    return formatProvider(doc)
  }

  async deleteProvider(providerId: string): Promise<void> {
    const doc = await this.session.getDocument('providers', providerId).catch(() => null)
    if (!doc || doc.empty()) {
      throw new NotFoundError('Provider not found', { code: 'provider_not_found' })
    }
    await this.session.deleteDocument('providers', providerId)
  }

  // ---- Email providers ----

  async createMailgun(input: CreateMailgunProviderInput): Promise<ProviderView> {
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'mailgun',
      channelType: 'email',
      credentials: {
        apiKey: input.apiKey,
        domain: input.domain,
        isEuRegion: input.isEuRegion ?? false,
      },
      options: {
        fromName: input.fromName,
        fromEmail: input.fromEmail,
        replyToName: input.replyToName,
        replyToEmail: input.replyToEmail,
      },
    })
  }

  async updateMailgun(
    providerId: string,
    input: UpdateMailgunProviderInput,
  ): Promise<ProviderView> {
    return patchProvider(
      this.session,
      providerId,
      {
        ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
        ...(input.domain !== undefined && { domain: input.domain }),
        ...(input.isEuRegion !== undefined && { isEuRegion: input.isEuRegion }),
      },
      {
        ...(input.fromName !== undefined && { fromName: input.fromName }),
        ...(input.fromEmail !== undefined && { fromEmail: input.fromEmail }),
        ...(input.replyToName !== undefined && { replyToName: input.replyToName }),
        ...(input.replyToEmail !== undefined && { replyToEmail: input.replyToEmail }),
      },
      { name: input.name, enabled: input.enabled },
    )
  }

  async createSendgrid(input: CreateSendgridProviderInput): Promise<ProviderView> {
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'sendgrid',
      channelType: 'email',
      credentials: { apiKey: input.apiKey },
      options: {
        fromName: input.fromName,
        fromEmail: input.fromEmail,
        replyToName: input.replyToName,
        replyToEmail: input.replyToEmail,
      },
    })
  }

  async updateSendgrid(
    providerId: string,
    input: UpdateSendgridProviderInput,
  ): Promise<ProviderView> {
    return patchProvider(
      this.session,
      providerId,
      { ...(input.apiKey !== undefined && { apiKey: input.apiKey }) },
      {
        ...(input.fromName !== undefined && { fromName: input.fromName }),
        ...(input.fromEmail !== undefined && { fromEmail: input.fromEmail }),
        ...(input.replyToName !== undefined && { replyToName: input.replyToName }),
        ...(input.replyToEmail !== undefined && { replyToEmail: input.replyToEmail }),
      },
      { name: input.name, enabled: input.enabled },
    )
  }

  async createSmtp(input: CreateSmtpProviderInput): Promise<ProviderView> {
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'smtp',
      channelType: 'email',
      credentials: {
        host: input.host,
        port: input.port ?? 587,
        username: input.username,
        password: input.password,
        encryption: input.encryption ?? 'none',
        autoTls: input.autoTls ?? false,
        mailer: input.mailer,
      },
      options: {
        fromName: input.fromName,
        fromEmail: input.fromEmail,
        replyToName: input.replyToName,
        replyToEmail: input.replyToEmail,
      },
    })
  }

  async updateSmtp(providerId: string, input: UpdateSmtpProviderInput): Promise<ProviderView> {
    return patchProvider(
      this.session,
      providerId,
      {
        ...(input.host !== undefined && { host: input.host }),
        ...(input.port !== undefined && { port: input.port }),
        ...(input.username !== undefined && { username: input.username }),
        ...(input.password !== undefined && { password: input.password }),
        ...(input.encryption !== undefined && { encryption: input.encryption }),
        ...(input.autoTls !== undefined && { autoTls: input.autoTls }),
        ...(input.mailer !== undefined && { mailer: input.mailer }),
      },
      {
        ...(input.fromName !== undefined && { fromName: input.fromName }),
        ...(input.fromEmail !== undefined && { fromEmail: input.fromEmail }),
        ...(input.replyToName !== undefined && { replyToName: input.replyToName }),
        ...(input.replyToEmail !== undefined && { replyToEmail: input.replyToEmail }),
      },
      { name: input.name, enabled: input.enabled },
    )
  }

  // ---- SMS providers ----

  async createTwilio(input: CreateTwilioProviderInput): Promise<ProviderView> {
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'twilio',
      channelType: 'sms',
      credentials: { accountSid: input.accountSid, authToken: input.authToken },
      options: { from: input.from },
    })
  }

  async updateTwilio(providerId: string, input: UpdateTwilioProviderInput): Promise<ProviderView> {
    return patchProvider(
      this.session,
      providerId,
      {
        ...(input.accountSid !== undefined && { accountSid: input.accountSid }),
        ...(input.authToken !== undefined && { authToken: input.authToken }),
      },
      { ...(input.from !== undefined && { from: input.from }) },
      { name: input.name, enabled: input.enabled },
    )
  }

  async createVonage(input: CreateVonageProviderInput): Promise<ProviderView> {
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'vonage',
      channelType: 'sms',
      credentials: { apiKey: input.apiKey, apiSecret: input.apiSecret },
      options: { from: input.from },
    })
  }

  async updateVonage(providerId: string, input: UpdateVonageProviderInput): Promise<ProviderView> {
    return patchProvider(
      this.session,
      providerId,
      {
        ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
        ...(input.apiSecret !== undefined && { apiSecret: input.apiSecret }),
      },
      { ...(input.from !== undefined && { from: input.from }) },
      { name: input.name, enabled: input.enabled },
    )
  }

  async createMsg91(input: CreateMsg91ProviderInput): Promise<ProviderView> {
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'msg91',
      channelType: 'sms',
      credentials: {
        authKey: input.authKey,
        senderId: input.senderId,
        templateId: input.templateId,
      },
      options: {},
    })
  }

  async updateMsg91(providerId: string, input: UpdateMsg91ProviderInput): Promise<ProviderView> {
    return patchProvider(
      this.session,
      providerId,
      {
        ...(input.authKey !== undefined && { authKey: input.authKey }),
        ...(input.senderId !== undefined && { senderId: input.senderId }),
        ...(input.templateId !== undefined && { templateId: input.templateId }),
      },
      {},
      { name: input.name, enabled: input.enabled },
    )
  }

  async createTelesign(input: CreateTelesignProviderInput): Promise<ProviderView> {
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'telesign',
      channelType: 'sms',
      credentials: { customerId: input.customerId, apiKey: input.apiKey },
      options: { from: input.from },
    })
  }

  async updateTelesign(
    providerId: string,
    input: UpdateTelesignProviderInput,
  ): Promise<ProviderView> {
    return patchProvider(
      this.session,
      providerId,
      {
        ...(input.customerId !== undefined && { customerId: input.customerId }),
        ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
      },
      { ...(input.from !== undefined && { from: input.from }) },
      { name: input.name, enabled: input.enabled },
    )
  }

  async createTextmagic(input: CreateTextmagicProviderInput): Promise<ProviderView> {
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'textmagic',
      channelType: 'sms',
      credentials: { username: input.username, apiKey: input.apiKey },
      options: { from: input.from },
    })
  }

  async updateTextmagic(
    providerId: string,
    input: UpdateTextmagicProviderInput,
  ): Promise<ProviderView> {
    return patchProvider(
      this.session,
      providerId,
      {
        ...(input.username !== undefined && { username: input.username }),
        ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
      },
      { ...(input.from !== undefined && { from: input.from }) },
      { name: input.name, enabled: input.enabled },
    )
  }

  // ---- Push providers ----

  async createFcm(input: CreateFcmProviderInput): Promise<ProviderView> {
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(input.serviceAccount) as Record<string, unknown>
    } catch {
      parsed = { serviceAccount: input.serviceAccount }
    }
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'fcm',
      channelType: 'push',
      credentials: { serviceAccount: parsed },
      options: {},
    })
  }

  async updateFcm(providerId: string, input: UpdateFcmProviderInput): Promise<ProviderView> {
    const creds: Record<string, unknown> = {}
    if (input.serviceAccount !== undefined) {
      try {
        creds.serviceAccount = JSON.parse(input.serviceAccount) as Record<string, unknown>
      } catch {
        creds.serviceAccount = input.serviceAccount
      }
    }
    return patchProvider(
      this.session,
      providerId,
      creds,
      {},
      { name: input.name, enabled: input.enabled },
    )
  }

  async createApns(input: CreateApnsProviderInput): Promise<ProviderView> {
    return createProvider(this.session, {
      providerId: input.providerId,
      name: input.name,
      enabled: input.enabled,
      providerType: 'apns',
      channelType: 'push',
      credentials: {
        authKey: input.authKey,
        keyId: input.keyId,
        teamId: input.teamId,
        bundleId: input.bundleId,
      },
      options: { sandbox: input.sandbox ?? false },
    })
  }

  async updateApns(providerId: string, input: UpdateApnsProviderInput): Promise<ProviderView> {
    return patchProvider(
      this.session,
      providerId,
      {
        ...(input.authKey !== undefined && { authKey: input.authKey }),
        ...(input.keyId !== undefined && { keyId: input.keyId }),
        ...(input.teamId !== undefined && { teamId: input.teamId }),
        ...(input.bundleId !== undefined && { bundleId: input.bundleId }),
      },
      { ...(input.sandbox !== undefined && { sandbox: input.sandbox }) },
      { name: input.name, enabled: input.enabled },
    )
  }
}
