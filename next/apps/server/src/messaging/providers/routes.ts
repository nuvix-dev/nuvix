import { Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { ProvidersService } from './service'

export const messagingProvidersRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 1. List providers
    .get(
      '/providers',
      {
        detail: {
          summary: 'List messaging providers',
          description:
            'Retrieve a paginated list of configured messaging delivery providers (email, SMS, push) with optional search.',
          tags: ['Messaging Providers'],
        },
        query: t.Optional(
          t.Object({
            search: t.Optional(
              t.String({
                description: 'Search string to filter providers by name or provider ID',
              }),
            ),
            limit: t.Optional(
              t.String({
                description: 'Maximum number of providers to return',
                pattern: '^[0-9]+$',
              }),
            ),
            offset: t.Optional(
              t.String({
                description: 'Number of providers to skip before returning results',
                pattern: '^[0-9]+$',
              }),
            ),
            cursor: t.Optional(
              t.String({
                description: 'Pagination cursor token for subsequent page',
              }),
            ),
          }),
        ),
      },
      async ({ db, query }) => {
        const service = new ProvidersService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        if (query?.cursor) queries.push(Query.cursorAfter(query.cursor))
        return service.listProviders(queries, query?.search)
      },
    )

    // 2. Get single provider by ID
    .get(
      '/providers/:providerId',
      {
        detail: {
          summary: 'Get messaging provider by ID',
          description:
            'Retrieve configuration metadata and status for a specific messaging provider.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({
          providerId: t.String({ description: 'Unique provider identifier' }),
        }),
      },
      async ({ db, params: { providerId } }) => {
        const service = new ProvidersService(db)
        return service.getProvider(providerId)
      },
    )

    // 3. Delete provider by ID
    .delete(
      '/providers/:providerId',
      {
        detail: {
          summary: 'Delete messaging provider',
          description: 'Permanently remove a messaging provider configuration.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({
          providerId: t.String({ description: 'Unique provider identifier' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Status confirmation string' }),
          }),
        },
      },
      async ({ db, params: { providerId } }) => {
        const service = new ProvidersService(db)
        await service.deleteProvider(providerId)
        return { status: 'ok' as const }
      },
    )

    // -------------------------------------------------------------------------
    // Mailgun
    // -------------------------------------------------------------------------
    .post(
      '/providers/mailgun',
      {
        detail: {
          summary: 'Create Mailgun provider',
          description: 'Configure a new Mailgun email delivery provider.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Whether the provider is active' })),
          apiKey: t.Optional(t.String({ description: 'Mailgun secret API key' })),
          domain: t.Optional(t.String({ description: 'Mailgun sending domain' })),
          isEuRegion: t.Optional(t.Boolean({ description: 'Whether domain is in EU data region' })),
          fromName: t.Optional(t.String({ description: 'Default sender display name' })),
          fromEmail: t.Optional(t.String({ description: 'Default sender email address' })),
          replyToName: t.Optional(t.String({ description: 'Reply-to display name' })),
          replyToEmail: t.Optional(t.String({ description: 'Reply-to email address' })),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createMailgunProvider(body)
      },
    )
    .patch(
      '/providers/mailgun/:providerId',
      {
        detail: {
          summary: 'Update Mailgun provider',
          description: 'Update settings or credentials for a Mailgun provider.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          apiKey: t.Optional(t.String({ description: 'Updated API key' })),
          domain: t.Optional(t.String({ description: 'Updated sending domain' })),
          isEuRegion: t.Optional(t.Boolean({ description: 'EU region toggle' })),
          fromName: t.Optional(t.String({ description: 'Sender display name' })),
          fromEmail: t.Optional(t.String({ description: 'Sender email' })),
          replyToName: t.Optional(t.String({ description: 'Reply-to name' })),
          replyToEmail: t.Optional(t.String({ description: 'Reply-to email' })),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateMailgunProvider(providerId, body)
      },
    )

    // -------------------------------------------------------------------------
    // SendGrid
    // -------------------------------------------------------------------------
    .post(
      '/providers/sendgrid',
      {
        detail: {
          summary: 'Create SendGrid provider',
          description: 'Configure a new SendGrid email delivery provider.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Whether the provider is active' })),
          apiKey: t.Optional(t.String({ description: 'SendGrid API key' })),
          fromName: t.Optional(t.String({ description: 'Default sender display name' })),
          fromEmail: t.Optional(t.String({ description: 'Default sender email address' })),
          replyToName: t.Optional(t.String({ description: 'Reply-to display name' })),
          replyToEmail: t.Optional(t.String({ description: 'Reply-to email address' })),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createSendgridProvider(body)
      },
    )
    .patch(
      '/providers/sendgrid/:providerId',
      {
        detail: {
          summary: 'Update SendGrid provider',
          description: 'Update settings or credentials for a SendGrid provider.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          apiKey: t.Optional(t.String({ description: 'SendGrid API key' })),
          fromName: t.Optional(t.String({ description: 'Sender display name' })),
          fromEmail: t.Optional(t.String({ description: 'Sender email' })),
          replyToName: t.Optional(t.String({ description: 'Reply-to name' })),
          replyToEmail: t.Optional(t.String({ description: 'Reply-to email' })),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateSendgridProvider(providerId, body)
      },
    )

    // -------------------------------------------------------------------------
    // SMTP
    // -------------------------------------------------------------------------
    .post(
      '/providers/smtp',
      {
        detail: {
          summary: 'Create SMTP provider',
          description: 'Configure a generic SMTP server for outbound email delivery.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          host: t.Optional(t.String({ description: 'SMTP host address' })),
          port: t.Optional(t.Number({ description: 'SMTP port number (e.g. 587, 465)' })),
          username: t.Optional(t.String({ description: 'SMTP auth username' })),
          password: t.Optional(t.String({ description: 'SMTP auth password' })),
          encryption: t.Optional(t.String({ description: 'Encryption mode (tls, ssl, none)' })),
          autoTls: t.Optional(t.Boolean({ description: 'Whether to upgrade with STARTTLS' })),
          mailer: t.Optional(t.String({ description: 'Mailer identifier header' })),
          fromName: t.Optional(t.String({ description: 'Default sender display name' })),
          fromEmail: t.Optional(t.String({ description: 'Default sender email address' })),
          replyToName: t.Optional(t.String({ description: 'Reply-to display name' })),
          replyToEmail: t.Optional(t.String({ description: 'Reply-to email address' })),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createSmtpProvider(body)
      },
    )
    .patch(
      '/providers/smtp/:providerId',
      {
        detail: {
          summary: 'Update SMTP provider',
          description: 'Update settings or credentials for an SMTP provider.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          host: t.Optional(t.String({ description: 'SMTP host' })),
          port: t.Optional(t.Number({ description: 'SMTP port' })),
          username: t.Optional(t.String({ description: 'SMTP username' })),
          password: t.Optional(t.String({ description: 'SMTP password' })),
          encryption: t.Optional(t.String({ description: 'Encryption mode' })),
          autoTls: t.Optional(t.Boolean({ description: 'Auto TLS' })),
          mailer: t.Optional(t.String({ description: 'Mailer header' })),
          fromName: t.Optional(t.String({ description: 'Sender display name' })),
          fromEmail: t.Optional(t.String({ description: 'Sender email' })),
          replyToName: t.Optional(t.String({ description: 'Reply-to name' })),
          replyToEmail: t.Optional(t.String({ description: 'Reply-to email' })),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateSmtpProvider(providerId, body)
      },
    )

    // -------------------------------------------------------------------------
    // Twilio
    // -------------------------------------------------------------------------
    .post(
      '/providers/twilio',
      {
        detail: {
          summary: 'Create Twilio provider',
          description: 'Configure Twilio for SMS delivery.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          accountSid: t.Optional(t.String({ description: 'Twilio Account SID' })),
          authToken: t.Optional(t.String({ description: 'Twilio Auth Token' })),
          from: t.Optional(t.String({ description: 'Twilio phone number or sender ID' })),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createTwilioProvider(body)
      },
    )
    .patch(
      '/providers/twilio/:providerId',
      {
        detail: {
          summary: 'Update Twilio provider',
          description: 'Update credentials or sender number for Twilio provider.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          accountSid: t.Optional(t.String({ description: 'Twilio Account SID' })),
          authToken: t.Optional(t.String({ description: 'Twilio Auth Token' })),
          from: t.Optional(t.String({ description: 'Sender phone number' })),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateTwilioProvider(providerId, body)
      },
    )

    // -------------------------------------------------------------------------
    // Textmagic
    // -------------------------------------------------------------------------
    .post(
      '/providers/textmagic',
      {
        detail: {
          summary: 'Create Textmagic provider',
          description: 'Configure Textmagic SMS provider.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          username: t.Optional(t.String({ description: 'Textmagic account username' })),
          apiKey: t.Optional(t.String({ description: 'Textmagic API v2 key' })),
          from: t.Optional(t.String({ description: 'Sender phone number or ID' })),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createTextmagicProvider(body)
      },
    )
    .patch(
      '/providers/textmagic/:providerId',
      {
        detail: {
          summary: 'Update Textmagic provider',
          description: 'Update Textmagic SMS provider credentials.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          username: t.Optional(t.String({ description: 'Username' })),
          apiKey: t.Optional(t.String({ description: 'API key' })),
          from: t.Optional(t.String({ description: 'Sender number' })),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateTextmagicProvider(providerId, body)
      },
    )

    // -------------------------------------------------------------------------
    // Vonage
    // -------------------------------------------------------------------------
    .post(
      '/providers/vonage',
      {
        detail: {
          summary: 'Create Vonage provider',
          description: 'Configure Vonage (Nexmo) SMS delivery provider.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          apiKey: t.Optional(t.String({ description: 'Vonage API key' })),
          apiSecret: t.Optional(t.String({ description: 'Vonage API secret' })),
          from: t.Optional(t.String({ description: 'Vonage sender ID' })),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createVonageProvider(body)
      },
    )
    .patch(
      '/providers/vonage/:providerId',
      {
        detail: {
          summary: 'Update Vonage provider',
          description: 'Update Vonage SMS provider credentials.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          apiKey: t.Optional(t.String({ description: 'API key' })),
          apiSecret: t.Optional(t.String({ description: 'API secret' })),
          from: t.Optional(t.String({ description: 'Sender ID' })),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateVonageProvider(providerId, body)
      },
    )

    // -------------------------------------------------------------------------
    // Msg91
    // -------------------------------------------------------------------------
    .post(
      '/providers/msg91',
      {
        detail: {
          summary: 'Create Msg91 provider',
          description: 'Configure Msg91 SMS delivery provider.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          authKey: t.Optional(t.String({ description: 'Msg91 auth key' })),
          senderId: t.Optional(t.String({ description: 'Msg91 sender ID' })),
          templateId: t.Optional(t.String({ description: 'Msg91 template ID' })),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createMsg91Provider(body)
      },
    )
    .patch(
      '/providers/msg91/:providerId',
      {
        detail: {
          summary: 'Update Msg91 provider',
          description: 'Update Msg91 SMS provider credentials.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          authKey: t.Optional(t.String({ description: 'Auth key' })),
          senderId: t.Optional(t.String({ description: 'Sender ID' })),
          templateId: t.Optional(t.String({ description: 'Template ID' })),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateMsg91Provider(providerId, body)
      },
    )

    // -------------------------------------------------------------------------
    // Telesign
    // -------------------------------------------------------------------------
    .post(
      '/providers/telesign',
      {
        detail: {
          summary: 'Create Telesign provider',
          description: 'Configure Telesign SMS delivery provider.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          customerId: t.Optional(t.String({ description: 'Telesign Customer ID' })),
          apiKey: t.Optional(t.String({ description: 'Telesign API key' })),
          from: t.Optional(t.String({ description: 'Sender ID or phone number' })),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createTelesignProvider(body)
      },
    )
    .patch(
      '/providers/telesign/:providerId',
      {
        detail: {
          summary: 'Update Telesign provider',
          description: 'Update Telesign SMS provider credentials.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          customerId: t.Optional(t.String({ description: 'Customer ID' })),
          apiKey: t.Optional(t.String({ description: 'API key' })),
          from: t.Optional(t.String({ description: 'Sender number' })),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateTelesignProvider(providerId, body)
      },
    )

    // -------------------------------------------------------------------------
    // FCM
    // -------------------------------------------------------------------------
    .post(
      '/providers/fcm',
      {
        detail: {
          summary: 'Create FCM provider',
          description: 'Configure Firebase Cloud Messaging (FCM) push notification provider.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          serviceAccountJSON: t.Optional(
            t.Any({ description: 'Firebase Service Account JSON credential' }),
          ),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createFcmProvider(body)
      },
    )
    .patch(
      '/providers/fcm/:providerId',
      {
        detail: {
          summary: 'Update FCM provider',
          description: 'Update Firebase Cloud Messaging (FCM) credentials.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          serviceAccountJSON: t.Optional(
            t.Any({ description: 'Firebase Service Account JSON credential' }),
          ),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateFcmProvider(providerId, body)
      },
    )

    // -------------------------------------------------------------------------
    // APNS
    // -------------------------------------------------------------------------
    .post(
      '/providers/apns',
      {
        detail: {
          summary: 'Create APNS provider',
          description: 'Configure Apple Push Notification service (APNS) provider.',
          tags: ['Messaging Providers'],
        },
        body: t.Object({
          providerId: t.Optional(t.String({ description: 'Custom unique provider identifier' })),
          name: t.String({ description: 'Descriptive provider label' }),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          authKey: t.Optional(t.String({ description: 'APNS .p8 auth key content' })),
          authKeyId: t.Optional(t.String({ description: 'Apple 10-character Key ID' })),
          teamId: t.Optional(t.String({ description: 'Apple Developer Team ID' })),
          bundleId: t.Optional(t.String({ description: 'App Bundle Identifier' })),
          sandbox: t.Optional(
            t.Boolean({ description: 'Whether to use APNS sandbox environment' }),
          ),
        }),
      },
      async ({ db, body }) => {
        const service = new ProvidersService(db)
        return service.createApnsProvider(body)
      },
    )
    .patch(
      '/providers/apns/:providerId',
      {
        detail: {
          summary: 'Update APNS provider',
          description: 'Update Apple Push Notification service (APNS) credentials.',
          tags: ['Messaging Providers'],
        },
        params: t.Object({ providerId: t.String({ description: 'Unique provider identifier' }) }),
        body: t.Object({
          name: t.Optional(t.String({ description: 'Updated provider label' })),
          enabled: t.Optional(t.Boolean({ description: 'Active status' })),
          authKey: t.Optional(t.String({ description: 'APNS .p8 key' })),
          authKeyId: t.Optional(t.String({ description: 'Key ID' })),
          teamId: t.Optional(t.String({ description: 'Team ID' })),
          bundleId: t.Optional(t.String({ description: 'Bundle ID' })),
          sandbox: t.Optional(t.Boolean({ description: 'Sandbox toggle' })),
        }),
      },
      async ({ db, params: { providerId }, body }) => {
        const service = new ProvidersService(db)
        return service.updateApnsProvider(providerId, body)
      },
    )
