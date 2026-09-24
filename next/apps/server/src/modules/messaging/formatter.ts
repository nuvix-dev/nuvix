import type {
  MessagesDoc,
  ProvidersDoc,
  SubscribersDoc,
  Targets,
  TopicsDoc,
} from '../../types/generated'

export interface TopicView {
  $id: string
  $createdAt: string
  $updatedAt: string
  name: string
  subscribe: string[]
  emailTotal: number
  smsTotal: number
  pushTotal: number
}

export interface SubscriberView {
  $id: string
  $createdAt: string
  $updatedAt: string
  targetId: string
  targetInternalId?: number
  userId: string
  userName?: string
  topicId: string
  providerType: string
  target?: Targets | Record<string, unknown>
}

export interface ProviderView {
  $id: string
  $createdAt: string
  $updatedAt: string
  name: string
  provider: string
  type: string
  enabled: boolean
  options?: Record<string, unknown>
}

export interface MessageView {
  $id: string
  $createdAt: string
  $updatedAt: string
  providerType: string
  topics: string[]
  users: string[]
  targets: string[]
  scheduledAt?: string
  deliveredAt?: string
  deliveryErrors?: string[]
  deliveredTotal: number
  data: Record<string, unknown>
  status: string
}

export function formatTopic(doc: TopicsDoc): TopicView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    name: doc.get('name') ?? '',
    subscribe: (doc.get('subscribe') as string[]) ?? [],
    emailTotal: doc.get('emailTotal') ?? 0,
    smsTotal: doc.get('smsTotal') ?? 0,
    pushTotal: doc.get('pushTotal') ?? 0,
  }
}

export function formatSubscriber(
  doc: SubscribersDoc,
  extra?: { target?: Targets | Record<string, unknown>; userName?: string },
): SubscriberView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    targetId: doc.get('targetId') ?? '',
    targetInternalId: doc.get('targetInternalId'),
    userId: doc.get('userId') ?? '',
    userName: extra?.userName,
    topicId: doc.get('topicId') ?? '',
    providerType: doc.get('providerType') ?? '',
    target: extra?.target,
  }
}

export function formatProvider(doc: ProvidersDoc): ProviderView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    name: doc.get('name') ?? '',
    provider: doc.get('provider') ?? '',
    type: doc.get('type') ?? '',
    enabled: doc.get('enabled') ?? false,
    options: doc.get('options') as Record<string, unknown> | undefined,
  }
}

export function formatMessage(doc: MessagesDoc): MessageView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    providerType: doc.get('providerType') ?? '',
    topics: (doc.get('topics') as string[]) ?? [],
    users: (doc.get('users') as string[]) ?? [],
    targets: (doc.get('targets') as string[]) ?? [],
    scheduledAt: doc.get('scheduledAt') ? String(doc.get('scheduledAt')) : undefined,
    deliveredAt: doc.get('deliveredAt') ? String(doc.get('deliveredAt')) : undefined,
    deliveryErrors: (doc.get('deliveryErrors') as string[]) ?? [],
    deliveredTotal: doc.get('deliveredTotal') ?? 0,
    data: (doc.get('data') as Record<string, unknown>) ?? {},
    status: doc.get('status') ?? 'draft',
  }
}
