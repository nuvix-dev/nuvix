# v2 Contract — Messaging

> Status: IMPLEMENTED — `apps/server/src/messaging/{route,formatter}.ts` +
> `topics|subscribers|providers|messages/{routes,service}.ts`
> Depends on: `_conventions.md` (D19, D26–D28), `docs/architecture/integrations.md`
> Old code (reference only): root `apps/server/src/messaging/`

Topics, topic subscribers, delivery providers, and message send for the three
provider types: `email`, `sms`, `push`. All routes mount under `/v2/messaging`.
Worker-side delivery lives in `apps/server/src/workers/messaging.processor.ts`.

## v1 → v2 redesigns

| Concern            | v1                                              | v2                                                                                                                     |
| ------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Scheduled messages | `schedules` collection + `SchedulesHelper` hook | BullMQ delayed job (`delay = scheduledAt − now`), no schedule records                                                  |
| Push `image`       | signed at create, URL persisted                 | raw `bucketId:fileId` ref or absolute URL stored; worker signs a 15-day JWT push URL at delivery                       |
| Email attachments  | refs validated, inlined at build                | `bucketId:fileId` refs validated at create/update, stored as `{bucketId, fileId}`; bytes read from storage at delivery |
| Delivery lifecycle | partial                                         | `processing → sent/failed` with `deliveredTotal`/`deliveredAt`, `deliveryErrors`, provider-tagged search index         |

Credentials are stored on provider docs but **never returned** — `ProviderView`
has no `credentials` field.

## Pagination divergence

List endpoints return the service result `{ total, <resources> }` directly —
the `_conventions.md` §4 `{ data, meta }` wrapper is not applied at the route
layer yet. Query surface is `search`, `limit`, `offset`, `cursor`
(`cursorAfter`); message-targets listing takes `limit`/`offset` only.

---

## Endpoints — Topics

| Method | Path                            | Purpose                       |
| ------ | ------------------------------- | ----------------------------- |
| POST   | `/v2/messaging/topics`          | Create topic                  |
| GET    | `/v2/messaging/topics`          | List topics (search/cursor)   |
| GET    | `/v2/messaging/topics/:topicId` | Get topic                     |
| PATCH  | `/v2/messaging/topics/:topicId` | Update name / subscribe roles |
| DELETE | `/v2/messaging/topics/:topicId` | Delete topic + subscribers    |

### Topic object

```json
{
  "$id": "topic_news",
  "$createdAt": "2026-08-26T04:30:10.000Z",
  "$updatedAt": "2026-08-26T04:30:10.000Z",
  "name": "Product news",
  "subscribe": ["role:member"],
  "emailTotal": 12,
  "smsTotal": 0,
  "pushTotal": 31
}
```

### `POST /v2/messaging/topics`

Body: `{ topicId?, name, subscribe? }`. `topicId` follows the create-id
convention (D28) — `'unique()'` (default) or caller-supplied. `name` is
required, 1–128 chars. `subscribe` lists roles/permissions allowed to
subscribe; empty/omitted means anyone may subscribe.

### `PATCH /v2/messaging/topics/:topicId`

Body: `{ name?, subscribe? }` — both optional, applied when present. Setting
`name` rebuilds the search index (`[topicId, name].join(' ')`).

### `DELETE /v2/messaging/topics/:topicId`

Deletes every `subscribers` row for the topic, then the topic. Returns
`{ "status": "ok" }`.

## Endpoints — Subscribers

| Method | Path                                                      | Purpose            |
| ------ | --------------------------------------------------------- | ------------------ |
| POST   | `/v2/messaging/topics/:topicId/subscribers`               | Subscribe a target |
| GET    | `/v2/messaging/topics/:topicId/subscribers`               | List subscribers   |
| GET    | `/v2/messaging/topics/:topicId/subscribers/:subscriberId` | Get subscriber     |
| DELETE | `/v2/messaging/topics/:topicId/subscribers/:subscriberId` | Unsubscribe        |

### Subscriber object

```json
{
  "$id": "sub_abc123",
  "$createdAt": "2026-08-26T04:30:10.000Z",
  "$updatedAt": "2026-08-26T04:30:10.000Z",
  "targetId": "target_001",
  "targetInternalId": 42,
  "userId": "user_001",
  "userName": "Ada Lovelace",
  "topicId": "topic_news",
  "providerType": "email",
  "target": { "$id": "target_001", "identifier": "ada@example.com" }
}
```

`userName` and `target` are enriched live from the target/user documents on
every read (never stored on the subscriber row).

### `POST /v2/messaging/topics/:topicId/subscribers`

Body: `{ subscriberId?, targetId }` — `targetId` must be an existing push/email/
SMS target doc.

- If the topic's `subscribe` list is non-empty, the caller's roles must
  intersect it → else `401 user_unauthorized`.
- The subscriber's `providerType` comes from the target's `providerType`.
- Create/delete maintains the topic's `emailTotal`/`smsTotal`/`pushTotal`.
- `$permissions` grant `read`/`delete` to the owning user when the target has
  one — users manage their own subscriptions without admin rights.

## Endpoints — Providers

| Method | Path                                          | Purpose         |
| ------ | --------------------------------------------- | --------------- |
| GET    | `/v2/messaging/providers`                     | List providers  |
| GET    | `/v2/messaging/providers/:providerId`         | Get provider    |
| DELETE | `/v2/messaging/providers/:providerId`         | Delete provider |
| POST   | `/v2/messaging/providers/:vendor`             | Create provider |
| PATCH  | `/v2/messaging/providers/:vendor/:providerId` | Update provider |

### Provider object

```json
{
  "$id": "prov_mailgun_1",
  "$createdAt": "2026-08-26T04:30:10.000Z",
  "$updatedAt": "2026-08-26T04:30:10.000Z",
  "name": "Main Mailgun",
  "provider": "mailgun",
  "type": "email",
  "enabled": true,
  "options": { "fromEmail": "no-reply@example.com" }
}
```

`type` is `email` | `sms` | `push`; `provider` is the vendor id. Create bodies
all accept `{ providerId?, name, enabled? }` (defaults: `'unique()'`, enabled
`true`) plus the vendor fields below. Update bodies are the same fields, all
optional.

| Vendor (`:vendor`) | type  | Credential fields                                                                  | Option fields                                          |
| ------------------ | ----- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `mailgun`          | email | `apiKey`, `domain`, `isEuRegion`                                                   | `fromName`, `fromEmail`, `replyToName`, `replyToEmail` |
| `sendgrid`         | email | `apiKey`                                                                           | same from/reply-to quartet                             |
| `smtp`             | email | `host`, `port` (number), `username`, `password`, `encryption`, `autoTls`, `mailer` | same quartet                                           |
| `twilio`           | sms   | `accountSid`, `authToken`                                                          | `from`                                                 |
| `textmagic`        | sms   | `username`, `apiKey`                                                               | `from`                                                 |
| `vonage`           | sms   | `apiKey`, `apiSecret`                                                              | `from`                                                 |
| `msg91`            | sms   | `authKey`                                                                          | `senderId`, `templateId`                               |
| `telesign`         | sms   | `customerId`, `apiKey`                                                             | `from`                                                 |
| `fcm`              | push  | `serviceAccountJSON`                                                               | —                                                      |
| `apns`             | push  | `authKey`, `authKeyId`, `teamId`, `bundleId`                                       | `sandbox`                                              |

FCM `serviceAccountJSON` accepts a JSON string (parsed server-side) or an
object. Delivery falls back to the single first enabled provider for the
message's `type` when a target carries no `providerId` override.

## Endpoints — Messages

| Method | Path                                        | Purpose                   |
| ------ | ------------------------------------------- | ------------------------- |
| GET    | `/v2/messaging/messages`                    | List messages             |
| GET    | `/v2/messaging/messages/:messageId`         | Get message               |
| GET    | `/v2/messaging/messages/:messageId/targets` | List resolved target docs |
| POST   | `/v2/messaging/messages/email`              | Create email message      |
| PATCH  | `/v2/messaging/messages/email/:messageId`   | Update unsent email       |
| POST   | `/v2/messaging/messages/sms`                | Create SMS message        |
| PATCH  | `/v2/messaging/messages/sms/:messageId`     | Update unsent SMS         |
| POST   | `/v2/messaging/messages/push`               | Create push notification  |
| PATCH  | `/v2/messaging/messages/push/:messageId`    | Update unsent push        |
| DELETE | `/v2/messaging/messages/:messageId`         | Delete message            |

### Message object

```json
{
  "$id": "msg_abc123",
  "$createdAt": "2026-08-26T04:30:10.000Z",
  "$updatedAt": "2026-08-26T04:30:10.000Z",
  "providerType": "push",
  "topics": ["topic_news"],
  "users": [],
  "targets": [],
  "scheduledAt": "2026-08-27T09:00:00.000Z",
  "deliveredAt": "2026-08-27T09:00:03.412Z",
  "deliveryErrors": [],
  "deliveredTotal": 31,
  "data": { "title": "Launch", "body": "v2 is live" },
  "status": "sent"
}
```

- `status`: `draft` → `processing` (send now) or `scheduled` (send at
  `scheduledAt`) → `sent` | `failed` (set by the worker). Failures append to
  `deliveryErrors`; `sent` messages are never re-processed (worker idempotency).
- `data` is the provider-typed payload (see below) — the only place message
  content lives.
- Full-text `search` index is provider-tagged:
  `[messageId, subjectOrTitle?, providerType, status].join(' ')`.

### Recipients (shared by all three types)

Every create/update body accepts `topics?`, `users?`, `targets?` (arrays of
IDs). The worker resolves topics → subscribers, users → their targets, then
direct targets, filtered by `providerType`. A non-draft create with all three
empty → `400 messaging_missing_target`.

### Email

Create body: `{ messageId?, subject, content, topics?, users?, targets?, cc?, bcc?, attachments?, draft?, html?, scheduledAt? }`.

- `attachments` entries are `bucketId:fileId` refs, validated at create/update
  (bucket exists, file in bucket) and stored as `{bucketId, fileId}` snapshots;
  the worker reads bytes from the storage device at delivery. Malformed ref →
  `400 messaging_invalid_attachment`.
- `draft: true` skips recipient/enqueue requirements entirely.

### SMS

Create body: `{ messageId?, content, topics?, users?, targets?, draft?, scheduledAt? }` — `content` max 1600 chars. No other fields.

### Push

Create body: `{ messageId?, title?, body?, data?, action?, image?, icon?, sound?, color?, tag?, badge?, topics?, users?, targets?, draft?, scheduledAt? }`.

- `image` is a raw `bucketId:fileId` ref or an absolute URL, **stored raw**.
  Refs are validated at create/update: bucket exists →
  `404 storage_bucket_not_found`, file in bucket → `404 storage_file_not_found`,
  mime must be `image/png` or `image/jpeg` → `400 storage_file_type_unsupported`.
  Strings without `:` are treated as external URLs and pass through unvalidated.
- At delivery the worker resolves the ref to a signed 15-day JWT push URL
  (`GET /v2/storage/buckets/:bucketId/files/:fileId/push?jwt=…`) so tokens
  never sit stale in the database.

### Updates

`PATCH` bodies mirror their create body minus `messageId`, all fields
optional; only provided fields are applied (recipients, `data.*` payload, and
`draft`/`scheduledAt`). Attachments/image refs are re-validated when present.
**Updates only persist — they never enqueue delivery**, including the
`draft: false` → `processing` transition (which flips the status field only);
a job is enqueued exclusively at create time.

### `GET /v2/messaging/messages/:messageId/targets`

Query: `limit?`, `offset?` (no cursor/search). Returns `{ total, targets }`
where targets are the raw target documents referenced by the message's
`targets` array (empty when the message was sent purely to topics/users).

---

## Errors

All non-2xx responses are RFC 9457 problem+json (`_conventions.md` §3).
Param/body schema violations are Elysia's built-in `422` with `errors[]`.

| Status | Type                   | Code                                  | Trigger                                            |
| ------ | ---------------------- | ------------------------------------- | -------------------------------------------------- |
| 409    | `/errors/conflict`     | `messaging_topic_already_exists`      | duplicate `topicId`                                |
| 404    | `/errors/not-found`    | `messaging_topic_not_found`           | unknown topic (also on subscriber routes)          |
| 409    | `/errors/conflict`     | `messaging_subscriber_already_exists` | duplicate `subscriberId`                           |
| 404    | `/errors/not-found`    | `messaging_subscriber_not_found`      | unknown subscriber or subscriber not on `:topicId` |
| 404    | `/errors/not-found`    | `user_target_not_found`               | `targetId` doesn't resolve                         |
| 401    | `/errors/unauthorized` | `user_unauthorized`                   | caller roles fail the topic's `subscribe` gate     |
| 409    | `/errors/conflict`     | `messaging_provider_already_exists`   | duplicate `providerId`                             |
| 404    | `/errors/not-found`    | `messaging_provider_not_found`        | unknown provider                                   |
| 409    | `/errors/conflict`     | `messaging_message_already_exists`    | duplicate `messageId`                              |
| 404    | `/errors/not-found`    | `messaging_message_not_found`         | unknown message                                    |
| 400    | `/errors/bad-request`  | `messaging_missing_target`            | non-draft message with no topics/users/targets     |
| 400    | `/errors/bad-request`  | `messaging_missing_schedule`          | (defensive) scheduled status without `scheduledAt` |
| 400    | `/errors/bad-request`  | `messaging_invalid_attachment`        | attachment ref missing `bucketId:fileId` shape     |
| 404    | `/errors/not-found`    | `storage_bucket_not_found`            | attachment/push-image ref points at unknown bucket |
| 404    | `/errors/not-found`    | `storage_file_not_found`              | ref file missing or not in the named bucket        |
| 400    | `/errors/bad-request`  | `storage_file_type_unsupported`       | push image not png/jpeg                            |

## Implementation notes

- Vertical slices: `topics/`, `subscribers/`, `providers/`, `messages/` each
  with `routes.ts` + `service.ts`; shared views in `formatter.ts` (D15/D16).
- Delivery enqueue is injected (`MessagingDeliveryDeps`): message routes wire
  `queues.enqueueMessaging` with the platform `projectId`; create with status
  `processing` enqueues immediately, `scheduled` enqueues a delayed job
  (`delay = max(scheduledAt − now, 0)`); drafts never enqueue. No queue
  runtime (tests) = persistence-only.
- Topic counters (`emailTotal`/`smsTotal`/`pushTotal`) are updated inline on
  subscriber create/delete, floored at 0.
- Provider credentials live in a `credentials` doc field used only by the
  worker; the view layer strips them by construction.
