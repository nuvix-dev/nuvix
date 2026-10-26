/**
 * Messaging worker — Bun-native port of legacy `MessagingQueue`
 * (`sendExternalMessage`): delivers queued Email/SMS/Push messages to
 * their resolved targets through the tenant's enabled providers.
 *
 * Flow (v1 parity):
 *  1. Load the message (idempotency skip on `sent`).
 *  2. Resolve targets from `topics` (topic.targets ∩ providerType),
 *     `users` (user.targets), and direct `targets`.
 *  3. No targets → fail the message with a recorded delivery error.
 *  4. Resolve the default enabled provider for the message type; group
 *     target identifiers by the target's own `providerId` (falling back
 *     to the default provider).
 *  5. Per provider: chunk identifiers by the vendor adapter's
 *     per-request batch limit, send, and collect results — expired push
 *     tokens mark their target `expired`.
 *  6. Finalize: `sent` unless (pre-existing or fresh) errors with zero
 *     deliveries; record `deliveredTotal`/`deliveredAt` and extend the
 *     search index with the involved providers.
 *
 * Job payloads carry `projectId`; the worker resolves the tenant
 * connection through the platform registry + tenant pool (D20/D41), and
 * DB calls run on the tenant's auth-system session (messages, targets,
 * topics and providers live in the `auth` schema).
 */

import { Doc, Query, type Session } from '@nuvix/db'
import type { Job } from 'bullmq'

export interface MessagingJobData {
  /** Platform project id — resolves the tenant database. */
  projectId: string
  /**
   * Message id (scheduled jobs) or the full message record (inline
   * enqueue at create, v1 `MessagingJob.EXTERNAL` parity).
   */
  message: string | Record<string, unknown>
  /** Schedule document id — deleted after a scheduled message delivers. */
  scheduleId?: string
}

type MessageTypeValue = 'email' | 'sms' | 'push'

/** Any-typed document (collection records carry arbitrary attributes). */
// biome-ignore lint/suspicious/noExplicitAny: dynamic tenant records
type AnyDoc = Doc<any>

interface DeliveryResultLike {
  recipient: string
  status: 'success' | 'failure'
  error: string
}

interface BatchSendResult {
  deliveredTo: number
  results: DeliveryResultLike[]
}

/** Provider fields the send boundary needs (plain snapshot). */
interface ProviderSnapshot {
  provider: string
  type: string
  name?: string
  credentials: Record<string, unknown>
  options: Record<string, unknown>
}

/**
 * Injectable send boundary (tests stub this; prod builds the vendor
 * adapter mirroring v1's `get{Email,Push,Sms}Adapter`).
 */
export interface MessageSender {
  /** Max recipients per request for this provider (adapter constant). */
  batchLimit(params: { messageType: MessageTypeValue; provider: ProviderSnapshot }): Promise<number>
  /** Send one batch. */
  send(params: {
    messageType: MessageTypeValue
    provider: ProviderSnapshot
    /** Fully-built per-batch payload (v1 Email/SMS/Push inputs). */
    payload: {
      to: string[]
      data: Record<string, unknown>
    }
  }): Promise<BatchSendResult>
}

/** Vendor per-request batch limits (mirror adapter constants 1:1). */
const VENDOR_BATCH_LIMITS: Record<MessageTypeValue, Record<string, number>> = {
  email: { mailgun: 1000, sendgrid: 1000, smtp: 1000 },
  sms: { msg91: 100, telesign: 1000, textmagic: 1000, twilio: 1, vonage: 1 },
  push: { apns: 5000, fcm: 5000 },
}

let sender: MessageSender = {
  async batchLimit({ messageType, provider }) {
    return VENDOR_BATCH_LIMITS[messageType][provider.provider] ?? 1
  },
  send: prodSend,
}

/** Overrides the send boundary (tests). */
export function setMessageSender(custom: MessageSender): void {
  sender = custom
}

async function prodSend(params: {
  messageType: MessageTypeValue
  provider: ProviderSnapshot
  payload: { to: string[]; data: Record<string, unknown> }
}): Promise<BatchSendResult> {
  const messaging = await import('@nuvix/messaging')
  const kind = params.provider.provider
  const credentials = params.provider.credentials
  const options = params.provider.options

  if (params.messageType === 'email') {
    let adapter: InstanceType<typeof messaging.EmailAdapter>
    if (kind === 'smtp') {
      adapter = new messaging.SMTP(
        str(credentials.host, ''),
        num(credentials.port, 25),
        str(credentials.username, ''),
        str(credentials.password, ''),
      )
    } else if (kind === 'mailgun') {
      adapter = new messaging.Mailgun(
        str(credentials.apiKey, ''),
        str(credentials.domain, ''),
        bool(credentials.isEuRegion, false),
      )
    } else if (kind === 'sendgrid') {
      adapter = new messaging.Sendgrid(str(credentials.apiKey, ''))
    } else {
      throw new Error(`Unsupported email provider: ${kind}`)
    }

    const d = params.payload.data
    const email = new messaging.Email({
      to: params.payload.to,
      subject: str(d.subject, ''),
      content: str(d.content, ''),
      fromName: str(options.fromName, ''),
      fromEmail: str(options.fromEmail, ''),
      replyToName: strOpt(options.replyToName),
      replyToEmail: strOpt(options.replyToEmail),
      cc: d.cc as never,
      bcc: d.bcc as never,
      attachments: d.attachments as never,
      html: bool(d.html, false),
    })
    const result = await adapter.send(email)
    return normalize(result)
  }

  if (params.messageType === 'sms') {
    let adapter: InstanceType<typeof messaging.SMSAdapter>
    switch (kind) {
      case 'twilio':
        adapter = new messaging.Twilio(
          str(credentials.accountSid, ''),
          str(credentials.authToken, ''),
          strOpt(options.from),
          strOpt(credentials.messagingServiceSid),
        )
        break
      case 'telesign':
        adapter = new messaging.Telesign(
          str(credentials.customerId, ''),
          str(credentials.apiKey, ''),
        )
        break
      case 'textmagic':
        adapter = new messaging.TextMagic(
          str(credentials.username, ''),
          str(credentials.apiKey, ''),
        )
        break
      case 'vonage':
        adapter = new messaging.Vonage(str(credentials.apiKey, ''), str(credentials.apiSecret, ''))
        break
      case 'msg91':
        adapter = new messaging.Msg91(
          str(credentials.senderId, ''),
          str(credentials.authKey, ''),
          str(credentials.templateId, ''),
        )
        break
      default:
        throw new Error(`Unsupported SMS provider: ${kind}`)
    }

    const sms = new messaging.SMS(
      params.payload.to,
      str(params.payload.data.content, ''),
      strOpt(options.from),
    )
    const result = await adapter.send(sms)
    return normalize(result)
  }

  // push
  let adapter: InstanceType<typeof messaging.PushAdapter>
  if (kind === 'fcm') {
    adapter = new messaging.FCM(JSON.stringify(credentials.serviceAccountJSON ?? ''))
  } else if (kind === 'apns') {
    adapter = new messaging.APNS(
      str(credentials.authKey, ''),
      str(credentials.authKeyId, ''),
      str(credentials.teamId, ''),
      str(credentials.bundleId, ''),
      bool(options.sandbox, false),
    )
  } else {
    throw new Error(`Unsupported push provider: ${kind}`)
  }

  const d = params.payload.data
  // Image arrives as a resolved URL string (refs resolved in
  // `deliverExternalMessage`); object carriers pass their `.url`.
  const rawImage: unknown = d.image
  const imageUrl =
    typeof rawImage === 'string'
      ? rawImage
      : ((rawImage as { url?: string } | null | undefined)?.url ?? undefined)
  const push = new messaging.Push({
    to: params.payload.to,
    title: strOpt(d.title),
    body: strOpt(d.body),
    data: (d.data as Record<string, unknown> | undefined) ?? undefined,
    action: strOpt(d.action),
    image: imageUrl,
    icon: strOpt(d.icon),
    sound: strOpt(d.sound),
    color: strOpt(d.color),
    tag: strOpt(d.tag),
    badge: typeof d.badge === 'number' ? d.badge : undefined,
    contentAvailable: d.contentAvailable === true ? true : undefined,
    critical: d.critical === true ? true : undefined,
    priority:
      d.priority === 'high'
        ? messaging.Priority.HIGH
        : d.priority === 'normal'
          ? messaging.Priority.NORMAL
          : undefined,
  })
  const result = await adapter.send(push)
  return normalize(result)
}

/** Coerce the library's single/multi response shape to one batch result. */
function normalize(result: unknown): BatchSendResult {
  if (result && typeof result === 'object' && 'deliveredTo' in result && 'results' in result) {
    const r = result as { deliveredTo: number; results: DeliveryResultLike[] }
    return { deliveredTo: r.deliveredTo, results: r.results }
  }
  // Multi-type response (unexpected on a single-adapter send): zero out.
  return { deliveredTo: 0, results: [] }
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function strOpt(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export interface MessagingDeps {
  session: Session
  /** Platform project id — resolves push-image signed URLs. */
  projectId?: string
}

/** Tenant session resolver boundary (overridable in tests). */
export type SessionResolver = (projectId: string) => Promise<Session>

let sessionResolver: SessionResolver = defaultResolveSession

/** Overrides the tenant-session resolver (tests). */
export function setMessagingSessionResolver(custom: SessionResolver): void {
  sessionResolver = custom
}

async function defaultResolveSession(projectId: string): Promise<Session> {
  const { createPlatformDatabase, ProjectRegistry } = await import('@nuvix/core/platform')
  const { TenantResourcePool } = await import('@nuvix/core/tenants')
  const { config } = await import('@nuvix/utils')

  const platformDb = await createPlatformDatabase({
    driver: config.platform.dbDriver,
    url: config.platform.dbUrl,
    encryptionKey: config.platform.tenantEncryptionKey,
  })
  const registry = new ProjectRegistry(platformDb)
  const pool = new TenantResourcePool()
  const resolved = await registry.getProjectTarget(projectId)
  if (!resolved) {
    throw new Error(`[messaging] unknown project: ${projectId}`)
  }
  const resource = await pool.get(resolved)
  return resource.authSystemSession()
}

/**
 * Load the message document: scheduled jobs carry only the id and are
 * re-read from the tenant DB; create-time jobs pass the full record.
 */
async function loadMessage(session: Session, data: MessagingJobData): Promise<AnyDoc | null> {
  if (typeof data.message === 'string') {
    const doc = await session.getDocument('messages', data.message)
    return doc.empty() ? null : (doc as AnyDoc)
  }
  return new Doc(data.message) as AnyDoc
}

/**
 * Resolves delivery targets for a message (topics → users → direct
 * targets, all filtered by the message's provider type) — v1 parity.
 */
async function resolveTargets(session: Session, message: Doc): Promise<Doc[]> {
  const providerType = message.get('providerType') as string
  const topicIds = (message.get('topics') as string[]) ?? []
  const userIds = (message.get('users') as string[]) ?? []
  const targetIds = (message.get('targets') as string[]) ?? []

  const allTargets: AnyDoc[] = []

  if (topicIds.length > 0) {
    const topics = await session.find('topics', [
      Query.equal('$id', topicIds),
      Query.limit(topicIds.length),
    ])
    for (const topic of topics) {
      const targets = (topic.get('targets') as AnyDoc[]) ?? []
      allTargets.push(...targets.filter((t) => t.get('providerType') === providerType))
    }
  }

  if (userIds.length > 0) {
    const users = await session.find('users', [
      Query.equal('$id', userIds),
      Query.limit(userIds.length),
    ])
    for (const user of users) {
      const targets = (user.get('targets') as AnyDoc[]) ?? []
      allTargets.push(...targets.filter((t) => t.get('providerType') === providerType))
    }
  }

  if (targetIds.length > 0) {
    const targets = (await session.find('targets', [
      Query.equal('$id', targetIds),
      Query.equal('providerType', [providerType]),
      Query.limit(targetIds.length),
    ])) as AnyDoc[]
    allTargets.push(...targets)
  }

  return allTargets
}

/**
 * Resolve cc/bcc target ids to identifiers (v1 buildEmailMessage parity).
 * Storage-backed attachments are deferred to a follow-up slice (v1 read
 * them through the storage device; the resolution boundary is kept — the
 * send payload carries the RawBucket/File references onward).
 */
async function buildEmailExtras(
  session: Session,
  data: Record<string, unknown>,
): Promise<{ cc: string[]; bcc: string[]; attachments: unknown[] }> {
  const resolveIds = async (ids: unknown): Promise<string[]> => {
    const list = Array.isArray(ids) ? (ids as string[]) : []
    if (list.length === 0) return []
    const docs = (await session.find('targets', [
      Query.equal('$id', list),
      Query.limit(list.length),
    ])) as AnyDoc[]
    return docs.map((t) => String(t.get('identifier') ?? '')).filter((v) => v.length > 0)
  }

  return {
    cc: await resolveIds(data.cc),
    bcc: await resolveIds(data.bcc),
    attachments: await resolveAttachments(session, data.attachments),
  }
}

/**
 * Resolves `{bucketId, fileId}` attachment snapshots to vendor
 * `Attachment` payloads (v1 `buildEmailMessage` parity): file bytes are
 * read from the storage device at delivery time; missing
 * buckets/files/devices become send errors (v1 threw into the delivery
 * error path).
 */
async function resolveAttachments(session: Session, attachments: unknown): Promise<unknown[]> {
  const refs = Array.isArray(attachments) ? attachments : []
  if (refs.length === 0) return []

  const { Local } = await import('@nuvix/storage')
  const device = new Local()
  const resolved: unknown[] = []

  for (const ref of refs) {
    const attachment = ref as { bucketId?: unknown; fileId?: unknown }
    const bucketId = attachment.bucketId ? String(attachment.bucketId) : ''
    const fileId = attachment.fileId ? String(attachment.fileId) : ''

    const bucket = await session.getDocument('buckets', bucketId)
    if (bucket.empty()) {
      throw new Error('Storage bucket with the requested ID could not be found')
    }

    const file = await session.getDocument('files', fileId)
    if (file.empty() || file.get('bucketId') !== bucketId) {
      throw new Error('Storage file with the requested ID could not be found')
    }

    const path = String(file.get('path') ?? '')
    if (!(await device.exists(path))) {
      throw new Error(`File not found in ${path}`)
    }

    const fileData = await device.read(path)
    const { Attachment } = await import('@nuvix/messaging')
    resolved.push(
      new Attachment(
        String(file.get('name') ?? 'attachment'),
        fileData,
        String(file.get('mimeType') ?? 'text/plain'),
        Number(file.get('sizeOriginal') ?? 0) || undefined,
      ),
    )
  }
  return resolved
}

/**
 * Resolves a push message's `image` to a vendor-fetchable URL (v1
 * `processedImage` parity): `bucketId:fileId` references are signed with
 * a 15-day JWT against the push-asset stream endpoint
 * (`/storage/buckets/:bucketId/files/:fileId/push`); absolute URLs pass
 * through. v1 signed at create time and stored the URL in the message —
 * v2 signs at delivery so tokens never sit stale in the database.
 */
async function resolvePushImage(
  projectId: string | undefined,
  image: unknown,
): Promise<string | undefined> {
  if (image && typeof image === 'object') {
    return ((image as { url?: unknown }).url as string | undefined) ?? undefined
  }
  if (typeof image !== 'string' || image.length === 0) return undefined
  // Absolute URLs and plain strings pass through.
  if (image.includes('://') || !image.includes(':')) return image

  if (!projectId) return image
  const [bucketId, fileId] = image.split(':') as [string, string]
  if (!bucketId || !fileId) return image

  const { signJwt } = await import('@nuvix/core/auth')
  const { config } = await import('@nuvix/utils')
  const jwt = await signJwt({ projectId, bucketId, fileId }, config.jwtSecret, 15 * 24 * 60 * 60)
  const endpoint = Bun.env.NUVIX_ENDPOINT ?? `http://localhost:${config.port}`
  return `${endpoint}/v2/storage/buckets/${bucketId}/files/${fileId}/push?jwt=${jwt}`
}

/** Plain snapshot of the provider record for the send boundary. */
function providerSnapshot(provider: AnyDoc): ProviderSnapshot {
  return {
    provider: String(provider.get('provider') ?? ''),
    type: String(provider.get('type') ?? ''),
    name: strOpt(provider.get('name')),
    credentials: (provider.get('credentials') as Record<string, unknown> | undefined) ?? {},
    options: (provider.get('options') as Record<string, unknown> | undefined) ?? {},
  }
}

/** Mark the message failed with the given errors (v1 parity). */
async function failMessage(session: Session, message: AnyDoc, errors: string[]): Promise<void> {
  message.set('status', 'failed')
  message.set('deliveryErrors', [...((message.get('deliveryErrors') as string[]) ?? []), ...errors])
  await session.updateDocument('messages', message.getId(), message)
}

/**
 * Deliver one message (v1 `sendExternalMessage`). Exported for tests;
 * `processMessaging` composes prod deps around it.
 */
export async function deliverExternalMessage(
  message: AnyDoc,
  deps: MessagingDeps,
): Promise<{ status: 'sent' | 'failed'; deliveredTotal: number }> {
  const providerType = message.get('providerType') as MessageTypeValue
  if (!(providerType in VENDOR_BATCH_LIMITS)) {
    throw new Error(`Unsupported message provider type: ${providerType}`)
  }

  // Idempotency: sent messages never re-process (v1 parity).
  if (message.get('status') === 'sent') {
    return { status: 'sent', deliveredTotal: 0 }
  }

  const preErrors = [...((message.get('deliveryErrors') as string[]) ?? [])]

  const allTargets = await resolveTargets(deps.session, message)
  if (allTargets.length === 0) {
    await failMessage(deps.session, message, ['No valid recipients found.'])
    return { status: 'failed', deliveredTotal: 0 }
  }

  const defaultProvider = (await deps.session.findOne('providers', [
    Query.equal('enabled', [true]),
    Query.equal('type', [providerType]),
  ])) as AnyDoc
  if (!defaultProvider || defaultProvider.empty()) {
    await failMessage(deps.session, message, ['No enabled provider found.'])
    return { status: 'failed', deliveredTotal: 0 }
  }

  // Group target identifiers per provider (target override → default).
  const identifiers = new Map<string, Set<string>>()
  const knownProviders = new Map<string, AnyDoc>([[defaultProvider.getId(), defaultProvider]])

  for (const target of allTargets) {
    const providerId = String(target.get('providerId') || defaultProvider.getId())
    if (!identifiers.has(providerId)) {
      identifiers.set(providerId, new Set())
    }
    identifiers.get(providerId)?.add(String(target.get('identifier') ?? ''))
  }

  let deliveredTotal = 0
  const deliveryErrors = [...preErrors]

  for (const [providerId, idSet] of identifiers) {
    let provider: AnyDoc | undefined = knownProviders.get(providerId)
    if (!provider) {
      const fetched = await deps.session.getDocument('providers', providerId)
      if (fetched.empty() || fetched.get('enabled') !== true) {
        provider = defaultProvider
      } else {
        provider = fetched
        knownProviders.set(providerId, fetched)
      }
    }

    const snapshot = providerSnapshot(provider)

    // cc/bcc ids resolve once per provider batch (v1 per-message build).
    let data = (message.get('data') as Record<string, unknown>) ?? {}
    if (providerType === 'email') {
      const extras = await buildEmailExtras(deps.session, data)
      data = {
        ...data,
        cc: extras.cc,
        bcc: extras.bcc,
        attachments: extras.attachments,
      }
    }
    if (providerType === 'push' && data.image !== undefined) {
      data = {
        ...data,
        image: await resolvePushImage(deps.projectId, data.image),
      }
    }

    const limit = await sender.batchLimit({
      messageType: providerType,
      provider: snapshot,
    })
    const batches = chunk([...idSet], limit)

    for (const batch of batches) {
      try {
        const result = await sender.send({
          messageType: providerType,
          provider: snapshot,
          payload: { to: batch, data },
        })
        deliveredTotal += result.deliveredTo

        for (const item of result.results) {
          if (item.status === 'failure') {
            deliveryErrors.push(
              `Failed sending to target ${item.recipient} with error: ${item.error}`,
            )
          }
          // Expired push tokens mark their target expired (v1 parity).
          if (item.error === 'Expired device token') {
            const target = await deps.session.findOne('targets', [
              Query.equal('identifier', [item.recipient]),
            ])
            if (target && !target.empty()) {
              target.set('expired', true)
              await deps.session.updateDocument('targets', target.getId(), target)
            }
          }
        }
      } catch (error) {
        deliveryErrors.push(
          `Failed sending to targets with error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  // v1 finalization semantics: zero deliveries across run batches with
  // no recorded error is itself an error; any pre-existing error or
  // (new error + zero deliveries) fails the message.
  if (deliveredTotal === 0 && deliveryErrors.length === 0) {
    deliveryErrors.push('Unknown error')
  }
  let status: 'sent' | 'failed' = 'sent'
  if (preErrors.length > 0 || (deliveryErrors.length > 0 && deliveredTotal === 0)) {
    status = 'failed'
  }

  message.set('status', status)
  message.set('deliveryErrors', deliveryErrors)
  message.set('deliveredTotal', deliveredTotal)
  message.set('deliveredAt', new Date().toISOString())

  // Extend the search index with the involved providers (v1 parity).
  const searchBase = String(message.get('search') ?? '')
  const providerTags = [...knownProviders.values()]
    .map((p) => `${p.get('name') ?? ''} ${p.get('provider') ?? ''} ${providerType}`.trim())
    .join(' ')
  message.set('search', `${searchBase} ${providerTags}`.trim())

  await deps.session.updateDocument('messages', message.getId(), message)

  return { status, deliveredTotal }
}

/** Entry point wired in `workers/index.ts`. */
export default async function processMessaging(
  job: Job<MessagingJobData>,
): Promise<{ status: 'processed' | 'skipped'; messageId?: string }> {
  const data = job.data
  const session = await sessionResolver(data.projectId)
  const message = await loadMessage(session, data)

  if (!message) {
    // Message deleted or missing → nothing to do.
    return { status: 'skipped' }
  }

  await deliverExternalMessage(message, { session })

  // Scheduled messages: drop the schedule doc after delivery (v1 parity,
  // best-effort).
  if (data.scheduleId) {
    try {
      const { createPlatformDatabase } = await import('@nuvix/core/platform')
      const { config } = await import('@nuvix/utils')
      const platformDb = await createPlatformDatabase({
        driver: config.platform.dbDriver,
        url: config.platform.dbUrl,
        encryptionKey: config.platform.tenantEncryptionKey,
      })
      await platformDb.system().deleteDocument('schedules', data.scheduleId)
    } catch {
      // Non-critical: schedule cleanup is best-effort (v1 parity).
    }
  }

  return { status: 'processed', messageId: message.getId() }
}
