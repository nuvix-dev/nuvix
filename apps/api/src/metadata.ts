/* eslint-disable */
export default async () => {
  const t = {};
  return {
    '@nestjs/swagger': {
      models: [
        [
          import('./databases/DTO/create-schema.dto'),
          {
            CreateDocumentSchema: {
              name: { required: true, type: () => String },
              description: { required: false, type: () => String },
            },
            CreateSchema: {
              type: { required: true, type: () => Object, default: 'managed' },
            },
          },
        ],
        [
          import('./users/DTO/user.dto'),
          {
            CreateUserDTO: {
              userId: { required: true, type: () => String },
              email: { required: true, type: () => String, format: 'email' },
              phone: { required: true, type: () => String },
              password: { required: true, type: () => String, minLength: 8 },
              name: {
                required: true,
                type: () => String,
                minLength: 1,
                maxLength: 128,
              },
            },
            CreateUserWithShaDTO: {
              passwordVersion: {
                required: false,
                type: () => String,
                pattern:
                  '/^(sha1|sha224|sha256|sha384|sha512\\/224|sha512\\/256|sha512|sha3-224|sha3-256|sha3-384|sha3-512)$/',
              },
            },
            CreateUserWithScryptDTO: {
              passwordSalt: {
                required: false,
                type: () => String,
                minLength: 1,
                maxLength: 128,
              },
              passwordCpu: { required: false, type: () => Number },
              passwordMemory: { required: false, type: () => Number },
              passwordParallel: { required: false, type: () => Number },
              passwordLength: { required: false, type: () => Number },
            },
            CreateUserWithScryptModifedDTO: {
              passwordSalt: {
                required: false,
                type: () => String,
                minLength: 1,
                maxLength: 128,
              },
              passwordSaltSeparator: {
                required: false,
                type: () => String,
                minLength: 1,
                maxLength: 128,
              },
              passwordSignerKey: {
                required: false,
                type: () => String,
                minLength: 1,
                maxLength: 128,
              },
            },
            UpdateUserStatusDTO: {
              status: { required: true, type: () => Boolean },
            },
            UpdateUserLabelDTO: {
              labels: {
                required: false,
                type: () => [String],
                pattern: '/^[a-zA-Z0-9]{1,36}$/',
              },
            },
            UpdateUserPoneVerificationDTO: {
              phoneVerification: { required: true, type: () => Boolean },
            },
            UpdateUserEmailVerificationDTO: {
              emailVerification: { required: true, type: () => Boolean },
            },
            UpdateUserNameDTO: {
              name: {
                required: true,
                type: () => String,
                minLength: 1,
                maxLength: 128,
              },
            },
            UpdateUserPasswordDTO: {
              password: { required: true, type: () => String, minLength: 8 },
            },
            UpdateUserEmailDTO: {
              email: { required: true, type: () => String, format: 'email' },
            },
            UpdateUserPhoneDTO: {
              phone: { required: true, type: () => String },
            },
            UpdateUserPrefsDTO: {
              prefs: { required: false, type: () => Object },
            },
            UpdateMfaStatusDTO: {
              mfa: { required: true, type: () => Boolean },
            },
          },
        ],
        [
          import('./users/DTO/target.dto'),
          {
            CreateTargetDTO: {
              targetId: { required: true, type: () => String },
              providerType: { required: true, type: () => String },
              identifier: { required: true, type: () => String, minLength: 1 },
              providerId: { required: false, type: () => String },
              name: {
                required: true,
                type: () => String,
                minLength: 1,
                maxLength: 128,
              },
            },
            UpdateTargetDTO: {},
          },
        ],
        [
          import('./users/DTO/token.dto'),
          {
            CreateTokenDTO: {
              length: {
                required: true,
                type: () => Number,
                default: 6,
                minimum: 4,
                maximum: 128,
              },
              expire: { required: true, type: () => Number, minimum: 60 },
            },
          },
        ],
        [
          import('./users/DTO/jwt.dto'),
          {
            CreateJwtDTO: {
              sessionId: {
                required: false,
                type: () => String,
                default: 'recent',
              },
              duration: {
                required: true,
                type: () => Number,
                default: 900,
                minimum: 0,
                maximum: 3600,
              },
            },
          },
        ],
        [
          import('./account/DTO/account.dto'),
          {
            CreateAccountDTO: {
              userId: { required: true, type: () => String },
              email: { required: true, type: () => String, format: 'email' },
              password: {
                required: true,
                type: () => String,
                minLength: 8,
                maxLength: 256,
              },
              name: {
                required: false,
                type: () => String,
                minLength: 0,
                maxLength: 128,
              },
            },
            UpdatePrefsDTO: {},
            UpdateEmailDTO: {
              email: { required: true, type: () => String, format: 'email' },
              password: { required: true, type: () => String },
            },
            UpdatePasswordDTO: {
              password: { required: true, type: () => String },
              oldPassword: { required: true, type: () => String },
            },
            UpdateNameDTO: { name: { required: true, type: () => String } },
            UpdatePhoneDTO: {
              phone: { required: true, type: () => String },
              password: { required: true, type: () => String },
            },
            UpdateAccountStatusDTO: {
              status: { required: true, type: () => Boolean },
            },
          },
        ],
        [
          import('./account/DTO/recovery.dto'),
          {
            CreateRecoveryDTO: {
              email: { required: true, type: () => String, format: 'email' },
              url: { required: true, type: () => String, format: 'uri' },
            },
            UpdateRecoveryDTO: {
              userId: { required: true, type: () => String },
              secret: { required: true, type: () => String },
              password: { required: true, type: () => String },
            },
          },
        ],
        [
          import('./account/DTO/mfa.dto'),
          {
            UpdateAccountMfaDTO: {
              mfa: { required: true, type: () => Boolean },
            },
            MfaAuthenticatorTypeParamDTO: {
              type: { required: true, type: () => String },
            },
            VerifyMfaAuthenticatorDTO: {
              otp: { required: true, type: () => String },
            },
            CreateMfaChallengeDTO: {
              factor: { required: true, type: () => String },
              userId: { required: false, type: () => String },
            },
            VerifyMfaChallengeDTO: {
              challengeId: { required: true, type: () => String },
              otp: { required: true, type: () => String },
            },
          },
        ],
        [
          import('./account/DTO/target.dto'),
          {
            CreatePushTargetDTO: {
              targetId: { required: true, type: () => String },
              identifier: { required: true, type: () => String },
              providerId: { required: false, type: () => String },
            },
            UpdatePushTargetDTO: {},
            TargetIdParamDTO: {
              targetId: { required: true, type: () => String },
            },
          },
        ],
        [
          import('./account/DTO/session.dto'),
          {
            CreateEmailSessionDTO: {
              email: { required: true, type: () => String, format: 'email' },
              password: { required: true, type: () => String, minLength: 8 },
            },
            CreateSessionDTO: {
              userId: { required: true, type: () => String },
              secret: {
                required: true,
                type: () => String,
                minLength: 200,
                maxLength: 256,
              },
            },
            CreateOAuth2SessionDTO: {
              success: { required: false, type: () => String, format: 'uri' },
              failure: { required: false, type: () => String, format: 'uri' },
              scopes: { required: true, type: () => [String] },
            },
            OAuth2CallbackDTO: {
              code: { required: false, type: () => String, maxLength: 2048 },
              state: { required: false, type: () => String, maxLength: 2048 },
              error: { required: false, type: () => String, maxLength: 2048 },
              error_description: {
                required: false,
                type: () => String,
                maxLength: 2048,
              },
            },
            ProviderParamDTO: {
              provider: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('./account/DTO/token.dto'),
          {
            CreateOAuth2TokenDTO: {
              success: { required: false, type: () => String, format: 'uri' },
              failure: { required: false, type: () => String, format: 'uri' },
              scopes: { required: true, type: () => [String] },
            },
            CreateMagicURLTokenDTO: {
              userId: { required: true, type: () => String },
              email: { required: true, type: () => String, format: 'email' },
              url: { required: false, type: () => String, format: 'uri' },
              phrase: { required: false, type: () => Boolean, default: false },
            },
            CreateEmailTokenDTO: {
              userId: { required: true, type: () => String },
              email: { required: true, type: () => String, format: 'email' },
              phrase: { required: false, type: () => Boolean, default: false },
            },
            CreatePhoneTokenDTO: {
              userId: { required: true, type: () => String },
              phone: { required: true, type: () => String },
            },
          },
        ],
        [
          import('./account/DTO/identity.dto'),
          {
            IdentityIdParamDTO: {
              identityId: { required: true, type: () => String },
            },
          },
        ],
        [
          import('./account/DTO/verification.dto'),
          {
            CreateEmailVerificationDTO: {
              url: { required: false, type: () => String, format: 'uri' },
            },
            UpdateEmailVerificationDTO: {
              userId: { required: true, type: () => String },
              secret: { required: true, type: () => String },
            },
            UpdatePhoneVerificationDTO: {},
          },
        ],
        [
          import('./teams/DTO/team.dto'),
          {
            CreateTeamDTO: {
              teamId: { required: true, type: () => String },
              name: {
                required: true,
                type: () => String,
                minLength: 1,
                maxLength: 128,
              },
              roles: {
                required: true,
                type: () => [String],
                minLength: 1,
                maxLength: 32,
              },
            },
            UpdateTeamDTO: {},
            UpdateTeamPrefsDTO: {
              prefs: { required: false, type: () => Object },
            },
          },
        ],
        [
          import('./teams/DTO/membership.dto'),
          {
            CreateMembershipDTO: {
              email: { required: false, type: () => String, format: 'email' },
              userId: { required: false, type: () => String },
              phone: { required: false, type: () => String },
              roles: { required: true, type: () => [String] },
              url: { required: false, type: () => String, format: 'uri' },
              name: { required: false, type: () => String, maxLength: 128 },
            },
            UpdateMembershipDTO: {
              roles: { required: true, type: () => [String] },
            },
            UpdateMembershipStatusDTO: {
              userId: { required: true, type: () => String },
              secret: { required: true, type: () => String, maxLength: 256 },
            },
          },
        ],
        [
          import('./realtime/DTO/create-realtime.dto'),
          { CreateRealtimeDTO: {} },
        ],
        [
          import('./realtime/DTO/update-realtime.dto'),
          { UpdateRealtimeDTO: { id: { required: true, type: () => Number } } },
        ],
        [
          import('./storage/DTO/bucket.dto'),
          {
            CreateBucketDTO: {
              bucketId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              permissions: { required: true, type: () => [String] },
              fileSecurity: {
                required: true,
                type: () => Boolean,
                default: false,
              },
              enabled: { required: true, type: () => Boolean, default: true },
              maximumFileSize: {
                required: true,
                type: () => Number,
                minimum: 1,
              },
              allowedFileExtensions: { required: true, type: () => [String] },
              compression: {
                required: true,
                type: () => String,
                default: 'none',
              },
              encryption: {
                required: true,
                type: () => Boolean,
                default: false,
              },
              antivirus: {
                required: true,
                type: () => Boolean,
                default: false,
              },
            },
            UpdateBucketDTO: {
              name: { required: false, type: () => String, maxLength: 128 },
              permissions: { required: false, type: () => [String] },
              fileSecurity: { required: false, type: () => Boolean },
              enabled: { required: false, type: () => Boolean },
              maximumFileSize: {
                required: false,
                type: () => Number,
                minimum: 1,
              },
              allowedFileExtensions: { required: false, type: () => [String] },
              compression: { required: false, type: () => String },
              encryption: { required: false, type: () => Boolean },
              antivirus: { required: false, type: () => Boolean },
            },
          },
        ],
        [
          import('./storage/DTO/file.dto'),
          {
            CreateFileDTO: {
              fileId: { required: true, type: () => String },
              permissions: { required: false, type: () => [String] },
            },
            UpdateFileDTO: {
              name: {
                required: true,
                type: () => String,
                minLength: 1,
                maxLength: 255,
              },
            },
          },
        ],
        [
          import('./storage/DTO/object.dto'),
          {
            CreateFolderDTO: {
              name: {
                required: true,
                type: () => String,
                description: 'The name of the folder.',
                minLength: 1,
                maxLength: 255,
                pattern: '/^[a-zA-Z0-9-_]+$/',
              },
              metadata: {
                required: false,
                type: () => Object,
                description: 'The metadata of the folder.',
              },
              permissions: {
                required: false,
                type: () => [String],
                description: 'permissions',
              },
            },
            UploadFileDTO: {
              fileId: { required: true, type: () => String },
              name: {
                required: true,
                type: () => String,
                description: 'The name of the file.',
                minLength: 1,
                maxLength: 255,
                pattern: '/^[a-zA-Z0-9-_]+$/',
              },
              metadata: {
                required: false,
                type: () => Object,
                description: 'The metadata of the file.',
              },
              permissions: {
                required: false,
                type: () => [String],
                description: 'permissions',
              },
            },
          },
        ],
        [
          import('./messaging/DTO/mailgun.dto'),
          {
            CreateMailgunProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              apiKey: { required: false, type: () => String },
              domain: { required: false, type: () => String },
              isEuRegion: { required: false, type: () => Boolean },
              fromName: { required: false, type: () => String, maxLength: 128 },
              fromEmail: {
                required: false,
                type: () => String,
                format: 'email',
              },
              replyToName: {
                required: false,
                type: () => String,
                maxLength: 128,
              },
              replyToEmail: {
                required: false,
                type: () => String,
                format: 'email',
              },
              enabled: { required: false, type: () => Boolean },
            },
            UpdateMailgunProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/sendgrid.dto'),
          {
            CreateSendgridProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              apiKey: { required: true, type: () => String },
              fromName: { required: false, type: () => String, maxLength: 128 },
              fromEmail: {
                required: false,
                type: () => String,
                format: 'email',
              },
              replyToName: {
                required: false,
                type: () => String,
                maxLength: 128,
              },
              replyToEmail: {
                required: false,
                type: () => String,
                format: 'email',
              },
              enabled: { required: false, type: () => Boolean },
            },
            UpdateSendgridProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/twilio.dto'),
          {
            CreateTwilioProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              from: { required: false, type: () => String },
              accountSid: { required: false, type: () => String },
              authToken: { required: false, type: () => String },
              enabled: { required: false, type: () => Boolean },
            },
            UpdateTwilioProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/smtp.dto'),
          {
            CreateSMTPProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              host: { required: true, type: () => String },
              port: {
                required: false,
                type: () => Number,
                default: 587,
                minimum: 1,
                maximum: 65535,
              },
              username: { required: false, type: () => String },
              password: { required: false, type: () => String },
              encryption: { required: false, type: () => String },
              autoTLS: { required: false, type: () => Boolean, default: true },
              mailer: { required: false, type: () => String },
              fromName: { required: false, type: () => String, maxLength: 128 },
              fromEmail: {
                required: false,
                type: () => String,
                format: 'email',
              },
              replyToName: {
                required: false,
                type: () => String,
                maxLength: 128,
              },
              replyToEmail: {
                required: false,
                type: () => String,
                format: 'email',
              },
              enabled: { required: false, type: () => Boolean },
            },
            UpdateSMTPProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/msg91.dto'),
          {
            CreateMsg91ProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              templateId: { required: false, type: () => String },
              senderId: { required: false, type: () => String },
              authKey: { required: false, type: () => String },
              enabled: { required: false, type: () => Boolean },
              from: { required: false, type: () => String },
            },
            UpdateMsg91ProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/telesign.dto'),
          {
            CreateTelesignProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              from: { required: false, type: () => String },
              customerId: { required: false, type: () => String },
              apiKey: { required: false, type: () => String },
              enabled: { required: false, type: () => Boolean },
            },
            UpdateTelesignProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/textmagic.dto'),
          {
            CreateTextmagicProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              from: { required: false, type: () => String },
              username: { required: false, type: () => String },
              apiKey: { required: false, type: () => String },
              enabled: { required: false, type: () => Boolean },
            },
            UpdateTextmagicProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/vonage.dto'),
          {
            CreateVonageProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              from: { required: false, type: () => String },
              apiKey: { required: false, type: () => String },
              apiSecret: { required: false, type: () => String },
              enabled: { required: false, type: () => Boolean },
            },
            UpdateVonageProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/fcm.dto'),
          {
            CreateFcmProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              serviceAccountJSON: { required: false, type: () => Object },
              enabled: { required: false, type: () => Boolean },
            },
            UpdateFcmProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/apns.dto'),
          {
            CreateApnsProviderDTO: {
              providerId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              authKey: { required: false, type: () => String },
              authKeyId: { required: false, type: () => String },
              teamId: { required: false, type: () => String },
              bundleId: { required: false, type: () => String },
              sandbox: { required: false, type: () => Boolean, default: false },
              enabled: { required: false, type: () => Boolean },
            },
            UpdateApnsProviderDTO: {},
          },
        ],
        [
          import('./messaging/DTO/topics.dto'),
          {
            CreateTopicDTO: {
              topicId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              subscribe: {
                required: false,
                type: () => [String],
                maxLength: 64,
              },
            },
            UpdateTopicDTO: {},
          },
        ],
        [
          import('./messaging/DTO/subscriber.dto'),
          {
            CreateSubscriberDTO: {
              subscriberId: { required: true, type: () => String },
              targetId: { required: true, type: () => String },
            },
          },
        ],
        [
          import('./messaging/DTO/message.dto'),
          {
            CreateEmailMessageDTO: {
              messageId: { required: true, type: () => String },
              subject: { required: true, type: () => String, maxLength: 998 },
              content: { required: true, type: () => String, maxLength: 64230 },
              topics: { required: false, type: () => [String] },
              users: { required: false, type: () => [String] },
              targets: { required: false, type: () => [String] },
              cc: { required: false, type: () => [String] },
              bcc: { required: false, type: () => [String] },
              attachments: { required: false, type: () => [String] },
              draft: { required: false, type: () => Boolean },
              html: { required: false, type: () => Boolean },
              scheduledAt: { required: false, type: () => String },
            },
            CreateSmsMessageDTO: {
              messageId: { required: true, type: () => String },
              content: { required: true, type: () => String, maxLength: 64230 },
              topics: { required: false, type: () => [String] },
              users: { required: false, type: () => [String] },
              targets: { required: false, type: () => [String] },
              draft: { required: false, type: () => Boolean },
              scheduledAt: { required: false, type: () => String },
            },
            CreatePushMessageDTO: {
              messageId: { required: true, type: () => String },
              title: { required: false, type: () => String, maxLength: 256 },
              body: { required: false, type: () => String, maxLength: 64230 },
              topics: { required: false, type: () => [String] },
              users: { required: false, type: () => [String] },
              targets: { required: false, type: () => [String] },
              data: { required: false, type: () => Object },
              action: { required: false, type: () => String, maxLength: 256 },
              image: { required: false, type: () => String },
              icon: { required: false, type: () => String, maxLength: 256 },
              sound: { required: false, type: () => String, maxLength: 256 },
              color: { required: false, type: () => String, maxLength: 256 },
              tag: { required: false, type: () => String, maxLength: 256 },
              badge: { required: false, type: () => Number, minimum: -1 },
              draft: { required: false, type: () => Boolean },
              scheduledAt: { required: false, type: () => String },
              contentAvailable: { required: false, type: () => Boolean },
              critical: { required: false, type: () => Boolean },
              priority: { required: false, type: () => Object },
            },
            UpdateEmailMessageDTO: {},
            UpdateSmsMessageDTO: {},
            UpdatePushMessageDTO: {},
          },
        ],
        [
          import('./schemas/collections/DTO/collection.dto'),
          {
            CreateCollectionDTO: {
              collectionId: { required: true, type: () => String },
              name: { required: true, type: () => String, maxLength: 128 },
              permissions: { required: true, type: () => [String] },
              documentSecurity: {
                required: true,
                type: () => Boolean,
                default: false,
              },
              enabled: { required: true, type: () => Boolean, default: true },
            },
            UpdateCollectionDTO: {},
          },
        ],
        [
          import('./schemas/collections/DTO/attributes.dto'),
          {
            CreateStringAttributeDTO: {
              key: { required: true, type: () => String },
              size: {
                required: true,
                type: () => Number,
                default: 0,
                minimum: 1,
              },
              required: {
                required: false,
                type: () => Boolean,
                default: false,
              },
              default: {
                required: false,
                type: () => String,
                nullable: true,
                default: null,
              },
              array: { required: false, type: () => Boolean, default: false },
              encrypt: { required: false, type: () => Boolean, default: false },
            },
            CreateEmailAttributeDTO: {},
            CreateEnumAttributeDTO: {
              elements: {
                required: false,
                type: () => [String],
                minLength: 1,
                maxLength: 1024,
              },
              default: { required: false, type: () => Object, default: null },
            },
            CreateIpAttributeDTO: {},
            CreateURLAttributeDTO: {},
            CreateIntegerAttributeDTO: {
              min: { required: false, type: () => Number },
              max: { required: false, type: () => Number },
              default: { required: false, type: () => Number },
            },
            CreateFloatAttributeDTO: {},
            CreateBooleanAttributeDTO: {
              default: { required: false, type: () => Boolean, default: false },
            },
            CreateDatetimeAttributeDTO: {},
            CreateRelationAttributeDTO: {
              relatedCollectionId: { required: true, type: () => String },
              type: { required: true, type: () => String },
              twoWay: { required: false, type: () => Boolean, default: false },
              key: { required: true, type: () => String },
              twoWayKey: { required: false, type: () => String },
              onDelete: { required: true, type: () => String },
            },
            UpdateStringAttributeDTO: {
              newKey: { required: false, type: () => String },
            },
            UpdateEmailAttributeDTO: {},
            UpdateEnumAttributeDTO: {
              newKey: { required: false, type: () => String },
            },
            UpdateIpAttributeDTO: {
              newKey: { required: false, type: () => String },
            },
            UpdateURLAttributeDTO: {
              newKey: { required: false, type: () => String },
            },
            UpdateIntegerAttributeDTO: {
              newKey: { required: false, type: () => String },
            },
            UpdateFloatAttributeDTO: {
              newKey: { required: false, type: () => String },
            },
            UpdateBooleanAttributeDTO: {
              newKey: { required: false, type: () => String },
            },
            UpdateDatetimeAttributeDTO: {
              newKey: { required: false, type: () => String },
            },
            UpdateRelationAttributeDTO: {
              newKey: { required: false, type: () => String },
            },
          },
        ],
        [
          import('./schemas/collections/DTO/document.dto'),
          {
            CreateDocumentDTO: {
              documentId: { required: true, type: () => String },
              data: { required: true, type: () => Object },
              permissions: { required: true, type: () => [String] },
            },
            UpdateDocumentDTO: {},
          },
        ],
        [
          import('./schemas/collections/DTO/indexes.dto'),
          {
            CreateIndexDTO: {
              key: { required: true, type: () => String },
              type: { required: true, type: () => String },
              attributes: { required: true, type: () => [String] },
              orders: { required: true, type: () => [Object] },
            },
          },
        ],
        [import('./realtime/entities/realtime.entity'), { Realtime: {} }],
        [
          import('./schemas/collections/DTO/database.dto'),
          {
            CreateDatabaseDTO: {
              databaseId: { required: true, type: () => String },
              name: {
                required: true,
                type: () => String,
                minLength: 1,
                maxLength: 128,
              },
              enabled: { required: true, type: () => Boolean },
            },
            UpdateDatabaseDTO: {},
          },
        ],
      ],
      controllers: [
        [
          import('./app.controller'),
          { AppController: { main: {}, getFavicon: {} } },
        ],
        [
          import('./base/base.controller'),
          { BaseController: { localCodes: {}, testSMTP: {} } },
        ],
        [
          import('./databases/databases.controller'),
          {
            DatabasesController: {
              createDocTypeSchema: { type: Object },
              getSchemas: {},
              createSchema: { type: Object },
              getSchema: {},
            },
          },
        ],
        [
          import('./avatars/avatars.controller'),
          { AvatarsController: { generateAvatar: {} } },
        ],
        [
          import('./users/users.controller'),
          {
            UsersController: {
              findAll: {},
              create: { type: Object },
              createWithArgon2: { type: Object },
              createWithBcrypt: { type: Object },
              createWithMd5: { type: Object },
              createWithSha: { type: Object },
              createWithPhpass: { type: Object },
              createWithScrypt: { type: Object },
              createWithScryptModified: { type: Object },
              getUsage: {},
              getIdentities: {},
              deleteIdentity: {},
              findOne: {},
              getPrefs: { type: Object },
              updatePrefs: { type: Object },
              updateStatus: {},
              updateLabels: {},
              updateName: {},
              updatePassword: {},
              updateEmail: {},
              updatePhone: {},
              updateMfa: {},
              addTarget: { type: Object },
              getTargets: { type: Object },
              createJwt: { type: Object },
              getSessions: { type: Object },
              createSession: { type: Object },
              deleteSessions: {},
              getMemberships: { type: Object },
              createToken: { type: Object },
              getLogs: { type: Object },
              verify: {},
              verifyPhone: {},
              getTarget: { type: Object },
              updateTarget: { type: Object },
              getMfaFactors: {},
              getMfaRecoveryCodes: {},
              generateMfaRecoveryCodes: {},
              regenerateMfaRecoveryCodes: {},
              deleteMfaAuthenticator: {},
              deleteSession: {},
              deleteTarget: {},
              remove: {},
            },
          },
        ],
        [
          import('./account/account.controller'),
          {
            AccountController: {
              createAccount: { type: Object },
              getAccount: { type: Object },
              deleteAccount: {},
              getSessions: {},
              deleteSessions: {},
              getSession: { type: Object },
              deleteSession: {},
              updateSession: { type: Object },
              createEmailSession: {},
              createAnonymousSession: {},
              createSession: {},
              createOAuth2Session: {},
              OAuth2Callback: {},
              OAuth2CallbackWithProject: {},
              OAuth2Redirect: {},
              createOAuth2Token: {},
              createMagicURLToken: {},
              createEmailToken: {},
              updateMagicURLSession: {},
              updatePhoneSession: {},
              createPhoneToken: {},
              createJWT: {},
              getPrefs: { type: Object },
              updatePrefs: { type: Object },
              updateName: { type: Object },
              updatePassword: { type: Object },
              updateEmail: {},
              updatePhone: { type: Object },
              updateStatus: { type: Object },
              createRecovery: {},
              updateRecovery: {},
              createEmailVerification: {},
              updateEmailVerification: {},
              createPhoneVerification: {},
              updatePhoneVerification: {},
              updateMfa: { type: Object },
              getMfaFactors: {},
              createMfaAuthenticator: {},
              verifyMfaAuthenticator: { type: Object },
              createMfaRecoveryCodes: {},
              updateMfaRecoveryCodes: {},
              getMfaRecoveryCodes: {},
              deleteMfaAuthenticator: {},
              createMfaChallenge: {},
              updateMfaChallenge: { type: Object },
              createPushTarget: {},
              updatePushTarget: {},
              deletePushTarget: {},
              getIdentities: {},
              deleteIdentity: {},
            },
          },
        ],
        [
          import('./teams/teams.controller'),
          {
            TeamsController: {
              findAll: {},
              create: {},
              findOne: {},
              update: {},
              remove: {},
              getPrefs: { type: Object },
              setPrefs: { type: Object },
              teamLogs: {},
              addMember: {},
              getMembers: {},
              getMember: {},
              updateMember: {},
              updateMemberStatus: {},
              removeMember: {},
            },
          },
        ],
        [
          import('./storage/storage.controller'),
          {
            StorageController: {
              getBuckets: {},
              createBucket: {},
              getBucket: {},
              updateBucket: {},
              deleteBucket: {},
              createFile: { type: Object },
              getFile: { type: Object },
              previewFile: {},
              downloadFile: {},
              viewFile: {},
              getFileForPushNotification: {},
              updateFile: {},
              deleteFile: {},
              getUsage: {},
              getBucketUsage: {},
            },
          },
        ],
        [
          import('./messaging/messaging.controller'),
          {
            MessagingController: {
              createMailgunProvider: {},
              createSendgridProvider: {},
              createSMTPProvider: {},
              createMsg91Provider: {},
              createTelesignProvider: {},
              createTextmagicProvider: {},
              createTwilioProvider: {},
              createVonageProvider: {},
              createFcmProvider: {},
              createApnsProvider: {},
              listProviders: {},
              getProvider: {},
              updateMailgunProvider: {},
              updateSendgridProvider: {},
              updateSmtpProvider: {},
              updateMsg91Provider: {},
              updateTelesignProvider: {},
              updateTextmagicProvider: {},
              updateTwilioProvider: {},
              updateVonageProvider: {},
              updateFcmProvider: {},
              updateApnsProvider: {},
              deleteProvider: {},
              createTopic: {},
              listTopics: {},
              getTopic: {},
              updateTopic: {},
              deleteTopic: {},
              createSubscriber: {},
              listSubscribers: {},
              getSubscriber: {},
              deleteSubscriber: {},
              createEmail: {},
              createSms: {},
              createPush: {},
              listMessages: {},
              getMessage: {},
              listTargets: {},
              updateEmail: {},
              updateSms: {},
              updatePush: {},
              deleteMessage: {},
            },
          },
        ],
        [
          import('./schemas/schemas.controller'),
          {
            SchemasController: {
              queryTable: { type: [Object] },
              insertIntoTable: { type: [Object] },
              updateTables: { type: [Object] },
              upsertTable: {},
              deleteTables: { type: [Object] },
              callFunction: { type: Object },
            },
          },
        ],
        [
          import('./schemas/collections/collections.controller'),
          {
            CollectionsController: {
              findCollections: {},
              createCollection: {},
              getCollectionUsage: {},
              findCollection: {},
              findCollectionLogs: {},
              updateCollection: {},
              removeCollection: {},
              findDocuments: {},
              findAttributes: {},
              createStringAttribute: { type: Object },
              createEmailAttribute: { type: Object },
              createEnumAttribute: { type: Object },
              createIpAttribute: { type: Object },
              createUrlAttribute: { type: Object },
              createIntegerAttribute: {},
              createFloatAttribute: { type: Object },
              createBooleanAttribute: { type: Object },
              createDatetimeAttribute: { type: Object },
              createRelationAttribute: { type: Object },
              findAttribute: {},
              updateStringAttribute: {},
              updateEmailAttribute: {},
              updateEnumAttribute: {},
              updateIpAttribute: {},
              updateUrlAttribute: {},
              updateIntegerAttribute: {},
              updateFloatAttribute: {},
              updateBooleanAttribute: {},
              updateDatetimeAttribute: {},
              updateRelationAttribute: {},
              removeAttribute: {},
              createIndex: {},
              findIndexes: {},
              findIndex: { type: Object },
              removeIndex: {},
              createDocument: {},
              findDocument: {},
              findDocumentLogs: {},
              updateDocument: {},
              removeDocument: {},
            },
          },
        ],
      ],
    },
  };
};
