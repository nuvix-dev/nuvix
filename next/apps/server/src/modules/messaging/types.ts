export type ProviderChannel = 'email' | 'sms' | 'push'

export type MessageStatus = 'draft' | 'processing' | 'scheduled' | 'delivered' | 'failed'

export interface ProviderView {
  $id: string
  name: string
  provider: string
  type: string
  enabled: boolean
  options: Record<string, unknown>
  $createdAt: string
  $updatedAt: string
}

export interface TopicView {
  $id: string
  name: string
  subscribe: string[]
  emailTotal: number
  smsTotal: number
  pushTotal: number
  $createdAt: string
  $updatedAt: string
}

export interface SubscriberView {
  $id: string
  topicId: string
  targetId: string
  userId: string
  userName?: string
  providerType: string
  target?: {
    $id: string
    providerType: string
    identifier: string
  }
  $createdAt: string
  $updatedAt: string
}

export interface MessageView {
  $id: string
  providerType: string
  status: string
  topics: string[]
  users: string[]
  targets: string[]
  data: Record<string, unknown>
  scheduledAt: string | null
  deliveredAt: string | null
  deliveryErrors: string[]
  deliveredTotal: number
  $createdAt: string
  $updatedAt: string
}

export interface MessagingCallerAuth {
  isAdmin: boolean
  isKey: boolean
  userId?: string
  roles: string[]
}

// Provider Inputs
export interface CreateMailgunProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  apiKey: string
  domain: string
  isEuRegion?: boolean
  fromName?: string
  fromEmail?: string
  replyToName?: string
  replyToEmail?: string
}

export interface UpdateMailgunProviderInput {
  name?: string
  enabled?: boolean
  apiKey?: string
  domain?: string
  isEuRegion?: boolean
  fromName?: string
  fromEmail?: string
  replyToName?: string
  replyToEmail?: string
}

export interface CreateSendgridProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  apiKey: string
  fromName?: string
  fromEmail?: string
  replyToName?: string
  replyToEmail?: string
}

export interface UpdateSendgridProviderInput {
  name?: string
  enabled?: boolean
  apiKey?: string
  fromName?: string
  fromEmail?: string
  replyToName?: string
  replyToEmail?: string
}

export interface CreateSmtpProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  host: string
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

export interface UpdateSmtpProviderInput {
  name?: string
  enabled?: boolean
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

export interface CreateTwilioProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  accountSid: string
  authToken: string
  from: string
}

export interface UpdateTwilioProviderInput {
  name?: string
  enabled?: boolean
  accountSid?: string
  authToken?: string
  from?: string
}

export interface CreateVonageProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  apiKey: string
  apiSecret: string
  from: string
}

export interface UpdateVonageProviderInput {
  name?: string
  enabled?: boolean
  apiKey?: string
  apiSecret?: string
  from?: string
}

export interface CreateMsg91ProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  authKey: string
  senderId: string
  templateId?: string
}

export interface UpdateMsg91ProviderInput {
  name?: string
  enabled?: boolean
  authKey?: string
  senderId?: string
  templateId?: string
}

export interface CreateTelesignProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  customerId: string
  apiKey: string
  from?: string
}

export interface UpdateTelesignProviderInput {
  name?: string
  enabled?: boolean
  customerId?: string
  apiKey?: string
  from?: string
}

export interface CreateTextmagicProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  username: string
  apiKey: string
  from?: string
}

export interface UpdateTextmagicProviderInput {
  name?: string
  enabled?: boolean
  username?: string
  apiKey?: string
  from?: string
}

export interface CreateFcmProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  serviceAccount: string
}

export interface UpdateFcmProviderInput {
  name?: string
  enabled?: boolean
  serviceAccount?: string
}

export interface CreateApnsProviderInput {
  providerId?: string
  name: string
  enabled?: boolean
  authKey: string
  keyId: string
  teamId: string
  bundleId: string
  sandbox?: boolean
}

export interface UpdateApnsProviderInput {
  name?: string
  enabled?: boolean
  authKey?: string
  keyId?: string
  teamId?: string
  bundleId?: string
  sandbox?: boolean
}

// Topic Inputs
export interface CreateTopicInput {
  topicId?: string
  name: string
  subscribe?: string[]
}

export interface UpdateTopicInput {
  name?: string
  subscribe?: string[]
}

// Subscriber Inputs
export interface CreateSubscriberInput {
  subscriberId?: string
  targetId: string
}

// Message Inputs
export interface CreateEmailMessageInput {
  messageId?: string
  subject: string
  content: string
  topics?: string[]
  users?: string[]
  targets?: string[]
  cc?: string[]
  bcc?: string[]
  attachments?: string[]
  draft?: boolean
  html?: boolean
  scheduledAt?: string
}

export interface UpdateEmailMessageInput {
  subject?: string
  content?: string
  topics?: string[]
  users?: string[]
  targets?: string[]
  cc?: string[]
  bcc?: string[]
  attachments?: string[]
  draft?: boolean
  html?: boolean
  scheduledAt?: string
}

export interface CreateSmsMessageInput {
  messageId?: string
  content: string
  topics?: string[]
  users?: string[]
  targets?: string[]
  draft?: boolean
  scheduledAt?: string
}

export interface UpdateSmsMessageInput {
  content?: string
  topics?: string[]
  users?: string[]
  targets?: string[]
  draft?: boolean
  scheduledAt?: string
}

export interface CreatePushMessageInput {
  messageId?: string
  title: string
  body: string
  topics?: string[]
  users?: string[]
  targets?: string[]
  data?: Record<string, unknown>
  action?: string
  icon?: string
  badge?: number
  tag?: string
  color?: string
  sound?: string
  critical?: boolean
  draft?: boolean
  scheduledAt?: string
}

export interface UpdatePushMessageInput {
  title?: string
  body?: string
  topics?: string[]
  users?: string[]
  targets?: string[]
  data?: Record<string, unknown>
  action?: string
  icon?: string
  badge?: number
  tag?: string
  color?: string
  sound?: string
  critical?: boolean
  draft?: boolean
  scheduledAt?: string
}
