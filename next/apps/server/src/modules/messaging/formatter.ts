import type { Doc } from '@nuvix/db'
import type { Messages, Providers, Subscribers, Topics } from '../../types/generated'
import type { MessageView, ProviderView, SubscriberView, TopicView } from './types'

export function formatProvider(doc: Doc<Providers>): ProviderView {
  const data = doc.toObject()
  // credentials are never returned — only options (non-secret metadata)
  return {
    $id: doc.getId(),
    name: String(data.name ?? ''),
    provider: String(data.provider ?? ''),
    type: String(data.type ?? ''),
    enabled: Boolean(data.enabled),
    options: (data.options as Record<string, unknown>) ?? {},
    $createdAt: data.$createdAt ? String(data.$createdAt) : '',
    $updatedAt: data.$updatedAt ? String(data.$updatedAt) : '',
  }
}

export function formatTopic(doc: Doc<Topics>): TopicView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    name: String(data.name ?? ''),
    subscribe: (data.subscribe as string[]) ?? [],
    emailTotal: Number(data.emailTotal ?? 0),
    smsTotal: Number(data.smsTotal ?? 0),
    pushTotal: Number(data.pushTotal ?? 0),
    $createdAt: data.$createdAt ? String(data.$createdAt) : '',
    $updatedAt: data.$updatedAt ? String(data.$updatedAt) : '',
  }
}

export function formatSubscriber(doc: Doc<Subscribers>): SubscriberView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    topicId: String(data.topicId ?? ''),
    targetId: String(data.targetId ?? ''),
    userId: String(data.userId ?? ''),
    providerType: String(data.providerType ?? ''),
    $createdAt: data.$createdAt ? String(data.$createdAt) : '',
    $updatedAt: data.$updatedAt ? String(data.$updatedAt) : '',
  }
}

export function formatMessage(doc: Doc<Messages>): MessageView {
  const data = doc.toObject()
  return {
    $id: doc.getId(),
    providerType: String(data.providerType ?? ''),
    status: String(data.status ?? 'draft'),
    topics: (data.topics as string[]) ?? [],
    users: (data.users as string[]) ?? [],
    targets: (data.targets as string[]) ?? [],
    data: (data.data as Record<string, unknown>) ?? {},
    scheduledAt: data.scheduledAt ? String(data.scheduledAt) : null,
    deliveredAt: data.deliveredAt ? String(data.deliveredAt) : null,
    deliveryErrors: (data.deliveryErrors as string[]) ?? [],
    deliveredTotal: Number(data.deliveredTotal ?? 0),
    $createdAt: data.$createdAt ? String(data.$createdAt) : '',
    $updatedAt: data.$updatedAt ? String(data.$updatedAt) : '',
  }
}
