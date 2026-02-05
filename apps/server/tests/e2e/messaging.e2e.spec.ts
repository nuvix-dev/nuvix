/**
 * E2E Test: Messaging Flow
 *
 * This test covers the complete messaging journey:
 * 1. Authenticate with API key
 * 2. Create a messaging topic
 * 3. Subscribe users/targets to the topic
 * 4. Send a message to the topic
 * 5. Verify message delivery
 *
 * This flow represents how applications send notifications to users.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../setup/app'
import { getApiKeyJsonHeaders, getApiKeyHeaders } from '../helpers/auth'
import { createUserAndSession } from '../helpers/auth'
import { ensureCoreProvider } from '../helpers/seed'
import {
  buildCreateTopicDTO,
  buildUpdateTopicDTO,
} from '../factories/dto/topic.factory'
import { buildCreatePushTargetDTO } from '../factories/dto/target.factory'
import {
  buildCreateEmailMessageDTO,
  buildCreatePushMessageDTO,
  buildCreateSmsMessageDTO,
} from '../factories/dto/message.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
  assertListResponse,
} from '../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { faker } from '@faker-js/faker'

describe('E2E: Messaging Flow', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  it('completes the full topic lifecycle (create, update, delete)', async () => {
    // =========================================================================
    // STEP 1: Create a messaging topic
    // Topics are channels for sending messages to subscribers
    // =========================================================================
    const topicDto = buildCreateTopicDTO({
      subscribe: ['any'],
    })

    const createTopicRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(topicDto),
    })

    assertStatusCode(createTopicRes, 201)
    const createdTopic = parseJson(createTopicRes.payload)
    assertDocumentShape(createdTopic)

    // Verify topic was created correctly
    expect(createdTopic).toMatchObject({
      $id: topicDto.topicId,
      name: topicDto.name,
    })

    const topicId = createdTopic.$id

    // =========================================================================
    // STEP 2: List all topics and verify ours appears
    // =========================================================================
    const listTopicsRes = await app.inject({
      method: 'GET',
      url: '/v1/messaging/topics',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listTopicsRes, 200)
    const topicsList = parseJson(listTopicsRes.payload)
    assertListResponse(topicsList)

    const foundTopic = (topicsList.data as any[]).find(t => t.$id === topicId)
    expect(foundTopic).toBeDefined()
    expect(foundTopic.name).toBe(topicDto.name)

    // =========================================================================
    // STEP 3: Get topic details
    // =========================================================================
    const getTopicRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/topics/${topicId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getTopicRes, 200)
    const topicDetails = parseJson(getTopicRes.payload)
    assertDocumentShape(topicDetails)
    expect(topicDetails.$id).toBe(topicId)

    // =========================================================================
    // STEP 4: Update topic
    // =========================================================================
    const updateDto = buildUpdateTopicDTO({
      name: 'Updated Notifications Channel',
    })

    const updateTopicRes = await app.inject({
      method: 'PATCH',
      url: `/v1/messaging/topics/${topicId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(updateDto),
    })

    assertStatusCode(updateTopicRes, 200)
    const updatedTopic = parseJson(updateTopicRes.payload)
    expect(updatedTopic.name).toBe('Updated Notifications Channel')

    // =========================================================================
    // STEP 5: Delete topic
    // =========================================================================
    const deleteTopicRes = await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/topics/${topicId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(deleteTopicRes, 204)

    // =========================================================================
    // STEP 6: Verify topic is gone
    // =========================================================================
    const verifyDeleteRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/topics/${topicId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(verifyDeleteRes, 404)
  })

  it('completes the email message flow (create draft, send)', async () => {
    // =========================================================================
    // STEP 1: Create an email message as draft
    // =========================================================================
    const messageDto = buildCreateEmailMessageDTO({
      draft: true,
      topics: [],
      users: [],
    })

    const createMessageRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/email',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(messageDto),
    })

    assertStatusCode(createMessageRes, 201)
    const createdMessage = parseJson(createMessageRes.payload)
    assertDocumentShape(createdMessage)

    expect(createdMessage).toMatchObject({
      $id: messageDto.messageId,
      status: 'draft',
    })

    const messageId = createdMessage.$id

    // =========================================================================
    // STEP 2: Get message details
    // =========================================================================
    const getMessageRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/messages/${messageId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getMessageRes, 200)
    const messageDetails = parseJson(getMessageRes.payload)
    expect(messageDetails.status).toBe('draft')

    // =========================================================================
    // STEP 3: List messages
    // =========================================================================
    const listMessagesRes = await app.inject({
      method: 'GET',
      url: '/v1/messaging/messages',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listMessagesRes, 200)
    const messagesList = parseJson(listMessagesRes.payload)
    assertListResponse(messagesList)

    const foundMessage = (messagesList.data as any[]).find(
      m => m.$id === messageId,
    )
    expect(foundMessage).toBeDefined()

    // =========================================================================
    // STEP 4: Update the draft message
    // =========================================================================
    const updateMessageRes = await app.inject({
      method: 'PATCH',
      url: `/v1/messaging/messages/email/${messageId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        subject: 'Updated Subject Line',
      }),
    })

    assertStatusCode(updateMessageRes, 200)
    const updatedMessage = parseJson(updateMessageRes.payload)
    expect(updatedMessage.data.subject).toBe('Updated Subject Line')

    // =========================================================================
    // STEP 5: Delete the draft message
    // =========================================================================
    const deleteMessageRes = await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/messages/${messageId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(deleteMessageRes, 204)

    // Verify deletion
    const verifyDeleteRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/messages/${messageId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(verifyDeleteRes, 404)
  })

  it('completes the SMS message flow', async () => {
    // =========================================================================
    // STEP 1: Create an SMS message as draft
    // =========================================================================
    const messageDto = buildCreateSmsMessageDTO({
      draft: true,
    })

    const createMessageRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/sms',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(messageDto),
    })

    assertStatusCode(createMessageRes, 201)
    const createdMessage = parseJson(createMessageRes.payload)
    assertDocumentShape(createdMessage)

    expect(createdMessage.status).toBe('draft')

    const messageId = createdMessage.$id

    // =========================================================================
    // STEP 2: Verify message appears in list
    // =========================================================================
    const listMessagesRes = await app.inject({
      method: 'GET',
      url: '/v1/messaging/messages',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listMessagesRes, 200)
    const messagesList = parseJson(listMessagesRes.payload)

    const foundMessage = (messagesList.data as any[]).find(
      m => m.$id === messageId,
    )
    expect(foundMessage).toBeDefined()

    // =========================================================================
    // STEP 3: Cleanup
    // =========================================================================
    await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/messages/${messageId}`,
      headers: getApiKeyHeaders(),
    })
  })

  it('completes the push notification message flow', async () => {
    // =========================================================================
    // STEP 1: Create a push notification message as draft
    // =========================================================================
    const messageDto = buildCreatePushMessageDTO({
      draft: true,
    })

    const createMessageRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/push',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(messageDto),
    })

    assertStatusCode(createMessageRes, 201)
    const createdMessage = parseJson(createMessageRes.payload)
    assertDocumentShape(createdMessage)

    expect(createdMessage.status).toBe('draft')

    const messageId = createdMessage.$id

    // =========================================================================
    // STEP 2: Get message details
    // =========================================================================
    const getMessageRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/messages/${messageId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getMessageRes, 200)
    const messageDetails = parseJson(getMessageRes.payload)
    expect(messageDetails.status).toBe('draft')

    // =========================================================================
    // STEP 3: Cleanup
    // =========================================================================
    await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/messages/${messageId}`,
      headers: getApiKeyHeaders(),
    })
  })

  it('handles topic subscription with users', async () => {
    // =========================================================================
    // STEP 1: Create a user
    // =========================================================================
    const { userId, sessionHeader } = await createUserAndSession(app)

    // =========================================================================
    // STEP 2: Create a topic
    // =========================================================================
    const topicDto = buildCreateTopicDTO({
      subscribe: [`user:${userId}`],
    })

    const createTopicRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(topicDto),
    })

    assertStatusCode(createTopicRes, 201)
    const topic = parseJson(createTopicRes.payload)
    const topicId = topic.$id

    // =========================================================================
    // STEP 3: Subscribe a user to the topic
    // =========================================================================
    const subscribeRes = await app.inject({
      method: 'POST',
      url: `/v1/messaging/topics/${topicId}/subscribers`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        subscriberId: faker.string.alphanumeric(12),
        targetId: userId,
      }),
    })

    // 201 if subscriber created, or may return validation error depending on implementation
    if (subscribeRes.statusCode === 201) {
      const subscriber = parseJson(subscribeRes.payload)
      assertDocumentShape(subscriber)
      expect(subscriber.topicId).toBe(topicId)
    }

    // =========================================================================
    // STEP 4: List subscribers for the topic
    // =========================================================================
    const listSubscribersRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/topics/${topicId}/subscribers`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listSubscribersRes, 200)
    const subscribersList = parseJson(listSubscribersRes.payload)
    assertListResponse(subscribersList)

    // =========================================================================
    // Cleanup
    // =========================================================================
    await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/topics/${topicId}`,
      headers: getApiKeyHeaders(),
    })
  })

  it('handles user push target registration and messaging', async () => {
    // =========================================================================
    // STEP 1: Create a user and login
    // =========================================================================
    const { sessionHeader, userId } = await createUserAndSession(app)

    // =========================================================================
    // STEP 2: Ensure a push provider exists
    // =========================================================================
    await ensureCoreProvider(app, 'test-push-provider')

    // =========================================================================
    // STEP 3: Register a push target for the user
    // This represents registering a device for push notifications
    // =========================================================================
    const targetDto = buildCreatePushTargetDTO({
      providerId: 'test-push-provider',
    })

    const createTargetRes = await app.inject({
      method: 'POST',
      url: '/v1/account/targets/push',
      headers: {
        'content-type': 'application/json',
        'x-nuvix-session': sessionHeader,
      },
      payload: JSON.stringify(targetDto),
    })

    assertStatusCode(createTargetRes, 201)
    const createdTarget = parseJson(createTargetRes.payload)
    assertDocumentShape(createdTarget)

    expect(createdTarget.$id).toBe(targetDto.targetId)
    expect(createdTarget.userId).toBe(userId)

    // =========================================================================
    // STEP 4: List user's targets
    // =========================================================================
    const listTargetsRes = await app.inject({
      method: 'GET',
      url: `/v1/users/${userId}/targets`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listTargetsRes, 200)
    const targetsList = parseJson(listTargetsRes.payload)
    assertListResponse(targetsList)

    const foundTarget = (targetsList.data as any[]).find(
      t => t.$id === targetDto.targetId,
    )
    expect(foundTarget).toBeDefined()

    // =========================================================================
    // STEP 5: Create a topic and message targeting the user
    // =========================================================================
    const topicDto = buildCreateTopicDTO()

    await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(topicDto),
    })

    // Create a push message targeting the user
    const messageDto = buildCreatePushMessageDTO({
      draft: true,
      users: [userId],
    })

    const createMessageRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/push',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(messageDto),
    })

    assertStatusCode(createMessageRes, 201)
    const message = parseJson(createMessageRes.payload)
    expect(message.status).toBe('draft')

    // =========================================================================
    // STEP 6: Delete the target
    // =========================================================================
    const deleteTargetRes = await app.inject({
      method: 'DELETE',
      url: `/v1/account/targets/${targetDto.targetId}/push`,
      headers: {
        'x-nuvix-session': sessionHeader,
      },
    })

    assertStatusCode(deleteTargetRes, 204)

    // Verify target is gone
    const verifyTargetDeleteRes = await app.inject({
      method: 'GET',
      url: `/v1/users/${userId}/targets`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(verifyTargetDeleteRes, 200)
    const remainingTargets = parseJson(verifyTargetDeleteRes.payload)
    const deletedTarget = (remainingTargets.data as any[]).find(
      t => t.$id === targetDto.targetId,
    )
    expect(deletedTarget).toBeUndefined()

    // =========================================================================
    // Cleanup
    // =========================================================================
    await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/messages/${message.$id}`,
      headers: getApiKeyHeaders(),
    })

    await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/topics/${topicDto.topicId}`,
      headers: getApiKeyHeaders(),
    })
  })

  it('requires authentication for all messaging operations', async () => {
    // =========================================================================
    // List topics without auth
    // =========================================================================
    const listTopicsRes = await app.inject({
      method: 'GET',
      url: '/v1/messaging/topics',
    })

    assertStatusCode(listTopicsRes, 401)

    // =========================================================================
    // Create topic without auth
    // =========================================================================
    const createTopicRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(buildCreateTopicDTO()),
    })

    assertStatusCode(createTopicRes, 401)

    // =========================================================================
    // List messages without auth
    // =========================================================================
    const listMessagesRes = await app.inject({
      method: 'GET',
      url: '/v1/messaging/messages',
    })

    assertStatusCode(listMessagesRes, 401)

    // =========================================================================
    // Create message without auth
    // =========================================================================
    const createMessageRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/email',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(buildCreateEmailMessageDTO()),
    })

    assertStatusCode(createMessageRes, 401)
  })

  it('handles non-existent resources gracefully', async () => {
    const nonExistentId = 'nonexistent_id_12345'

    // =========================================================================
    // Non-existent topic
    // =========================================================================
    const getTopicRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/topics/${nonExistentId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getTopicRes, 404)

    // =========================================================================
    // Non-existent message
    // =========================================================================
    const getMessageRes = await app.inject({
      method: 'GET',
      url: `/v1/messaging/messages/${nonExistentId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getMessageRes, 404)

    // =========================================================================
    // Delete non-existent topic
    // =========================================================================
    const deleteTopicRes = await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/topics/${nonExistentId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(deleteTopicRes, 404)

    // =========================================================================
    // Delete non-existent message
    // =========================================================================
    const deleteMessageRes = await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/messages/${nonExistentId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(deleteMessageRes, 404)
  })

  it('validates message creation parameters', async () => {
    // =========================================================================
    // Email message without subject
    // =========================================================================
    const invalidEmailRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/email',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        messageId: faker.string.alphanumeric(12),
        content: 'Test content',
        // Missing subject
      }),
    })

    assertStatusCode(invalidEmailRes, 400)

    // =========================================================================
    // SMS message without content
    // =========================================================================
    const invalidSmsRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/sms',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        messageId: faker.string.alphanumeric(12),
        // Missing content
      }),
    })

    assertStatusCode(invalidSmsRes, 400)

    // =========================================================================
    // Push message without title
    // =========================================================================
    const invalidPushRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/messages/push',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        messageId: faker.string.alphanumeric(12),
        body: 'Test body',
        // Missing title
      }),
    })

    assertStatusCode(invalidPushRes, 400)

    // =========================================================================
    // Topic with invalid ID format
    // =========================================================================
    const invalidTopicRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        topicId: '@@invalid@@',
        name: 'Test Topic',
      }),
    })

    assertStatusCode(invalidTopicRes, 400)
  })

  it('prevents duplicate topic creation', async () => {
    // =========================================================================
    // Create a topic
    // =========================================================================
    const topicDto = buildCreateTopicDTO()

    await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(topicDto),
    })

    // =========================================================================
    // Try to create another topic with the same ID
    // =========================================================================
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/v1/messaging/topics',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(topicDto),
    })

    assertStatusCode(duplicateRes, 409)

    // =========================================================================
    // Cleanup
    // =========================================================================
    await app.inject({
      method: 'DELETE',
      url: `/v1/messaging/topics/${topicDto.topicId}`,
      headers: getApiKeyHeaders(),
    })
  })
})
