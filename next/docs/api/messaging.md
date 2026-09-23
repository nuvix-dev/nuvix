# v2 Contract — Messaging (Providers, Topics, Subscribers & Messages)

> Status: PROPOSED — review before implementation
> Depends on: `_conventions.md` (D19, D26–D28), `@nuvix/messaging`, `@nuvix/db`, `handlebars`
> Old code (reference only): root `apps/server/src/messaging/`

The Messaging module handles provider configurations (Email, SMS, Push), notification topics and subscriptions, and message authoring, templating, and dispatch across channels.

## 1. Auth posture

- **Providers & Topics Management**:
  - `POST /v2/messaging/providers/*`, `PATCH /v2/messaging/providers/*`, `DELETE /v2/messaging/providers/*` require administrative authorization (`admin`, `owner`, or `x-nuvix-key` secret API key).
  - `GET /v2/messaging/providers` and `GET /v2/messaging/providers/:providerId` require administrative authorization.
  - `POST /v2/messaging/topics`, `PATCH /v2/messaging/topics/:topicId`, `DELETE /v2/messaging/topics/:topicId` require administrative authorization.
  - `GET /v2/messaging/topics` and `GET /v2/messaging/topics/:topicId` require administrative authorization.
- **Subscribers**:
  - `POST /v2/messaging/topics/:topicId/subscribers`: Admin callers may subscribe any target. Authenticated users may subscribe their own targets if the caller satisfies the topic's `subscribe` roles (e.g. `any`, `users`, or explicit roles).
  - `GET /v2/messaging/topics/:topicId/subscribers`: Admin callers or users reading their own target subscriptions.
  - `DELETE /v2/messaging/topics/:topicId/subscribers/:subscriberId`: Admin callers or users deleting their own target subscriptions.
- **Messages**:
  - `POST /v2/messaging/messages/*`, `GET /v2/messaging/messages`, `GET /v2/messaging/messages/:messageId`, `PATCH /v2/messaging/messages/*`, `DELETE /v2/messaging/messages/:messageId`, `POST /v2/messaging/messages/:messageId/send` require administrative authorization.

---

## 2. Provider Endpoints

Providers define integrations with external notification services.

### Supported Providers

- **Email**: Mailgun (`mailgun`), SendGrid (`sendgrid`), SMTP (`smtp`)
- **SMS**: Twilio (`twilio`), Vonage (`vonage`), Msg91 (`msg91`), Telesign (`telesign`), TextMagic (`textmagic`)
- **Push**: Firebase Cloud Messaging (`fcm`), Apple Push Notification service (`apns`)

### Response Model

```json
{
  "$id": "mailgun-main",
  "name": "Main Mailgun",
  "provider": "mailgun",
  "type": "email",
  "enabled": true,
  "options": {
    "fromName": "Nuvix Notifications",
    "fromEmail": "no-reply@example.com",
    "domain": "example.com",
    "isEuRegion": false
  },
  "$createdAt": "2026-09-23T10:00:00.000Z",
  "$updatedAt": "2026-09-23T10:00:00.000Z"
}
```

> Note: `credentials` (API keys, passwords, secrets) are sensitive and never returned in API responses.

### `GET /v2/messaging/providers`

List configured messaging providers.

Query parameters:
- `limit`: integer (optional, default: 25, max: 100)
- `offset`: integer (optional, default: 0)
- `type`: string (optional, `'email' | 'sms' | 'push'`)

### `GET /v2/messaging/providers/:providerId`

Get provider details by ID.

### `POST /v2/messaging/providers/:type`

Create a provider of a specific type (e.g. `mailgun`, `sendgrid`, `smtp`, `twilio`, `vonage`, `msg91`, `telesign`, `textmagic`, `fcm`, `apns`).

Common Body:
- `providerId`: string (optional, defaults to unique ID)
- `name`: string (required)
- `enabled`: boolean (optional, default: `true`)

Provider-specific fields:
- **Mailgun**: `apiKey`, `domain`, `isEuRegion`, `fromName`, `fromEmail`, `replyToName`, `replyToEmail`
- **Sendgrid**: `apiKey`, `fromName`, `fromEmail`, `replyToName`, `replyToEmail`
- **SMTP**: `host`, `port`, `username`, `password`, `encryption`, `autoTls`, `mailer`, `fromName`, `fromEmail`, `replyToName`, `replyToEmail`
- **Twilio**: `accountSid`, `authToken`, `from`
- **Vonage**: `apiKey`, `apiSecret`, `from`
- **Msg91**: `authKey`, `senderId`
- **Telesign**: `customerId`, `apiKey`, `from`
- **TextMagic**: `username`, `apiKey`, `from`
- **FCM**: `serviceAccount` (stringified JSON)
- **APNS**: `authKey`, `keyId`, `teamId`, `bundleId`, `sandbox`

### `PATCH /v2/messaging/providers/:providerId/:type`

Update an existing provider with provider-specific parameters.

### `DELETE /v2/messaging/providers/:providerId`

Delete a provider by ID. Returns status 204.

---

## 3. Topic Endpoints

Topics represent message channels that targets can subscribe to.

### Response Model

```json
{
  "$id": "newsletter",
  "name": "Product Newsletter",
  "subscribe": ["users"],
  "emailTotal": 42,
  "smsTotal": 0,
  "pushTotal": 12,
  "$createdAt": "2026-09-23T10:00:00.000Z",
  "$updatedAt": "2026-09-23T10:00:00.000Z"
}
```

### `GET /v2/messaging/topics`

List topics with pagination and optional search.

### `POST /v2/messaging/topics`

Create a topic.

Body:
- `topicId`: string (optional, defaults to unique ID)
- `name`: string (required)
- `subscribe`: array of string (optional, roles permitted to subscribe, default: `["users"]`)

### `GET /v2/messaging/topics/:topicId`

Get topic by ID.

### `PATCH /v2/messaging/topics/:topicId`

Update topic name or subscription rules.

Body:
- `name`: string (optional)
- `subscribe`: array of string (optional)

### `DELETE /v2/messaging/topics/:topicId`

Delete topic and cascade delete all its subscriptions. Returns status 204.

---

## 4. Subscriber Endpoints

Subscribers connect user notification targets (devices, phone numbers, email addresses) to topics.

### Response Model

```json
{
  "$id": "sub_123",
  "topicId": "newsletter",
  "targetId": "target_abc",
  "userId": "user_xyz",
  "userName": "Jane Doe",
  "providerType": "email",
  "target": {
    "$id": "target_abc",
    "providerType": "email",
    "identifier": "jane@example.com"
  },
  "$createdAt": "2026-09-23T10:00:00.000Z",
  "$updatedAt": "2026-09-23T10:00:00.000Z"
}
```

### `POST /v2/messaging/topics/:topicId/subscribers`

Subscribe a target to a topic.

Body:
- `subscriberId`: string (optional)
- `targetId`: string (required)

### `GET /v2/messaging/topics/:topicId/subscribers`

List subscribers for a topic with pagination.

### `GET /v2/messaging/topics/:topicId/subscribers/:subscriberId`

Get a specific subscriber by ID.

### `DELETE /v2/messaging/topics/:topicId/subscribers/:subscriberId`

Unsubscribe a target from a topic. Returns status 204.

---

## 5. Message Endpoints

Messages allow composing and dispatching emails, SMS, and push notifications to topics, users, or targets.

### Response Model

```json
{
  "$id": "msg_456",
  "providerType": "email",
  "status": "draft",
  "topics": ["newsletter"],
  "users": [],
  "targets": [],
  "data": {
    "subject": "Welcome to v2!",
    "content": "Hello {{name}}, welcome to our platform!",
    "html": true
  },
  "scheduledAt": null,
  "deliveredAt": null,
  "deliveryErrors": [],
  "deliveredTotal": 0,
  "$createdAt": "2026-09-23T10:00:00.000Z",
  "$updatedAt": "2026-09-23T10:00:00.000Z"
}
```

### `POST /v2/messaging/messages/email`

Create an email message.

Body:
- `messageId`: string (optional)
- `subject`: string (required)
- `content`: string (required)
- `topics`: string[] (optional)
- `users`: string[] (optional)
- `targets`: string[] (optional)
- `cc`: string[] (optional)
- `bcc`: string[] (optional)
- `attachments`: string[] (optional, `bucketId:fileId` format)
- `draft`: boolean (optional, default `false`)
- `html`: boolean (optional, default `false`)
- `scheduledAt`: string (optional, ISO timestamp)

### `POST /v2/messaging/messages/sms`

Create an SMS message.

Body:
- `messageId`: string (optional)
- `content`: string (required)
- `topics`: string[] (optional)
- `users`: string[] (optional)
- `targets`: string[] (optional)
- `draft`: boolean (optional, default `false`)
- `scheduledAt`: string (optional, ISO timestamp)

### `POST /v2/messaging/messages/push`

Create a push notification.

Body:
- `messageId`: string (optional)
- `title`: string (required)
- `body`: string (required)
- `topics`: string[] (optional)
- `users`: string[] (optional)
- `targets`: string[] (optional)
- `data`: Record<string, unknown> (optional)
- `action`: string (optional)
- `icon`: string (optional)
- `badge`: number (optional)
- `tag`: string (optional)
- `color`: string (optional)
- `sound`: string (optional)
- `critical`: boolean (optional)
- `draft`: boolean (optional, default `false`)
- `scheduledAt`: string (optional, ISO timestamp)

### `GET /v2/messaging/messages`

List messages with pagination.

### `GET /v2/messaging/messages/:messageId`

Get message by ID.

### `GET /v2/messaging/messages/:messageId/targets`

List resolved targets for a message.

### `PATCH /v2/messaging/messages/email/:messageId`
### `PATCH /v2/messaging/messages/sms/:messageId`
### `PATCH /v2/messaging/messages/push/:messageId`

Update a draft or scheduled message.

### `DELETE /v2/messaging/messages/:messageId`

Delete a message. Returns status 204.

### `POST /v2/messaging/messages/:messageId/send`

Trigger immediate dispatch of a draft or pending message using the active provider for its channel (`email`, `sms`, or `push`).

---

## 6. Error Codes (RFC 9457)

| Code | Status | Reason |
| --- | --- | --- |
| `provider_not_found` | 404 | Provider not found |
| `provider_already_exists` | 409 | Provider with this ID already exists |
| `provider_disabled` | 400 | The provider is disabled |
| `provider_invalid_type` | 400 | Invalid provider type or missing credentials |
| `topic_not_found` | 404 | Topic not found |
| `topic_already_exists` | 409 | Topic with this ID already exists |
| `topic_subscribe_unauthorized` | 403 | Caller does not hold permission to subscribe to topic |
| `subscriber_not_found` | 404 | Subscriber not found |
| `subscriber_already_exists` | 409 | Target is already subscribed to this topic |
| `user_target_not_found` | 404 | Target not found |
| `target_provider_mismatch` | 400 | Target provider type does not match requested channel |
| `message_not_found` | 404 | Message not found |
| `message_missing_target` | 400 | Message has no topics, users, or targets specified |
| `message_missing_schedule` | 400 | Scheduled message requires scheduledAt timestamp |
| `message_already_sent` | 400 | Message is already sent/delivered and cannot be modified |
| `messaging_send_failed` | 502 | Delivery failed with upstream provider |
