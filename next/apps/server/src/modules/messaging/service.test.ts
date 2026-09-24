import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors'
import { MessagingService } from './messaging.service'
import { ProvidersService } from './providers.service'
import { SubscribersService } from './subscribers.service'
import { TopicsService } from './topics.service'

function createInMemorySession(roles: string[] = ['role:all', 'user:user_1']) {
  const store = new Map<string, Map<string, Doc>>()

  const getCollection = (name: string) => {
    let col = store.get(name)
    if (!col) {
      col = new Map()
      store.set(name, col)
    }
    return col
  }

  const session = {
    ctx: { roles },
    find: async (collection: string, queries: Array<{ values?: unknown[] }> = []) => {
      const col = getCollection(collection)
      const all = [...col.values()]
      if (queries.length === 0) return all
      return all.filter((doc) => {
        for (const q of queries) {
          if (q.values && q.values.length > 0) {
            const val = q.values[0]
            const match =
              doc.get('topicId') === val ||
              doc.get('targetId') === val ||
              doc.get('userId') === val ||
              doc.get('name') === val ||
              doc.getId() === val ||
              (Array.isArray(val) && val.includes(doc.getId()))
            if (!match) return false
          }
        }
        return true
      })
    },
    getDocument: async (collection: string, id: string) => {
      const col = getCollection(collection)
      return col.get(id) ?? new Doc({})
    },
    createDocument: async (collection: string, doc: Doc) => {
      const col = getCollection(collection)
      col.set(doc.getId(), doc)
      return doc
    },
    updateDocument: async (collection: string, id: string, doc: Doc) => {
      const col = getCollection(collection)
      col.set(id, doc)
      return doc
    },
    deleteDocument: async (collection: string, id: string) => {
      const col = getCollection(collection)
      col.delete(id)
      return true
    },
    count: async (collection: string) => {
      return getCollection(collection).size
    },
  } as unknown as Session

  return { store, session }
}

describe('Messaging Module Services', () => {
  describe('TopicsService', () => {
    it('creates a topic', async () => {
      const { session } = createInMemorySession()
      const service = new TopicsService(session)

      const topic = await service.createTopic({
        topicId: 'announcements',
        name: 'Announcements',
        subscribe: ['role:all'],
      })

      expect(topic.$id).toBe('announcements')
      expect(topic.name).toBe('Announcements')
      expect(topic.subscribe).toEqual(['role:all'])
    })

    it('rejects duplicate topic creation', async () => {
      const { session } = createInMemorySession()
      const service = new TopicsService(session)

      await service.createTopic({ topicId: 'dup', name: 'Original' })
      await expect(service.createTopic({ topicId: 'dup', name: 'Duplicate' })).rejects.toThrow(
        ConflictError,
      )
    })

    it('gets a topic by id', async () => {
      const { session } = createInMemorySession()
      const service = new TopicsService(session)

      await service.createTopic({ topicId: 't1', name: 'Topic 1' })
      const topic = await service.getTopic('t1')
      expect(topic.name).toBe('Topic 1')
    })

    it('throws NotFoundError for non-existent topic', async () => {
      const { session } = createInMemorySession()
      const service = new TopicsService(session)

      await expect(service.getTopic('missing')).rejects.toThrow(NotFoundError)
    })

    it('updates a topic', async () => {
      const { session } = createInMemorySession()
      const service = new TopicsService(session)

      await service.createTopic({ topicId: 't2', name: 'Before' })
      const updated = await service.updateTopic('t2', { name: 'After' })
      expect(updated.name).toBe('After')
    })

    it('deletes a topic', async () => {
      const { session } = createInMemorySession()
      const service = new TopicsService(session)

      await service.createTopic({ topicId: 't3', name: 'To Delete' })
      await service.deleteTopic('t3')
      await expect(service.getTopic('t3')).rejects.toThrow(NotFoundError)
    })
  })

  describe('SubscribersService', () => {
    it('creates and lists subscribers on a topic', async () => {
      const { session } = createInMemorySession()
      const topicsService = new TopicsService(session)
      const subscribersService = new SubscribersService(session)

      // Setup topic, user, target
      await topicsService.createTopic({
        topicId: 'news',
        name: 'News',
        subscribe: ['role:all'],
      })

      await session.createDocument(
        'users',
        new Doc({
          $id: 'user_1',
          name: 'Alice',
          email: 'alice@example.com',
        }),
      )

      await session.createDocument(
        'targets',
        new Doc({
          $id: 'target_email_1',
          userId: 'user_1',
          providerType: 'email',
          identifier: 'alice@example.com',
        }),
      )

      const subscriber = await subscribersService.createSubscriber('news', {
        subscriberId: 'sub_1',
        targetId: 'target_email_1',
      })

      expect(subscriber.$id).toBe('sub_1')
      expect(subscriber.targetId).toBe('target_email_1')
      expect(subscriber.userName).toBe('Alice')

      // Verify topic count incremented
      const topic = await topicsService.getTopic('news')
      expect(topic.emailTotal).toBe(1)

      // List subscribers
      const list = await subscribersService.listSubscribers('news')
      expect(list.total).toBe(1)
      expect(list.subscribers[0]?.$id).toBe('sub_1')

      // Get subscriber
      const fetched = await subscribersService.getSubscriber('news', 'sub_1')
      expect(fetched.$id).toBe('sub_1')

      // Delete subscriber
      await subscribersService.deleteSubscriber('news', 'sub_1')
      const topicAfter = await topicsService.getTopic('news')
      expect(topicAfter.emailTotal).toBe(0)
    })
  })

  describe('ProvidersService', () => {
    it('creates, gets, and deletes an email provider', async () => {
      const { session } = createInMemorySession()
      const service = new ProvidersService(session)

      const provider = await service.createSendgridProvider({
        providerId: 'sendgrid_1',
        name: 'Primary Sendgrid',
        apiKey: 'SG.12345',
        fromEmail: 'noreply@example.com',
        fromName: 'Nuvix Support',
      })

      expect(provider.$id).toBe('sendgrid_1')
      expect(provider.name).toBe('Primary Sendgrid')
      expect(provider.provider).toBe('sendgrid')
      expect(provider.type).toBe('email')
      // Sensitive credentials must not be returned
      expect((provider as unknown as Record<string, unknown>).credentials).toBeUndefined()

      const fetched = await service.getProvider('sendgrid_1')
      expect(fetched.name).toBe('Primary Sendgrid')

      await service.deleteProvider('sendgrid_1')
      await expect(service.getProvider('sendgrid_1')).rejects.toThrow(NotFoundError)
    })

    it('creates SMS and Push providers', async () => {
      const { session } = createInMemorySession()
      const service = new ProvidersService(session)

      const twilio = await service.createTwilioProvider({
        providerId: 'twilio_1',
        name: 'Twilio SMS',
        accountSid: 'AC123',
        authToken: 'secret',
        from: '+1234567890',
      })
      expect(twilio.type).toBe('sms')

      const fcm = await service.createFcmProvider({
        providerId: 'fcm_1',
        name: 'Firebase Push',
        serviceAccountJSON: { project_id: 'test' },
      })
      expect(fcm.type).toBe('push')
    })
  })

  describe('MessagingService', () => {
    it('creates an email message and rejects missing targets', async () => {
      const { session } = createInMemorySession()
      const service = new MessagingService(session)

      // Rejects without targets
      await expect(
        service.createEmailMessage({
          subject: 'Weekly Digest',
          content: 'Hello World',
          topics: [],
          users: [],
          targets: [],
        }),
      ).rejects.toThrow(BadRequestError)

      // Creates with target
      const message = await service.createEmailMessage({
        messageId: 'msg_1',
        subject: 'Weekly Digest',
        content: 'Hello World',
        topics: ['news'],
        draft: false,
      })

      expect(message.$id).toBe('msg_1')
      expect(message.providerType).toBe('email')
      expect(message.status).toBe('processing')
      expect(message.topics).toEqual(['news'])

      const fetched = await service.getMessage('msg_1')
      expect(fetched.$id).toBe('msg_1')

      await service.deleteMessage('msg_1')
      await expect(service.getMessage('msg_1')).rejects.toThrow(NotFoundError)
    })

    it('creates an SMS and Push message', async () => {
      const { session } = createInMemorySession()
      const service = new MessagingService(session)

      const sms = await service.createSmsMessage({
        messageId: 'sms_1',
        content: 'Your verification code is 123456',
        users: ['user_1'],
      })
      expect(sms.providerType).toBe('sms')

      const push = await service.createPushMessage({
        messageId: 'push_1',
        title: 'New notification',
        body: 'You have a message',
        topics: ['updates'],
      })
      expect(push.providerType).toBe('push')
    })
  })
})
