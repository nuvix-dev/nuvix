/* eslint-disable */
export default async () => {
  const t = {
    ['../../../libs/core/src/models/Target.model.js']: await import(
      '../../../libs/core/src/models/Target.model.js'
    ),
    ['@nuvix/db']: await import('@nuvix/db'),
    ['../../../libs/utils/src/constants.js']: await import(
      '../../../libs/utils/src/constants.js'
    ),
    ['../../../libs/core/src/models/Index.model.js']: await import(
      '../../../libs/core/src/models/Index.model.js'
    ),
    ['../../../libs/core/src/models/AuthProvider.model.js']: await import(
      '../../../libs/core/src/models/AuthProvider.model.js'
    ),
    ['../../../libs/core/src/models/Platform.model.js']: await import(
      '../../../libs/core/src/models/Platform.model.js'
    ),
    ['../../../libs/core/src/models/Webhook.model.js']: await import(
      '../../../libs/core/src/models/Webhook.model.js'
    ),
    ['../../../libs/core/src/models/Key.model.js']: await import(
      '../../../libs/core/src/models/Key.model.js'
    ),
    ['./projects/auth-settings/DTO/project-auth.dto.js']: await import(
      './projects/auth-settings/DTO/project-auth.dto.js'
    ),
  }
  return {
    '@nestjs/swagger': {
      models: [
        [
          import('../../../libs/core/src/models/base.model.js'),
          {
            BaseModel: {
              $id: { required: true, type: () => String, description: 'ID.' },
              $createdAt: {
                required: true,
                type: () => Date,
                description: 'User creation date in ISO 8601 format.',
              },
              $updatedAt: {
                required: true,
                type: () => Date,
                description: 'User update date in ISO 8601 format.',
              },
              $permissions: { required: true, type: () => [String] },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Target.model.js'),
          {
            TargetModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'Target Name.',
                default: '',
              },
              userId: { required: true, type: () => Object, default: '' },
              providerId: { required: true, type: () => Object, default: '' },
              providerType: { required: true, type: () => Object, default: '' },
              identifier: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/User.model.js'),
          {
            UserModel: {
              name: {
                required: true,
                type: () => String,
                description: 'User name.',
              },
              password: {
                required: false,
                type: () => String,
                description: 'Hashed user password.',
              },
              hash: {
                required: false,
                type: () => String,
                description: 'Password hashing algorithm.',
              },
              hashOptions: {
                required: false,
                type: () => Object,
                description: 'Password hashing algorithm configuration.',
              },
              registration: {
                required: true,
                type: () => Date,
                description: 'User registration date in ISO 8601 format.',
              },
              status: {
                required: true,
                type: () => Boolean,
                description:
                  'User status. Pass `true` for enabled and `false` for disabled.',
              },
              labels: {
                required: true,
                type: () => [String],
                description: 'Labels for the user.',
              },
              passwordUpdate: {
                required: true,
                type: () => Date,
                description: 'Password update time in ISO 8601 format.',
              },
              email: {
                required: true,
                type: () => String,
                description: 'User email address.',
              },
              phone: {
                required: true,
                type: () => String,
                nullable: true,
                description: 'User phone number in E.164 format.',
                default: null,
              },
              emailVerification: {
                required: true,
                type: () => Boolean,
                description: 'Email verification status.',
              },
              phoneVerification: {
                required: true,
                type: () => Boolean,
                description: 'Phone verification status.',
              },
              mfa: {
                required: true,
                type: () => Boolean,
                description: 'Multi factor authentication status.',
              },
              prefs: {
                required: true,
                type: () => Object,
                description: 'User preferences as a key-value object',
              },
              targets: {
                required: true,
                type: () => [
                  t['../../../libs/core/src/models/Target.model.js']
                    .TargetModel,
                ],
                description:
                  'A user-owned message receiver. A single user may have multiple e.g. emails, phones, and a browser. Each target is registered with a single provider.',
              },
              accessedAt: {
                required: true,
                type: () => Date,
                description:
                  'Most recent access date in ISO 8601 format. This attribute is only updated again after 24 hours.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Account.model.js'),
          { AccountModel: {} },
        ],
        [
          import('../../../libs/core/src/models/AlgoArgon2.model.js'),
          {
            AlgoArgon2Model: {
              type: {
                required: true,
                type: () => Object,
                description: 'Algo type.',
                default: 'argon2',
              },
              memoryCost: {
                required: true,
                type: () => Object,
                description: 'Memory used to compute hash.',
                default: 65536,
              },
              timeCost: {
                required: true,
                type: () => Object,
                description: 'Amount of time consumed to compute hash.',
                default: 4,
              },
              threads: {
                required: true,
                type: () => Object,
                description: 'Number of threads used to compute hash.',
                default: 3,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/AlgoBcrypt.model.js'),
          {
            AlgoBcryptModel: {
              type: {
                required: true,
                type: () => Object,
                description: 'Algo type.',
                default: 'bcrypt',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/AlgoMd5.model.js'),
          {
            AlgoMd5Model: {
              type: {
                required: true,
                type: () => Object,
                description: 'Algo type.',
                default: 'md5',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Attribute.model.js'),
          {
            AttributeModel: {
              key: {
                required: true,
                type: () => String,
                description: 'Attribute Key.',
              },
              type: {
                required: true,
                description: 'Attribute type.',
                enum: t['@nuvix/db'].AttributeType,
              },
              status: {
                required: true,
                type: () => Object,
                description:
                  'Attribute status. Possible values: `available`, `processing`, `deleting`, `stuck`, or `failed`.',
                default: 'available',
              },
              error: {
                required: false,
                type: () => String,
                description:
                  'Error message. Displays error generated on failure of creating or deleting an attribute.',
              },
              required: {
                required: true,
                type: () => Object,
                description: 'Is attribute required?',
                default: false,
              },
              array: {
                required: true,
                type: () => Object,
                description: 'Is attribute an array?',
                default: false,
              },
              default: {
                required: false,
                type: () => Object,
                description: 'Attribute default value.',
              },
              format: {
                required: false,
                description: 'Attribute format.',
                enum: t['../../../libs/utils/src/constants.js'].AttributeFormat,
              },
              elements: {
                required: false,
                type: () => [String],
                description: 'Enum elements (for enum type only).',
              },
              min: {
                required: false,
                type: () => Number,
                nullable: true,
                description: 'Numeric attribute options.',
              },
              max: {
                required: false,
                type: () => Number,
                nullable: true,
                description: 'Numeric attribute options.',
              },
              size: {
                required: false,
                type: () => Number,
                description: 'Attribute size (for string).',
              },
              relatedCollection: {
                required: false,
                type: () => String,
                nullable: true,
                description:
                  'Related collection ID (for relationship type only).',
              },
              relationType: {
                required: false,
                description:
                  'Relation type, possible values are: `oneToOne`, `oneToMany`, `manyToOne`, `manyToMany` (for relationship type only).',
                enum: t['@nuvix/db'].RelationType,
              },
              twoWay: {
                required: false,
                type: () => Boolean,
                description:
                  'Indicates whether the relationship is two-way (for relationship type only).',
              },
              twoWayKey: {
                required: false,
                type: () => String,
                description:
                  'Two-way attribute key (for relationship type only).',
              },
              onDelete: {
                required: false,
                description:
                  'On delete action, possible values are: `cascade`, `restrict`, or `setNull` (for relationship type only).',
                enum: t['@nuvix/db'].OnDelete,
              },
              side: {
                required: false,
                description:
                  'Attribute side (for relationship type only).\nPossible values are `parent` or `child`.',
                enum: t['@nuvix/db'].RelationSide,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Attributes.model.js'),
          {
            AttributeBooleanModel: {
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              default: {
                required: true,
                type: () => Boolean,
                nullable: true,
                default: null,
              },
            },
            AttributeDatetimeModel: {
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              format: {
                required: true,
                enum: t['../../../libs/utils/src/constants.js'].AttributeFormat,
              },
              default: {
                required: true,
                type: () => String,
                nullable: true,
                default: null,
              },
            },
            AttributeEmailModel: {
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              format: {
                required: true,
                enum: t['../../../libs/utils/src/constants.js'].AttributeFormat,
              },
              default: {
                required: true,
                type: () => String,
                nullable: true,
                default: null,
              },
            },
            AttributeEnumModel: {
              formatOptions: { required: true, type: () => Object },
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              elements: { required: true, type: () => [String] },
              format: {
                required: true,
                enum: t['../../../libs/utils/src/constants.js'].AttributeFormat,
              },
              default: {
                required: true,
                type: () => String,
                nullable: true,
                default: null,
              },
            },
            AttributeFloatModel: {
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              min: { required: true, type: () => Number, nullable: true },
              max: { required: true, type: () => Number, nullable: true },
              default: {
                required: true,
                type: () => Number,
                nullable: true,
                default: null,
              },
            },
            AttributeIPModel: {
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              format: {
                required: true,
                enum: t['../../../libs/utils/src/constants.js'].AttributeFormat,
              },
              default: {
                required: true,
                type: () => String,
                nullable: true,
                default: null,
              },
            },
            AttributeIntegerModel: {
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              min: { required: true, type: () => Number, nullable: true },
              max: { required: true, type: () => Number, nullable: true },
              default: {
                required: true,
                type: () => Number,
                nullable: true,
                default: null,
              },
            },
            AttributeListModel: {
              total: { required: true, type: () => Object, default: 0 },
              attributes: { required: true, type: () => [Object] },
            },
            AttributeRelationshipModel: {
              options: { required: true, type: () => Object },
              relatedCollection: {
                required: true,
                type: () => String,
                nullable: true,
              },
              relationType: {
                required: true,
                enum: t['@nuvix/db'].RelationType,
              },
              twoWay: { required: true, type: () => Boolean },
              twoWayKey: { required: true, type: () => String },
              onDelete: { required: true, enum: t['@nuvix/db'].OnDelete },
              side: { required: true, enum: t['@nuvix/db'].RelationSide },
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
            },
            AttributeStringModel: {
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              size: { required: true, type: () => Object, default: 0 },
              default: {
                required: true,
                type: () => String,
                nullable: true,
                default: null,
              },
            },
            AttributeURLModel: {
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              format: {
                required: true,
                enum: t['../../../libs/utils/src/constants.js'].AttributeFormat,
              },
              default: {
                required: true,
                type: () => String,
                nullable: true,
                default: null,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/AuthProvider.model.js'),
          {
            AuthProviderModel: {
              key: {
                required: true,
                type: () => Object,
                description: 'Auth Provider key.',
                default: '',
              },
              name: {
                required: true,
                type: () => Object,
                description: 'Auth Provider name.',
                default: '',
              },
              appId: {
                required: true,
                type: () => Object,
                description: 'OAuth 2.0 application ID.',
                default: '',
              },
              secret: {
                required: true,
                type: () => String,
                description:
                  'OAuth 2.0 application secret. Might be JSON string if provider requires extra configuration.',
              },
              enabled: {
                required: true,
                type: () => Object,
                description:
                  'Auth Provider is active and can be used to create session.',
                default: false,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Bucket.model.js'),
          {
            BucketModel: {
              fileSecurity: {
                required: true,
                type: () => Object,
                description: 'Whether file-level security is enabled.',
                default: false,
              },
              name: {
                required: true,
                type: () => Object,
                description: 'Bucket name.',
                default: '',
              },
              enabled: {
                required: true,
                type: () => Object,
                description: 'Bucket enabled.',
                default: true,
              },
              maximumFileSize: {
                required: true,
                type: () => Object,
                description: 'Maximum file size supported.',
                default: 0,
              },
              allowedFileExtensions: {
                required: true,
                type: () => [String],
                description: 'Allowed file extensions.',
              },
              compression: {
                required: true,
                type: () => Object,
                description: 'Compression algorithm chosen for compression.',
                default: '',
              },
              encryption: {
                required: true,
                type: () => Object,
                description: 'Bucket is encrypted.',
                default: true,
              },
              antivirus: {
                required: true,
                type: () => Object,
                description: 'Virus scanning is enabled.',
                default: true,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Index.model.js'),
          {
            IndexModel: {
              key: {
                required: true,
                type: () => Object,
                description: 'Index Key.',
                default: '',
              },
              type: {
                required: true,
                type: () => Object,
                description: 'Index type.',
                default: '',
              },
              status: {
                required: true,
                type: () => Object,
                description:
                  'Index status. Possible values: `available`, `processing`, `deleting`, `stuck`, or `failed`.',
                default: '',
              },
              error: {
                required: true,
                type: () => Object,
                description:
                  'Error message. Displays error generated on failure of creating or deleting an index.',
                default: '',
              },
              attributes: {
                required: true,
                type: () => [String],
                description: 'Index attributes.',
              },
              orders: {
                required: true,
                type: () => [String],
                description: 'Index orders.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Collection.model.js'),
          {
            CollectionModel: {
              $schema: {
                required: true,
                type: () => Object,
                description: 'Schema ID.',
                default: '',
              },
              name: {
                required: true,
                type: () => Object,
                description: 'Collection name.',
                default: '',
              },
              enabled: {
                required: true,
                type: () => Boolean,
                description:
                  "Collection enabled. Can be 'enabled' or 'disabled'.\nWhen disabled, the collection is inaccessible to users,\nbut remains accessible to Server SDKs using API keys.",
              },
              documentSecurity: {
                required: true,
                type: () => Boolean,
                description: 'Whether document-level permissions are enabled.',
              },
              attributes: {
                required: true,
                type: () => [Object],
                description: 'Collection attributes.',
              },
              indexes: {
                required: true,
                type: () => [
                  t['../../../libs/core/src/models/Index.model.js'].IndexModel,
                ],
                description: 'Collection indexes.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Continent.model.js'),
          {
            ContinentModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'Continent name.',
                default: '',
              },
              code: {
                required: true,
                type: () => Object,
                description: 'Continent two letter code.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Country.model.js'),
          {
            CountryModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'Country name.',
                default: '',
              },
              code: {
                required: true,
                type: () => Object,
                description: 'Country two-character ISO 3166-1 alpha code.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Currency.model.js'),
          {
            CurrencyModel: {
              symbol: {
                required: true,
                type: () => Object,
                description: 'Currency symbol.',
                default: '',
              },
              name: {
                required: true,
                type: () => Object,
                description: 'Currency name.',
                default: '',
              },
              symbolNative: {
                required: true,
                type: () => Object,
                description: 'Currency native symbol.',
                default: '',
              },
              decimalDigits: {
                required: true,
                type: () => Object,
                description: 'Number of decimal digits.',
                default: 0,
              },
              rounding: {
                required: true,
                type: () => Object,
                description: 'Currency digit rounding.',
                default: 0,
              },
              code: {
                required: true,
                type: () => Object,
                description:
                  'Currency code in ISO 4217 three-character format.',
                default: '',
              },
              namePlural: {
                required: true,
                type: () => Object,
                description: 'Currency plural name.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Document.model.js'),
          {
            DocumentModel: {
              $collection: {
                required: true,
                type: () => String,
                description: 'Collection ID.',
              },
              $schema: {
                required: true,
                type: () => String,
                description: 'Database ID.',
              },
              runtime: {
                required: true,
                type: () => String,
                description: 'Runtime.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/File.model.js'),
          {
            FileModel: {
              bucketId: {
                required: true,
                type: () => Object,
                description: 'Bucket ID.',
                default: '',
              },
              permissions: {
                required: true,
                type: () => [String],
                description: 'File permissions.',
              },
              name: {
                required: true,
                type: () => Object,
                description: 'File name.',
                default: '',
              },
              signature: {
                required: true,
                type: () => Object,
                description: 'File MD5 signature.',
                default: '',
              },
              mimeType: {
                required: true,
                type: () => Object,
                description: 'File mime type.',
                default: '',
              },
              sizeOriginal: {
                required: true,
                type: () => Object,
                description: 'File original size in bytes.',
                default: 0,
              },
              chunksTotal: {
                required: true,
                type: () => Object,
                description: 'Total number of chunks available.',
                default: 0,
              },
              chunksUploaded: {
                required: true,
                type: () => Object,
                description: 'Total number of chunks uploaded.',
                default: 0,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Health.model.js'),
          {
            HealthStatusModel: {
              name: { required: true, type: () => Object, default: '' },
              ping: { required: true, type: () => Object, default: 0 },
              status: { required: true, type: () => Object, default: '' },
            },
            HealthTimeModel: {
              remoteTime: { required: true, type: () => Object, default: 0 },
              localTime: { required: true, type: () => Object, default: 0 },
              diff: { required: true, type: () => Object, default: 0 },
            },
            HealthVersionModel: {
              version: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Identity.model.js'),
          {
            IdentityModel: {
              userId: {
                required: true,
                type: () => Object,
                description: 'User ID.',
                default: '',
              },
              provider: {
                required: true,
                type: () => Object,
                description: 'Identity Provider.',
                default: '',
              },
              providerUid: {
                required: true,
                type: () => Object,
                description: 'ID of the User in the Identity Provider.',
                default: '',
              },
              providerEmail: {
                required: true,
                type: () => Object,
                description: 'Email of the User in the Identity Provider.',
                default: '',
              },
              providerAccessToken: {
                required: true,
                type: () => Object,
                description: 'Identity Provider Access Token.',
                default: '',
              },
              providerAccessTokenExpiry: {
                required: true,
                type: () => String,
                description:
                  'The date of when the access token expires in ISO 8601 format.',
              },
              providerRefreshToken: {
                required: true,
                type: () => Object,
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/JWT.model.js'),
          {
            JWTModel: {
              jwt: {
                required: true,
                type: () => Object,
                description: 'JWT encoded string.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Key.model.js'),
          {
            KeyModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Key name.',
              },
              expire: {
                required: true,
                type: () => String,
                description: 'Key expiration date in ISO 8601 format.',
              },
              scopes: {
                required: true,
                type: () => [String],
                description: 'Allowed permission scopes.',
              },
              secret: {
                required: true,
                type: () => String,
                description: 'Secret key.',
              },
              accessedAt: {
                required: true,
                type: () => String,
                description:
                  'Most recent access date in ISO 8601 format. This attribute is only updated again after 24 hours.',
              },
              sdks: {
                required: true,
                type: () => [String],
                description: 'List of SDK user agents that used this key.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Language.model.js'),
          {
            LanguageModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'Language name.',
                default: '',
              },
              code: {
                required: true,
                type: () => Object,
                description: 'Language two-character ISO 639-1 codes.',
                default: '',
              },
              nativeName: {
                required: true,
                type: () => Object,
                description: 'Language native name.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Locale.model.js'),
          {
            LocaleModel: {
              ip: {
                required: true,
                type: () => Object,
                description: 'User IP address.',
                default: '',
              },
              countryCode: {
                required: true,
                type: () => Object,
                description: 'Country code in ISO 3166-1 two-character format.',
                default: '',
              },
              country: {
                required: true,
                type: () => Object,
                description: 'Country name. This field supports localization.',
                default: '',
              },
              continentCode: {
                required: true,
                type: () => Object,
                description: 'Continent code. A two character continent code.',
                default: '',
              },
              continent: {
                required: true,
                type: () => Object,
                description:
                  'Continent name. This field supports localization.',
                default: '',
              },
              eu: {
                required: true,
                type: () => Object,
                description: 'True if country is part of the European Union.',
                default: false,
              },
              currency: {
                required: true,
                type: () => Object,
                description:
                  'Currency code in ISO 4217 three-character format.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/LocaleCode.model.js'),
          {
            LocaleCodeModel: {
              code: {
                required: true,
                type: () => Object,
                description: 'Locale codes in ISO 639-1.',
                default: '',
              },
              name: {
                required: true,
                type: () => Object,
                description: 'Locale name.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Log.model.js'),
          {
            LogModel: {
              event: {
                required: true,
                type: () => Object,
                description: 'Event name.',
                default: '',
              },
              userId: {
                required: true,
                type: () => Object,
                description: 'User ID.',
                default: '',
              },
              userEmail: {
                required: true,
                type: () => Object,
                description: 'User Email.',
                default: '',
              },
              userName: {
                required: true,
                type: () => Object,
                description: 'User Name.',
                default: '',
              },
              mode: {
                required: true,
                type: () => Object,
                description: 'API mode when event triggered.',
                default: '',
              },
              ip: {
                required: true,
                type: () => Object,
                description: 'IP session in use when the session was created.',
                default: '',
              },
              time: {
                required: true,
                type: () => String,
                description: 'Log creation date in ISO 8601 format.',
              },
              osCode: { required: true, type: () => Object, default: '' },
              osName: {
                required: true,
                type: () => Object,
                description: 'Operating system name.',
                default: '',
              },
              osVersion: {
                required: true,
                type: () => Object,
                description: 'Operating system version.',
                default: '',
              },
              clientType: {
                required: true,
                type: () => Object,
                description: 'Client type.',
                default: '',
              },
              clientCode: {
                required: true,
                type: () => Object,
                description: 'Client code name.',
                default: '',
              },
              clientName: {
                required: true,
                type: () => Object,
                description: 'Client name.',
                default: '',
              },
              clientVersion: {
                required: true,
                type: () => Object,
                description: 'Client version.',
                default: '',
              },
              clientEngine: {
                required: true,
                type: () => Object,
                description: 'Client engine name.',
                default: '',
              },
              clientEngineVersion: {
                required: true,
                type: () => Object,
                description: 'Client engine version.',
                default: '',
              },
              deviceName: {
                required: true,
                type: () => Object,
                description: 'Device name.',
                default: '',
              },
              deviceBrand: {
                required: true,
                type: () => Object,
                description: 'Device brand name.',
                default: '',
              },
              deviceModel: {
                required: true,
                type: () => Object,
                description: 'Device model name.',
                default: '',
              },
              countryCode: {
                required: true,
                type: () => Object,
                description: 'Country two-character ISO 3166-1 alpha code.',
                default: '',
              },
              countryName: {
                required: true,
                type: () => Object,
                description: 'Country name.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Membership.model.js'),
          {
            MembershipModel: {
              userId: {
                required: true,
                type: () => Object,
                description: 'User ID.',
                default: '',
              },
              userName: {
                required: true,
                type: () => Object,
                description: 'User name.',
                default: '',
              },
              userEmail: {
                required: true,
                type: () => Object,
                description: 'User email address.',
                default: '',
              },
              teamId: {
                required: true,
                type: () => Object,
                description: 'Team ID.',
                default: '',
              },
              teamName: {
                required: true,
                type: () => Object,
                description: 'Team name.',
                default: '',
              },
              invited: {
                required: true,
                type: () => String,
                description:
                  'Date the user has been invited to join the team in ISO 8601 format.',
              },
              joined: { required: true, type: () => String },
              confirm: { required: true, type: () => Object, default: false },
              mfa: {
                required: true,
                type: () => Object,
                description:
                  'Multi-factor authentication status, true if the user has MFA enabled or false otherwise.',
                default: false,
              },
              roles: {
                required: true,
                type: () => [String],
                description: 'User list of roles.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Message.model.js'),
          {
            MessageModel: {
              providerType: {
                required: true,
                type: () => Object,
                description: 'Message provider type.',
                default: '',
              },
              topics: {
                required: true,
                type: () => [String],
                description: 'Topic IDs set as recipients.',
              },
              users: { required: true, type: () => [String] },
              targets: { required: true, type: () => [String] },
              scheduledAt: { required: false, type: () => String },
              deliveredAt: { required: false, type: () => String },
              deliveryErrors: { required: true, type: () => [String] },
              deliveredTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              data: {
                required: true,
                type: () => Object,
                description: 'Data of the message.',
              },
              status: { required: true, type: () => Object, default: 'draft' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Metric.model.js'),
          {
            MetricModel: {
              value: {
                required: true,
                type: () => Object,
                description: 'The value of this metric at the timestamp.',
                default: -1,
              },
              date: { required: true, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/MetricBreakdown.model.js'),
          {
            MetricBreakdownModel: {
              resourceId: {
                required: true,
                type: () => Object,
                description: 'Resource ID.',
                default: '',
              },
              name: {
                required: true,
                type: () => Object,
                description: 'Resource name.',
                default: '',
              },
              value: {
                required: true,
                type: () => Object,
                description: 'The value of this metric at the timestamp.',
                default: 0,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/MFAChallenge.model.js'),
          {
            MFAChallengeModel: {
              userId: {
                required: true,
                type: () => Object,
                description: 'User ID.',
                default: '',
              },
              expire: {
                required: true,
                type: () => String,
                description: 'Token expiration date in ISO 8601 format.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/MFAFactors.model.js'),
          {
            MFAFactorsModel: {
              totp: {
                required: true,
                type: () => Object,
                description:
                  'Can TOTP be used for MFA challenge for this account.',
                default: false,
              },
              phone: {
                required: true,
                type: () => Object,
                description:
                  'Can phone (SMS) be used for MFA challenge for this account.',
                default: false,
              },
              email: {
                required: true,
                type: () => Object,
                description:
                  'Can email be used for MFA challenge for this account.',
                default: false,
              },
              recoveryCode: {
                required: true,
                type: () => Object,
                description:
                  'Can recovery code be used for MFA challenge for this account.',
                default: false,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/MFARecoveryCodes.model.js'),
          {
            MFARecoveryCodesModel: {
              recoveryCodes: {
                required: true,
                type: () => [String],
                description: 'Recovery codes.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/MFAType.model.js'),
          {
            MFATypeModel: {
              secret: {
                required: true,
                type: () => Object,
                description: 'Secret token used for TOTP factor.',
                default: '',
              },
              uri: {
                required: true,
                type: () => Object,
                description: 'URI for authenticator apps.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/MockNumber.model.js'),
          {
            MockNumberModel: {
              phone: {
                required: true,
                type: () => Object,
                description:
                  'Mock phone number for testing phone authentication. Useful for testing phone authentication without sending an SMS.',
                default: '',
              },
              otp: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/OtherAlgos.model.js'),
          {
            AlgoPhpassModel: {
              type: { required: true, type: () => Object, default: 'phpass' },
            },
            AlgoShaModel: {
              type: { required: true, type: () => Object, default: 'sha' },
            },
            AlgoScryptModel: {
              type: { required: true, type: () => Object, default: 'scrypt' },
              costCpu: { required: true, type: () => Object, default: 8 },
              costMemory: { required: true, type: () => Object, default: 14 },
              costParallel: { required: true, type: () => Object, default: 1 },
              length: { required: true, type: () => Object, default: 64 },
            },
            AlgoScryptModifiedModel: {
              type: {
                required: true,
                type: () => Object,
                default: 'scryptMod',
              },
              salt: { required: true, type: () => Object, default: '' },
              saltSeparator: {
                required: true,
                type: () => Object,
                default: '',
              },
              signerKey: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Phone.model.js'),
          {
            PhoneModel: {
              code: {
                required: true,
                type: () => Object,
                description: 'Phone code.',
                default: '',
              },
              countryCode: { required: true, type: () => Object, default: '' },
              countryName: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Platform.model.js'),
          {
            PlatformModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'Platform name.',
                default: '',
              },
              type: { required: true, type: () => Object, default: '' },
              key: { required: true, type: () => Object, default: '' },
              store: { required: true, type: () => Object, default: '' },
              hostname: { required: true, type: () => Object, default: '' },
              httpUser: { required: true, type: () => Object, default: '' },
              httpPass: { required: true, type: () => Object, default: '' },
              public: { required: true, type: () => Object, default: false },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Webhook.model.js'),
          {
            WebhookModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'Webhook name.',
                default: '',
              },
              url: { required: true, type: () => Object, default: '' },
              events: { required: true, type: () => [String] },
              security: { required: true, type: () => Object, default: true },
              httpUser: { required: true, type: () => Object, default: '' },
              httpPass: { required: true, type: () => Object, default: '' },
              signatureKey: { required: true, type: () => Object, default: '' },
              enabled: { required: true, type: () => Object, default: true },
              logs: { required: true, type: () => Object, default: '' },
              attempts: { required: true, type: () => Object, default: 0 },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Project.model.js'),
          {
            ProjectModel: {
              auths: { required: true, type: () => Object },
              services: { required: true, type: () => Object },
              smtp: { required: true, type: () => Object },
              metadata: { required: true, type: () => Object },
              name: {
                required: true,
                type: () => String,
                description: 'Project name.',
              },
              description: {
                required: true,
                type: () => String,
                description: 'Project description.',
              },
              teamId: {
                required: true,
                type: () => String,
                description: 'Project team ID.',
              },
              logo: {
                required: true,
                type: () => String,
                description: 'Project logo file ID.',
              },
              url: {
                required: true,
                type: () => String,
                description: 'Project website URL.',
              },
              oAuthProviders: {
                required: true,
                type: () => [
                  t['../../../libs/core/src/models/AuthProvider.model.js']
                    .AuthProviderModel,
                ],
                description: 'List of Auth Providers.',
              },
              platforms: {
                required: true,
                type: () => [
                  t['../../../libs/core/src/models/Platform.model.js']
                    .PlatformModel,
                ],
                description: 'List of Platforms.',
              },
              webhooks: {
                required: true,
                type: () => [
                  t['../../../libs/core/src/models/Webhook.model.js']
                    .WebhookModel,
                ],
                description: 'List of Webhooks.',
              },
              keys: {
                required: true,
                type: () => [
                  t['../../../libs/core/src/models/Key.model.js'].KeyModel,
                ],
                description: 'List of API Keys.',
              },
              pingCount: {
                required: true,
                type: () => Number,
                description:
                  'Number of times the ping was received for this project.',
              },
              pingedAt: {
                required: true,
                type: () => String,
                description: 'Last ping datetime in ISO 8601 format.',
              },
              region: {
                required: true,
                type: () => String,
                description: 'Project region',
              },
              status: {
                required: true,
                type: () => String,
                description: 'Project status',
              },
              enabled: {
                required: true,
                type: () => Boolean,
                description: 'Is project enabled',
              },
              environment: {
                required: true,
                type: () => String,
                description: 'Environment',
              },
              database: {
                required: true,
                type: () => Object,
                description: 'Database',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Provider.model.js'),
          {
            ProviderModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'The name for the provider instance.',
                default: '',
              },
              provider: { required: true, type: () => Object, default: '' },
              enabled: { required: true, type: () => Object, default: true },
              type: { required: true, type: () => Object, default: '' },
              credentials: { required: true, type: () => Object },
              options: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Schema.model.js'),
          {
            SchemaModel: {
              name: { required: true, type: () => String },
              description: { required: false, type: () => String },
              type: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Session.model.js'),
          {
            SessionModel: {
              userId: {
                required: true,
                type: () => Object,
                description: 'User ID.',
                default: '',
              },
              expire: { required: true, type: () => Object, default: '' },
              provider: { required: true, type: () => Object, default: '' },
              providerUid: { required: true, type: () => Object, default: '' },
              providerAccessToken: {
                required: true,
                type: () => Object,
                default: '',
              },
              providerAccessTokenExpiry: {
                required: true,
                type: () => Object,
                default: '',
              },
              providerRefreshToken: {
                required: true,
                type: () => Object,
                default: '',
              },
              ip: { required: true, type: () => Object, default: '' },
              osCode: { required: true, type: () => Object, default: '' },
              osName: { required: true, type: () => Object, default: '' },
              osVersion: { required: true, type: () => Object, default: '' },
              clientType: { required: true, type: () => Object, default: '' },
              clientCode: { required: true, type: () => Object, default: '' },
              clientName: { required: true, type: () => Object, default: '' },
              clientVersion: {
                required: true,
                type: () => Object,
                default: '',
              },
              clientEngine: { required: true, type: () => Object, default: '' },
              clientEngineVersion: {
                required: true,
                type: () => Object,
                default: '',
              },
              deviceName: { required: true, type: () => Object, default: '' },
              deviceBrand: { required: true, type: () => Object, default: '' },
              deviceModel: { required: true, type: () => Object, default: '' },
              countryCode: { required: true, type: () => Object, default: '' },
              countryName: { required: true, type: () => Object, default: '' },
              current: { required: true, type: () => Object, default: false },
              factors: { required: true, type: () => [String] },
              secret: { required: true, type: () => Object, default: '' },
              mfaUpdatedAt: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Subscriber.model.js'),
          {
            SubscriberModel: {
              targetId: {
                required: true,
                type: () => Object,
                description: 'Target ID.',
                default: '',
              },
              target: { required: true, type: () => Object },
              userId: { required: true, type: () => Object, default: '' },
              userName: { required: true, type: () => Object, default: '' },
              topicId: { required: true, type: () => Object, default: '' },
              providerType: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Team.model.js'),
          {
            TeamModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'Team name.',
                default: '',
              },
              total: { required: true, type: () => Object, default: 0 },
              prefs: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Template.model.js'),
          {
            TemplateModel: {
              type: {
                required: true,
                type: () => Object,
                description: 'Template type.',
                default: '',
              },
              locale: { required: true, type: () => Object, default: '' },
              message: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/TemplateEmail.model.js'),
          {
            TemplateEmailModel: {
              senderName: {
                required: true,
                type: () => Object,
                description: 'Name of the sender.',
                default: '',
              },
              senderEmail: { required: true, type: () => Object, default: '' },
              replyTo: { required: true, type: () => Object, default: '' },
              subject: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/TemplateSMS.model.js'),
          { TemplateSMSModel: {} },
        ],
        [
          import('../../../libs/core/src/models/TemplateVariable.model.js'),
          {
            TemplateVariableModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'Variable Name.',
                default: '',
              },
              description: { required: true, type: () => Object, default: '' },
              value: { required: true, type: () => Object, default: '' },
              placeholder: { required: true, type: () => Object, default: '' },
              required: { required: true, type: () => Object, default: false },
              type: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Token.model.js'),
          {
            TokenModel: {
              userId: {
                required: true,
                type: () => Object,
                description: 'User ID.',
                default: '',
              },
              secret: { required: true, type: () => Object, default: '' },
              expire: { required: true, type: () => Object, default: '' },
              phrase: { required: true, type: () => Object, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Topic.model.js'),
          {
            TopicModel: {
              name: {
                required: true,
                type: () => Object,
                description: 'The name of the topic.',
                default: '',
              },
              emailTotal: { required: true, type: () => Object, default: 0 },
              smsTotal: { required: true, type: () => Object, default: 0 },
              pushTotal: { required: true, type: () => Object, default: 0 },
              subscribe: { required: true, type: () => [String] },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Usage.model.js'),
          {
            UsageBucketsModel: {
              range: { required: true, type: () => Object, default: '' },
              filesTotal: { required: true, type: () => Object, default: 0 },
              filesStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              files: { required: true, type: () => [Object] },
              storage: { required: true, type: () => [Object] },
            },
            UsageCollectionModel: {
              range: { required: true, type: () => Object, default: '' },
              documentsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              documents: { required: true, type: () => [Object] },
            },
            UsageDatabaseModel: {
              range: { required: true, type: () => Object, default: '' },
              collectionsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              documentsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              collections: { required: true, type: () => [Object] },
              documents: { required: true, type: () => [Object] },
            },
            UsageDatabasesModel: {
              range: { required: true, type: () => Object, default: '' },
              databasesTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              collectionsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              documentsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              databases: { required: true, type: () => [Object] },
              collections: { required: true, type: () => [Object] },
              documents: { required: true, type: () => [Object] },
            },
            UsageFunctionModel: {
              range: { required: true, type: () => Object, default: '' },
              deploymentsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              deploymentsStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              buildsTotal: { required: true, type: () => Object, default: 0 },
              buildsStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              buildsTimeTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              buildsMbSecondsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              executionsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              executionsTimeTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              executionsMbSecondsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              deployments: { required: true, type: () => [Object] },
              deploymentsStorage: { required: true, type: () => [Object] },
              builds: { required: true, type: () => [Object] },
              buildsStorage: { required: true, type: () => [Object] },
              buildsTime: { required: true, type: () => [Object] },
              buildsMbSeconds: { required: true, type: () => [Object] },
              executions: { required: true, type: () => [Object] },
              executionsTime: { required: true, type: () => [Object] },
              executionsMbSeconds: { required: true, type: () => [Object] },
            },
            UsageFunctionsModel: {
              range: { required: true, type: () => Object, default: '' },
              functionsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              deploymentsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              deploymentsStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              buildsTotal: { required: true, type: () => Object, default: 0 },
              buildsStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              buildsTimeTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              buildsMbSecondsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              executionsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              executionsTimeTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              executionsMbSecondsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              functions: { required: true, type: () => [Object] },
              deployments: { required: true, type: () => [Object] },
              deploymentsStorage: { required: true, type: () => [Object] },
              builds: { required: true, type: () => [Object] },
              buildsStorage: { required: true, type: () => [Object] },
              buildsTime: { required: true, type: () => [Object] },
              buildsMbSeconds: { required: true, type: () => [Object] },
              executions: { required: true, type: () => [Object] },
              executionsTime: { required: true, type: () => [Object] },
              executionsMbSeconds: { required: true, type: () => [Object] },
            },
            UsageProjectModel: {
              executionsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              documentsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              databasesTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              usersTotal: { required: true, type: () => Object, default: 0 },
              filesStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              functionsStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              buildsStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              deploymentsStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              bucketsTotal: { required: true, type: () => Object, default: 0 },
              executionsMbSecondsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              buildsMbSecondsTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              requests: { required: true, type: () => [Object] },
              network: { required: true, type: () => [Object] },
              users: { required: true, type: () => [Object] },
              executions: { required: true, type: () => [Object] },
              executionsBreakdown: { required: true, type: () => [Object] },
              bucketsBreakdown: { required: true, type: () => [Object] },
              executionsMbSecondsBreakdown: {
                required: true,
                type: () => [Object],
              },
              buildsMbSecondsBreakdown: {
                required: true,
                type: () => [Object],
              },
              functionsStorageBreakdown: {
                required: true,
                type: () => [Object],
              },
            },
            UsageStorageModel: {
              range: { required: true, type: () => Object, default: '' },
              bucketsTotal: { required: true, type: () => Object, default: 0 },
              filesTotal: { required: true, type: () => Object, default: 0 },
              filesStorageTotal: {
                required: true,
                type: () => Object,
                default: 0,
              },
              buckets: { required: true, type: () => [Object] },
              files: { required: true, type: () => [Object] },
              storage: { required: true, type: () => [Object] },
            },
            UsageUsersModel: {
              range: { required: true, type: () => Object, default: '' },
              usersTotal: { required: true, type: () => Object, default: 0 },
              sessionsTotal: { required: true, type: () => Object, default: 0 },
              users: { required: true, type: () => [Object] },
              sessions: { required: true, type: () => [Object] },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/column-create.dto.js'),
          {
            ColumnCreateDTO: {
              name: { required: true, type: () => String },
              table_id: { required: true, type: () => Number },
              type: { required: true, type: () => String },
              is_identity: { required: false, type: () => Boolean },
              identity_generation: { required: false, type: () => Object },
              is_nullable: { required: false, type: () => Boolean },
              is_primary_key: { required: false, type: () => Boolean },
              is_unique: { required: false, type: () => Boolean },
              default_value: { required: false, type: () => Object },
              default_value_format: { required: false, type: () => Object },
              comment: { required: false, type: () => String },
              check: { required: false, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/column-privilege.dto.js'),
          {
            ColumnPrivilegeQueryDTO: {
              include_system_schemas: { required: false, type: () => Boolean },
              included_schemas: { required: false, type: () => String },
              excluded_schemas: { required: false, type: () => String },
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/column-privilege-grant.dto.js'),
          {
            ColumnPrivilegeGrantDTO: {
              grantee: { required: true, type: () => String },
              privilege_type: { required: true, type: () => Object },
              column_id: { required: true, type: () => String },
              is_grantable: { required: false, type: () => Boolean },
            },
          },
        ],
        [
          import(
            '../../../libs/pg-meta/src/DTO/column-privilege-revoke.dto.js'
          ),
          {
            ColumnPrivilegeRevokeDTO: {
              column_id: { required: true, type: () => String },
              grantee: { required: true, type: () => String },
              privilege_type: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/column-update.dto.js'),
          {
            ColumnUpdateDTO: {
              name: { required: false, type: () => String },
              type: { required: false, type: () => String },
              drop_default: { required: false, type: () => Boolean },
              default_value: { required: false, type: () => Object },
              default_value_format: { required: false, type: () => Object },
              is_identity: { required: false, type: () => Boolean },
              identity_generation: { required: false, type: () => Object },
              is_nullable: { required: false, type: () => Boolean },
              is_unique: { required: false, type: () => Boolean },
              comment: { required: false, type: () => String },
              check: { required: false, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/config.dto.js'),
          {
            ConfigQueryDTO: {
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/extension.dto.js'),
          {
            ExtensionQueryDTO: {
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/extension-create.dto.js'),
          {
            ExtensionCreateDTO: {
              name: { required: true, type: () => String },
              schema: { required: false, type: () => String },
              version: { required: false, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/extension-delete.dto.js'),
          {
            ExtensionDeleteQueryDTO: {
              cascade: { required: false, type: () => Boolean },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/extension-name.dto.js'),
          {
            ExtensionNameParamDTO: {
              name: { required: true, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/extension-update.dto.js'),
          {
            ExtensionUpdateDTO: {
              schema: { required: false, type: () => String },
              version: { required: false, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/foreign-table.dto.js'),
          {
            ForeignTableQueryDTO: {
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
              include_columns: { required: false, type: () => Boolean },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/foreign-table-id.dto.js'),
          {
            ForeignTableIdParamDTO: {
              id: { required: true, type: () => Number, minimum: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/function.dto.js'),
          {
            FunctionQueryDTO: {
              include_system_schemas: { required: false, type: () => Boolean },
              included_schemas: { required: false, type: () => String },
              excluded_schemas: { required: false, type: () => String },
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/function-create.dto.js'),
          {
            FunctionCreateDTO: {
              name: { required: true, type: () => String },
              definition: { required: true, type: () => String },
              schema: { required: false, type: () => String },
              language: { required: false, type: () => String },
              args: { required: false, type: () => [String] },
              return_type: { required: false, type: () => String },
              behavior: { required: false, type: () => Object },
              security_definer: { required: false, type: () => Boolean },
              config_params: { required: false, type: () => Object },
              comment: { required: false, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/function-id.dto.js'),
          {
            FunctionIdParamDTO: {
              id: { required: true, type: () => Number, minimum: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/function-update.dto.js'),
          {
            FunctionUpdateDTO: {
              name: { required: false, type: () => String },
              schema: { required: false, type: () => String },
              definition: { required: false, type: () => String },
              language: { required: false, type: () => String },
              args: { required: false, type: () => [String] },
              return_type: { required: false, type: () => String },
              behavior: { required: false, type: () => Object },
              security_definer: { required: false, type: () => Boolean },
              config_params: { required: false, type: () => Object },
              comment: { required: false, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/generator.dto.js'),
          {
            GeneratorQueryDTO: {
              excluded_schemas: { required: false, type: () => String },
              included_schemas: { required: false, type: () => String },
              detect_one_to_one_relationships: {
                required: false,
                type: () => Boolean,
              },
              access_control: { required: false, type: () => Object },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/index.dto.js'),
          {
            IndexQueryDTO: {
              include_system_schemas: { required: false, type: () => Boolean },
              included_schemas: { required: false, type: () => String },
              excluded_schemas: { required: false, type: () => String },
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/index-id.dto.js'),
          {
            IndexIdParamDTO: {
              id: { required: true, type: () => Number, minimum: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/materialized-view.dto.js'),
          {
            MaterializedViewQueryDTO: {
              included_schemas: { required: false, type: () => String },
              excluded_schemas: { required: false, type: () => String },
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
              include_columns: { required: false, type: () => Boolean },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/materialized-view-id.dto.js'),
          {
            MaterializedViewIdParamDTO: {
              id: { required: true, type: () => Number, minimum: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/policy.dto.js'),
          {
            PolicyQueryDTO: {
              include_system_schemas: { required: false, type: () => Boolean },
              included_schemas: { required: false, type: () => String },
              excluded_schemas: { required: false, type: () => String },
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/policy-create.dto.js'),
          {
            PolicyCreateDTO: {
              name: { required: true, type: () => String },
              table: { required: true, type: () => String },
              schema: { required: false, type: () => String },
              definition: { required: false, type: () => String },
              check: { required: false, type: () => String },
              action: { required: false, type: () => Object },
              command: { required: false, type: () => Object },
              roles: { required: false, type: () => [String], minItems: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/policy-update.dto.js'),
          {
            PolicyUpdateDTO: {
              name: { required: true, type: () => String },
              definition: { required: false, type: () => String },
              check: { required: false, type: () => String },
              action: { required: false, type: () => Object },
              command: { required: false, type: () => Object },
              roles: { required: false, type: () => [String], minItems: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/publication.dto.js'),
          {
            PublicationQueryDTO: {
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/publication-create.dto.js'),
          {
            PublicationCreateDTO: {
              name: { required: true, type: () => String },
              publish_insert: { required: false, type: () => Boolean },
              publish_update: { required: false, type: () => Boolean },
              publish_delete: { required: false, type: () => Boolean },
              publish_truncate: { required: false, type: () => Boolean },
              tables: { required: false, type: () => [String], minItems: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/publication-update.dto.js'),
          {
            PublicationUpdateDTO: {
              name: { required: false, type: () => String },
              owner: { required: false, type: () => String },
              publish_insert: { required: false, type: () => Boolean },
              publish_update: { required: false, type: () => Boolean },
              publish_delete: { required: false, type: () => Boolean },
              publish_truncate: { required: false, type: () => Boolean },
              tables: {
                required: false,
                type: () => [String],
                nullable: true,
                minItems: 1,
              },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/query.dto.js'),
          {
            QueryDTO: { query: { required: true, type: () => String } },
            DeparseDTO: { ast: { required: true, type: () => Object } },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/role.dto.js'),
          {
            RoleQueryDTO: {
              include_default_roles: { required: false, type: () => Boolean },
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/role-create.dto.js'),
          {
            RoleCreateDTO: {
              name: { required: true, type: () => String },
              is_superuser: { required: false, type: () => Boolean },
              can_create_db: { required: false, type: () => Boolean },
              can_create_role: { required: false, type: () => Boolean },
              inherit_role: { required: false, type: () => Boolean },
              can_login: { required: false, type: () => Boolean },
              is_replication_role: { required: false, type: () => Boolean },
              can_bypass_rls: { required: false, type: () => Boolean },
              connection_limit: { required: false, type: () => Number },
              password: { required: false, type: () => String },
              valid_until: { required: false, type: () => String },
              member_of: { required: false, type: () => [String] },
              members: { required: false, type: () => [String] },
              admins: { required: false, type: () => [String] },
              config: { required: false, type: () => Object },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/role-id.dto.js'),
          {
            RoleIdParamDTO: {
              id: { required: true, type: () => Number, minimum: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/role-update.dto.js'),
          {
            RoleUpdateDTO: {
              name: { required: false, type: () => String },
              is_superuser: { required: false, type: () => Boolean },
              can_create_db: { required: false, type: () => Boolean },
              can_create_role: { required: false, type: () => Boolean },
              inherit_role: { required: false, type: () => Boolean },
              can_login: { required: false, type: () => Boolean },
              is_replication_role: { required: false, type: () => Boolean },
              can_bypass_rls: { required: false, type: () => Boolean },
              connection_limit: { required: false, type: () => Number },
              password: { required: false, type: () => String },
              valid_until: { required: false, type: () => String },
              config: { required: false },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/schema.dto.js'),
          {
            SchemaQueryDTO: {
              include_system_schemas: { required: false, type: () => Boolean },
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/schema-create.dto.js'),
          {
            SchemaCreateDTO: {
              name: { required: true, type: () => String },
              owner: { required: false, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/schema-delete.dto.js'),
          {
            SchemaDeleteQueryDTO: {
              cascade: { required: false, type: () => Boolean },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/schema-id.dto.js'),
          {
            SchemaIdParamDTO: {
              id: { required: true, type: () => Number, minimum: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/schema-update.dto.js'),
          {
            SchemaUpdateDTO: {
              name: { required: false, type: () => String },
              owner: { required: false, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/table-create.dto.js'),
          {
            TableCreateDTO: {
              name: { required: true, type: () => String },
              schema: { required: false, type: () => String },
              comment: { required: false, type: () => String },
              columns: { required: false, type: () => [Object] },
              primaryKeys: { required: false, type: () => [Object] },
              foreignKeys: { required: false, type: () => [Object] },
              isPartition: { required: false, type: () => Boolean },
              partitionOf: { required: false, type: () => String },
              partitioning: {
                required: false,
                type: () => ({
                  strategy: { required: true, type: () => String },
                  columns: { required: true, type: () => [Object] },
                }),
              },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/table-id.dto.js'),
          {
            TableIdParamDTO: {
              id: { required: true, type: () => Number, minimum: 1 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/table-privilege.dto.js'),
          {
            TablePrivilegeQueryDTO: {
              include_system_schemas: { required: false, type: () => Boolean },
              included_schemas: { required: false, type: () => String },
              excluded_schemas: { required: false, type: () => String },
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/table-privilege-grant.dto.js'),
          {
            TablePrivilegeGrantDTO: {
              relation_id: { required: true, type: () => Number },
              grantee: { required: true, type: () => String },
              privilege_type: { required: true, type: () => Object },
              is_grantable: { required: false, type: () => Boolean },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/table-privilege-revoke.dto.js'),
          {
            TablePrivilegeRevokeDTO: {
              relation_id: { required: true, type: () => Number },
              grantee: { required: true, type: () => String },
              privilege_type: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/table-update.dto.js'),
          {
            TableUpdateDTO: {
              name: { required: false, type: () => String },
              schema: { required: false, type: () => String },
              comment: { required: false, type: () => String },
              rls_enabled: { required: false, type: () => Boolean },
              rls_forced: { required: false, type: () => Boolean },
              replica_identity: { required: false, type: () => Object },
              replica_identity_index: { required: false, type: () => String },
              primary_keys: {
                required: false,
                type: () => [{ name: { required: true, type: () => String } }],
              },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/trigger.dto.js'),
          {
            TriggerQueryDTO: {
              include_system_schemas: { required: false, type: () => Boolean },
              included_schemas: { required: false, type: () => String },
              excluded_schemas: { required: false, type: () => String },
              limit: {
                required: false,
                type: () => Number,
                minimum: 1,
                maximum: 1000,
              },
              offset: { required: false, type: () => Number, minimum: 0 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/trigger-create.dto.js'),
          {
            TriggerCreateDTO: {
              name: { required: true, type: () => String },
              table: { required: true, type: () => String },
              function_name: { required: true, type: () => String },
              activation: { required: true, type: () => String },
              events: { required: true, type: () => [String], minItems: 1 },
              function_schema: { required: false, type: () => String },
              schema: { required: false, type: () => String },
              orientation: { required: false, type: () => String },
              condition: { required: false, type: () => String },
              function_args: { required: false, type: () => [String] },
              comment: { required: false, type: () => String },
              enabled_mode: { required: false, type: () => Object },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/trigger-delete.dto.js'),
          {
            TriggerDeleteQueryDTO: {
              cascade: { required: false, type: () => Boolean },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/trigger-update.dto.js'),
          {
            TriggerUpdateDTO: {
              name: { required: false, type: () => String },
              enabled_mode: { required: false, type: () => Object },
              table: { required: false, type: () => String },
              schema: { required: false, type: () => String },
              condition: { required: false, type: () => String },
              orientation: { required: false, type: () => Object },
              activation: { required: false, type: () => Object },
              events: { required: false, type: () => [String] },
              function_schema: { required: false, type: () => String },
              function_name: { required: false, type: () => String },
              function_args: { required: false, type: () => [String] },
              comment: { required: false, type: () => String },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/type.dto.js'),
          {
            TypeQueryDTO: {
              include_array_types: { required: false, type: () => Boolean },
              include_system_schemas: { required: false, type: () => Boolean },
              included_schemas: { required: false, type: () => String },
              excluded_schemas: { required: false, type: () => String },
              limit: {
                required: false,
                type: () => Number,
                minimum: 1,
                maximum: 1000,
              },
              offset: { required: false, type: () => Number, minimum: 0 },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/view.dto.js'),
          {
            ViewQueryDTO: {
              include_system_schemas: { required: false, type: () => Boolean },
              included_schemas: { required: false, type: () => String },
              excluded_schemas: { required: false, type: () => String },
              limit: { required: false, type: () => Number },
              offset: { required: false, type: () => Number },
              include_columns: { required: false, type: () => Boolean },
            },
          },
        ],
        [
          import('../../../libs/pg-meta/src/DTO/view-id.dto.js'),
          {
            ViewIdParamDTO: {
              id: { required: true, type: () => Number, minimum: 1 },
            },
          },
        ],
        [
          import('./account/DTO/account.dto.js'),
          {
            CreateAccountDTO: {
              userId: {
                required: true,
                type: () => String,
                description:
                  "User ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.')",
              },
              email: {
                required: true,
                type: () => String,
                description: 'User email.',
                format: 'email',
              },
              password: {
                required: true,
                type: () => String,
                description:
                  'New user password. Must be between 8 and 256 chars.',
                minLength: 8,
                maxLength: 256,
              },
              name: {
                required: false,
                type: () => String,
                description: 'User name. Max length: 128 chars.',
                minLength: 0,
                maxLength: 128,
              },
            },
            UpdatePrefsDTO: {},
            UpdateEmailDTO: {
              email: {
                required: true,
                type: () => String,
                description: 'User email.',
                format: 'email',
              },
              password: {
                required: true,
                type: () => String,
                description: 'User password. Must be at least 8 chars.',
                minLength: 8,
                maxLength: 256,
              },
            },
            UpdatePasswordDTO: {
              password: {
                required: true,
                type: () => String,
                description: 'New user password. Must be at least 8 chars.',
                minLength: 8,
                maxLength: 256,
              },
              oldPassword: {
                required: true,
                type: () => String,
                description: 'Current user password. Must be at least 8 chars.',
              },
            },
            UpdateNameDTO: {
              name: {
                required: true,
                type: () => String,
                description: 'User name. Max length: 128 chars.',
              },
            },
            UpdatePhoneDTO: {
              phone: {
                required: true,
                type: () => String,
                description:
                  "Phone number. Format this number with a leading \\'+\\' and a country code, e.g., +16175551212.",
              },
              password: {
                required: true,
                type: () => String,
                description: 'User password. Must be at least 8 chars.',
                minLength: 8,
                maxLength: 256,
              },
            },
          },
        ],
        [
          import('./account/DTO/session.dto.js'),
          {
            CreateEmailSessionDTO: {
              email: {
                required: true,
                type: () => String,
                description: 'User email.',
                format: 'email',
              },
              password: {
                required: true,
                type: () => String,
                description: 'User password. Must be at least 8 chars.',
                minLength: 8,
              },
            },
          },
        ],
        [
          import('./projects/DTO/create-project.dto.js'),
          {
            CreateProjectDTO: {
              projectId: {
                required: true,
                type: () => String,
                description:
                  "Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, and hyphen. Can\\'t start with a special char. Max length is 36 chars.'",
              },
              name: {
                required: true,
                type: () => String,
                description: 'Project name. Max length: 128 chars.',
              },
              teamId: {
                required: true,
                type: () => String,
                description: 'Team unique ID.',
              },
              password: {
                required: true,
                type: () => String,
                description: 'Database password.',
                minLength: 6,
              },
              region: {
                required: true,
                type: () => String,
                description: 'Project Region.',
              },
              description: {
                required: false,
                type: () => String,
                description: 'Project description. Max length: 256 chars.',
              },
              logo: {
                required: false,
                type: () => String,
                description: 'Project logo.',
              },
              url: {
                required: false,
                type: () => String,
                description: 'Project URL.',
              },
            },
            ProjectParamsDTO: {
              projectId: {
                required: true,
                type: () => String,
                description: 'Project ID.',
              },
            },
          },
        ],
        [
          import('./projects/auth-settings/DTO/project-auth.dto.js'),
          {
            AuthSessionAlertsDTO: {
              alerts: {
                required: true,
                type: () => Boolean,
                description: 'Set to true to enable session emails.',
              },
            },
            AuthLimitDTO: {
              limit: {
                required: true,
                type: () => Number,
                description:
                  'Set the max number of users allowed in this project. Use 0 for unlimited.',
                minimum: 0,
              },
            },
            AuthDurationDTO: {
              duration: {
                required: true,
                type: () => Number,
                description:
                  'Project session length in seconds. Max length: 31536000 seconds.',
                minimum: 0,
                maximum: 31536000,
              },
            },
            AuthMethodStatusDTO: {
              status: {
                required: true,
                type: () => Boolean,
                description: 'Set the status of this auth method.',
              },
            },
            AuthPasswordHistoryDTO: {
              limit: {
                required: true,
                type: () => Number,
                description:
                  "Set the max number of passwords to store in user history. User can\\'t choose a new password that is already stored in the password history list.",
                minimum: 0,
              },
            },
            AuthPasswordDictionaryDTO: {
              enabled: {
                required: true,
                type: () => Boolean,
                description:
                  "Set whether or not to enable checking user\\'s password against most commonly used passwords. Default is false.",
              },
            },
            AuthPersonalDataDTO: {
              enabled: {
                required: true,
                type: () => Boolean,
                description:
                  'Set whether or not to check a password for similarity with personal data. Default is false.',
              },
            },
            AuthMaxSessionsDTO: {
              limit: {
                required: true,
                type: () => Number,
                description:
                  'Set the max number of users allowed in this project.',
                minimum: 0,
              },
            },
            MockNumber: {
              phone: { required: true, type: () => String },
              otp: { required: true, type: () => String },
            },
            AuthMockNumbersDTO: {
              numbers: {
                required: true,
                type: () => [
                  t['./projects/auth-settings/DTO/project-auth.dto.js']
                    .MockNumber,
                ],
                description:
                  'An array of mock numbers and their corresponding verification codes (OTPs). Each number should be a valid E.164 formatted phone number. Maximum of 10 numbers are allowed.',
                maxItems: 10,
              },
            },
            AuthMembershipPrivacyDTO: {
              userName: {
                required: false,
                type: () => Boolean,
                description:
                  'Set to true to show userName to members of a team.',
              },
              userEmail: {
                required: false,
                type: () => Boolean,
                description: 'Set to true to show email to members of a team.',
              },
              mfa: {
                required: false,
                type: () => Boolean,
                description: 'Set to true to show mfa to members of a team.',
              },
            },
            AuthMethodParamsDTO: {
              method: {
                required: true,
                type: () => String,
                description: 'Auth Method.',
              },
            },
          },
        ],
        [
          import('./projects/keys/DTO/keys.dto.js'),
          {
            CreateKeyDTO: {
              name: {
                required: true,
                type: () => String,
                description: 'Key name. Max length: 128 chars.',
                minLength: 1,
                maxLength: 128,
              },
              scopes: {
                required: false,
                type: () => [String],
                description: 'Key scopes list.',
              },
              expire: {
                required: false,
                type: () => String,
                description:
                  "Expiration time in [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) format. If not set, the key won't expire.",
              },
            },
            UpdateKeyDTO: {},
            KeyParamsDTO: {
              keyId: {
                required: true,
                type: () => String,
                description: 'Key ID.',
              },
            },
          },
        ],
        [
          import('./projects/metadata/DTO/exposed-schemas.dto.js'),
          {
            UpdateExposedSchemasDTO: {
              schemas: { required: true, type: () => [String] },
            },
          },
        ],
        [
          import('./projects/platforms/DTO/platform.dto.js'),
          {
            CreatePlatformDTO: {
              name: {
                required: true,
                type: () => String,
                description: 'Platform name.',
                minLength: 1,
                maxLength: 128,
              },
              type: {
                required: true,
                type: () => String,
                description: 'Platform type.',
              },
              key: {
                required: false,
                type: () => String,
                description:
                  'Package name for Android or bundle ID for iOS or macOS.',
                minLength: 1,
                maxLength: 256,
              },
              store: {
                required: false,
                type: () => String,
                description: 'App store or Google Play store ID.',
                minLength: 1,
                maxLength: 256,
              },
              hostname: {
                required: false,
                type: () => String,
                description: 'Platform client hostname.',
                minLength: 1,
                maxLength: 256,
              },
            },
            UpdatePlatformDTO: {},
            PlatformParamsDTO: {
              platformId: {
                required: true,
                type: () => String,
                description: 'Platform ID.',
              },
            },
          },
        ],
        [
          import('./projects/DTO/create-jwt.dto.js'),
          {
            CreateJwtDTO: {
              scopes: {
                required: true,
                type: () => [String],
                description: 'Api Scopes.',
              },
              duration: {
                required: true,
                type: () => Number,
                description: 'Duration in seconds (max 1 hour).',
                minimum: 0,
                maximum: 3600,
              },
            },
          },
        ],
        [
          import('./projects/DTO/oauth2.dto.js'),
          {
            oAuth2DTO: {
              provider: {
                required: true,
                type: () => String,
                description: 'Provider Name',
              },
              appId: {
                required: false,
                type: () => String,
                description: 'Provider app ID. Max length: 256 chars.',
                maxLength: 256,
              },
              secret: {
                required: false,
                type: () => String,
                description: 'Provider secret key. Max length: 512 chars.',
                maxLength: 512,
              },
              enabled: {
                required: false,
                type: () => Boolean,
                description:
                  "Provider status. Set to \\'false\\' to disable new session creation.",
              },
            },
          },
        ],
        [
          import('./projects/DTO/project-api.dto.js'),
          {
            ProjectApiStatusDTO: {
              api: {
                required: true,
                type: () => String,
                description: 'API name.',
              },
              status: {
                required: true,
                type: () => Boolean,
                description: 'API status.',
              },
            },
            ProjectApiStatusAllDTO: {},
          },
        ],
        [
          import('./projects/DTO/project-service.dto.js'),
          {
            UpdateProjectServiceDTO: {
              service: {
                required: true,
                type: () => String,
                description: 'Service name.',
              },
              status: {
                required: true,
                type: () => Boolean,
                description: 'Service status.',
              },
            },
            UpdateProjectAllServiceDTO: {},
          },
        ],
        [
          import('./projects/DTO/smtp.dto.js'),
          {
            UpdateSmtpDTO: {
              enabled: {
                required: true,
                type: () => Boolean,
                description: 'Enable custom SMTP service',
              },
              senderName: {
                required: false,
                type: () => String,
                description: 'Name of the email sender',
                minLength: 0,
                maxLength: 255,
              },
              senderEmail: {
                required: false,
                type: () => String,
                description: 'Email of the sender',
                format: 'email',
              },
              replyTo: {
                required: false,
                type: () => String,
                description: 'Reply to email',
                format: 'email',
              },
              host: {
                required: false,
                type: () => String,
                description: 'SMTP server host name',
              },
              port: {
                required: false,
                type: () => Number,
                description: 'SMTP server port',
              },
              username: {
                required: false,
                type: () => String,
                description: 'SMTP server username',
              },
              password: {
                required: false,
                type: () => String,
                description: 'SMTP server password',
              },
              secure: {
                required: false,
                type: () => Object,
                description: "Does SMTP server use secure connection'",
              },
            },
            SmtpTestsDTO: {
              emails: {
                required: true,
                type: () => [String],
                description:
                  'Array of emails to send test email to. Maximum of 10 emails are allowed.',
                format: 'email',
                maxItems: 10,
              },
              senderName: {
                required: true,
                type: () => String,
                description: 'Name of the email sender',
                minLength: 0,
                maxLength: 255,
              },
              senderEmail: {
                required: true,
                type: () => String,
                description: 'Email of the sender',
                format: 'email',
              },
              replyTo: {
                required: false,
                type: () => String,
                description: 'Reply to email',
                format: 'email',
              },
              host: {
                required: true,
                type: () => String,
                description: 'SMTP server host name',
              },
              port: {
                required: false,
                type: () => Number,
                description: 'SMTP server port',
              },
              username: {
                required: false,
                type: () => String,
                description: 'SMTP server username',
              },
              password: {
                required: false,
                type: () => String,
                description: 'SMTP server password',
              },
              secure: {
                required: false,
                type: () => Object,
                description: 'Does SMTP server use secure connection',
              },
            },
          },
        ],
        [
          import('./projects/DTO/update-project.dto.js'),
          {
            UpdateProjectDTO: {},
            UpdateProjectTeamDTO: {
              teamId: {
                required: true,
                type: () => String,
                description: 'Team ID of the team to transfer project to.',
              },
            },
          },
        ],
        [
          import('./projects/templates/DTO/params.dto.js'),
          {
            TemplateParamsDTO: {
              type: {
                required: true,
                type: () => String,
                description: 'Template type',
              },
              locale: {
                required: true,
                type: () => Object,
                description: 'Template locale',
              },
            },
          },
        ],
        [
          import('./projects/webhooks/DTO/webhook.dto.js'),
          {
            CreateWebhookDTO: {
              name: {
                required: true,
                type: () => String,
                description: 'Webhook name. Max length: 128 chars.',
                maxLength: 128,
              },
              enabled: {
                required: true,
                type: () => Boolean,
                description: 'Enable or disable a webhook.',
              },
              events: {
                required: true,
                type: () => [String],
                description: 'Events list',
              },
              url: {
                required: true,
                type: () => String,
                description: 'Webhook URL.',
                format: 'uri',
              },
              security: {
                required: false,
                type: () => Boolean,
                description:
                  'Certificate verification, false for disabled or true for enabled.',
              },
              httpUser: {
                required: false,
                type: () => String,
                description: 'Webhook HTTP user. Max length: 256 chars.',
                maxLength: 256,
              },
              httpPass: {
                required: false,
                type: () => String,
                description: 'Webhook HTTP password. Max length: 256 chars.',
                maxLength: 256,
              },
            },
            UpdateWebhookDTO: {},
            WebhookParamsDTO: {
              webhookId: {
                required: true,
                type: () => String,
                description: 'Webhook unique ID.',
              },
            },
          },
        ],
      ],
      controllers: [
        [
          import('./app.controller.js'),
          { AppController: { main: {}, health: {} } },
        ],
        [
          import('../../../libs/pg-meta/src/pg-meta.controller.js'),
          {
            PgMetaController: {
              query: { type: Object },
              format: { type: Object },
              parse: { type: Object },
              deparse: { type: Object },
              getSchemas: {
                summary:
                  '************************* Schemas ********************************',
              },
              getSchemaById: { type: Object },
              createSchema: { type: Object },
              updateSchema: { type: Object },
              deleteSchema: { type: Object },
              getTables: {
                summary:
                  '************************* Tables ********************************',
                type: [Object],
              },
              getTableById: { type: Object },
              createTable: { type: Object },
              updateTable: { type: Object },
              deleteTable: { type: Object },
              getColumns: {
                summary:
                  '************************* Columns ********************************',
              },
              getColumnsByTable: { type: Object },
              createColumn: { type: Object },
              updateColumn: { type: Object },
              deleteColumn: { type: Object },
              getExtensions: {
                summary:
                  '************************* Extensions ********************************',
              },
              getExtensionByName: { type: Object },
              createExtension: { type: Object },
              updateExtension: { type: Object },
              deleteExtension: { type: Object },
              getRoles: {
                summary:
                  '************************* Roles ********************************',
              },
              getRoleById: { type: Object },
              createRole: { type: Object },
              updateRole: { type: Object },
              deleteRole: { type: Object },
              getFunctions: {
                summary:
                  '************************* Functions ********************************',
              },
              getFunctionById: { type: Object },
              createFunction: { type: Object },
              updateFunction: { type: Object },
              deleteFunction: { type: Object },
              getIndexes: {
                summary:
                  '************************* Indexes ********************************',
              },
              getIndexById: { type: Object },
              getViews: {
                summary:
                  '************************* Views ********************************',
                type: [Object],
              },
              getViewById: { type: Object },
              getForeignTables: {
                summary:
                  '************************* Foreign Tables ********************************',
                type: [Object],
              },
              getForeignTableById: { type: Object },
              getColumnPrivileges: {
                summary:
                  '************************* Column Privileges ********************************',
              },
              grantColumnPrivileges: { type: Object },
              revokeColumnPrivileges: { type: Object },
              getMaterializedViews: {
                summary:
                  '************************* Materialized Views ********************************',
                type: [Object],
              },
              getMaterializedViewById: { type: Object },
              getConfig: {
                summary:
                  '************************* Config ********************************',
              },
              getVersion: { type: Object },
              getPolicies: {
                summary:
                  '************************* Policies ********************************',
              },
              getPolicyById: { type: Object },
              createPolicy: { type: Object },
              updatePolicy: { type: Object },
              deletePolicy: { type: Object },
              getPublications: {
                summary:
                  '************************* Publications ********************************',
              },
              getPublicationById: { type: Object },
              createPublication: { type: Object },
              updatePublication: { type: Object },
              deletePublication: { type: Object },
              getTablePrivileges: {
                summary:
                  '************************* Table Privileges ********************************',
              },
              grantTablePrivileges: { type: Object },
              revokeTablePrivileges: { type: Object },
              getTriggers: {
                summary:
                  '************************* Triggers ********************************',
              },
              getTriggerById: { type: Object },
              createTrigger: { type: Object },
              updateTrigger: { type: Object },
              deleteTrigger: { type: Object },
              getTypes: {
                summary:
                  '************************* Types ********************************',
              },
              generateTypescript: {
                summary:
                  '************************* Generators ********************************',
                type: String,
              },
              generateGo: { type: String },
              generateSwift: { type: String },
            },
          },
        ],
        [
          import('./account/account.controller.js'),
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
              getPrefs: { type: Object },
              updatePrefs: { type: Object },
              updateName: { type: Object },
              updatePassword: { type: Object },
              updateEmail: {},
            },
          },
        ],
        [
          import('./projects/auth-settings/auth-settings.controller.js'),
          {
            AuthSettingsController: {
              updateSessionAlerts: { type: Object },
              updateAuthLimit: { type: Object },
              updateAuthDuration: { type: Object },
              updatePasswordHistory: { type: Object },
              updatePasswordDictionary: { type: Object },
              updatePersonalData: { type: Object },
              updateMaxSessions: { type: Object },
              updateMockNumbers: { type: Object },
              updateMembershipsPrivacy: { type: Object },
              updateAuthMethod: { type: Object },
            },
          },
        ],
        [
          import('./projects/keys/keys.controller.js'),
          {
            KeysController: {
              getKeys: {},
              createKey: { type: Object },
              getKey: { type: Object },
              updateKey: { type: Object },
              deleteKey: {},
            },
          },
        ],
        [
          import('./projects/metadata/metadata.controller.js'),
          { MetadataController: { updateExposedSchemas: { type: Object } } },
        ],
        [
          import('./projects/platforms/platforms.controller.js'),
          {
            PlatformsController: {
              getPlatforms: {},
              createPlatform: { type: Object },
              getPlatform: { type: Object },
              updatePlatform: { type: Object },
              deletePlatform: {},
            },
          },
        ],
        [
          import('./projects/project.controller.js'),
          { ProjectController: { getUsage: {}, getLogs: { type: [Object] } } },
        ],
        [
          import('./projects/projects.controller.js'),
          {
            ProjectsController: {
              findAll: {},
              findOne: { type: Object },
              update: { type: Object },
              createJwt: {},
              updateService: { type: Object },
              updateServiceAll: { type: Object },
              updateApi: { type: Object },
              updateApiAll: { type: Object },
              updateOAuth2: { type: Object },
              updateSMTP: { type: Object },
              testSMTP: {},
            },
          },
        ],
        [
          import('./projects/templates/templates.controller.js'),
          {
            TemplatesController: {
              getSMSTemplate: {},
              updateSmsTemplate: {},
              deleteSmsTemplate: {},
              getEmailTemplate: {},
              updateEmailTemplate: {},
              deleteEmailTemplate: {},
            },
          },
        ],
        [
          import('./projects/webhooks/webhooks.controller.js'),
          {
            WebhooksController: {
              getWebhooks: {},
              createWebhook: { type: Object },
              getWebhook: { type: Object },
              updateWebhook: { type: Object },
              updateWebhookSignature: { type: Object },
              deleteWebhook: {},
            },
          },
        ],
      ],
    },
  }
}
