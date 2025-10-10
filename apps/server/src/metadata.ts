/* eslint-disable */
export default async () => {
  const t = {
    ['../../../libs/core/src/models/Target.model.js']: await import(
      '../../../libs/core/src/models/Target.model.js'
    ),
    ['../../../libs/core/src/models/User.model.js']: await import(
      '../../../libs/core/src/models/User.model.js'
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
            BaseListModel: { total: { required: true, type: () => Number } },
          },
        ],
        [
          import('../../../libs/core/src/models/Target.model.js'),
          {
            TargetModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Target Name.',
                default: '',
              },
              userId: { required: true, type: () => String, default: '' },
              providerId: { required: true, type: () => String, default: '' },
              providerType: { required: true, type: () => String, default: '' },
              identifier: { required: true, type: () => String, default: '' },
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
                default: '',
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
                description: 'User phone number in E.164 format.',
                default: '',
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
            UsersListModel: {
              total: {
                required: true,
                type: () => Number,
                description: 'Total number of Users.',
                default: 0,
              },
              users: {
                required: true,
                type: () => [
                  t['../../../libs/core/src/models/User.model.js'].UserModel,
                ],
                description: 'List of users.',
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
                type: () => String,
                description: 'Algo type.',
                default: 'argon2',
              },
              memoryCost: {
                required: true,
                type: () => Number,
                description: 'Memory used to compute hash.',
                default: 65536,
              },
              timeCost: {
                required: true,
                type: () => Number,
                description: 'Amount of time consumed to compute hash.',
                default: 4,
              },
              threads: {
                required: true,
                type: () => Number,
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
                type: () => String,
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
                type: () => String,
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
                type: () => String,
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
                type: () => Boolean,
                description: 'Is attribute required?',
                default: false,
              },
              array: {
                required: true,
                type: () => Boolean,
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
          import('../../../libs/core/src/models/AuthProvider.model.js'),
          {
            AuthProviderModel: {
              key: {
                required: true,
                type: () => String,
                description: 'Auth Provider key.',
                default: '',
              },
              name: {
                required: true,
                type: () => String,
                description: 'Auth Provider name.',
                default: '',
              },
              appId: {
                required: true,
                type: () => String,
                description: 'OAuth 2.0 application ID.',
                default: '',
              },
              secret: {
                required: true,
                type: () => String,
                description:
                  'OAuth 2.0 application secret. Might be JSON string if provider requires extra configuration.',
                default: '',
              },
              enabled: {
                required: true,
                type: () => Boolean,
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
                type: () => Boolean,
                description: 'Whether file-level security is enabled.',
                default: false,
              },
              name: {
                required: true,
                type: () => String,
                description: 'Bucket name.',
                default: '',
              },
              enabled: {
                required: true,
                type: () => Boolean,
                description: 'Bucket enabled.',
                default: true,
              },
              maximumFileSize: {
                required: true,
                type: () => Number,
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
                type: () => String,
                description: 'Compression algorithm chosen for compression.',
                default: '',
              },
              encryption: {
                required: true,
                type: () => Boolean,
                description: 'Bucket is encrypted.',
                default: true,
              },
              antivirus: {
                required: true,
                type: () => Boolean,
                description: 'Virus scanning is enabled.',
                default: true,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Build.model.js'),
          {
            BuildModel: {
              deploymentId: {
                required: true,
                type: () => String,
                description: 'The deployment that created this build.',
                default: '',
              },
              status: {
                required: true,
                type: () => String,
                description:
                  'The build status.\n- Failed: The deployment build has failed. More details can usually be found in buildStderr.\n- Ready: The deployment build was successful and the deployment is ready to be deployed.\n- Processing: The deployment is currently waiting to have a build triggered.\n- Building: The deployment is currently being built.',
                default: '',
              },
              stdout: {
                required: true,
                type: () => String,
                description: 'The stdout of the build.',
                default: '',
              },
              stderr: {
                required: true,
                type: () => String,
                description: 'The stderr of the build.',
                default: '',
              },
              startTime: {
                required: true,
                type: () => String,
                description: 'The deployment creation date in ISO 8601 format.',
                default: '',
              },
              endTime: {
                required: true,
                type: () => String,
                description:
                  'The time the build was finished in ISO 8601 format.',
                default: '',
              },
              duration: {
                required: true,
                type: () => Number,
                description: 'The build duration in seconds.',
                default: 0,
              },
              size: {
                required: true,
                type: () => Number,
                description: 'The code size in bytes.',
                default: 0,
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
                type: () => String,
                description: 'Index Key.',
                default: '',
              },
              type: {
                required: true,
                type: () => String,
                description: 'Index type.',
                default: '',
              },
              status: {
                required: true,
                type: () => String,
                description:
                  'Index status. Possible values: `available`, `processing`, `deleting`, `stuck`, or `failed`.',
                default: '',
              },
              error: {
                required: true,
                type: () => String,
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
              min: {
                required: true,
                type: () => Number,
                nullable: true,
                default: null,
              },
              max: {
                required: true,
                type: () => Number,
                nullable: true,
                default: null,
              },
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
              min: {
                required: true,
                type: () => Number,
                nullable: true,
                default: null,
              },
              max: {
                required: true,
                type: () => Number,
                nullable: true,
                default: null,
              },
              default: {
                required: true,
                type: () => Number,
                nullable: true,
                default: null,
              },
            },
            AttributeListModel: {
              total: { required: true, type: () => Number, default: 0 },
              attributes: { required: true, type: () => [Object] },
            },
            AttributeRelationshipModel: {
              relatedCollection: {
                required: true,
                type: () => String,
                nullable: true,
                default: null,
              },
              relationType: {
                required: true,
                enum: t['@nuvix/db'].RelationType,
              },
              twoWay: { required: true, type: () => Boolean, default: false },
              twoWayKey: { required: false, type: () => String },
              onDelete: { required: true, enum: t['@nuvix/db'].OnDelete },
              side: { required: true, enum: t['@nuvix/db'].RelationSide },
            },
            AttributeStringModel: {
              type: { required: true, enum: t['@nuvix/db'].AttributeType },
              size: { required: true, type: () => Number, default: 0 },
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
          import('../../../libs/core/src/models/Collection.model.js'),
          {
            CollectionModel: {
              $schema: {
                required: true,
                type: () => String,
                description: 'Schema ID.',
                default: '',
              },
              name: {
                required: true,
                type: () => String,
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
                type: () => String,
                description: 'Continent name.',
                default: '',
              },
              code: {
                required: true,
                type: () => String,
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
                type: () => String,
                description: 'Country name.',
                default: '',
              },
              code: {
                required: true,
                type: () => String,
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
                type: () => String,
                description: 'Currency symbol.',
                default: '',
              },
              name: {
                required: true,
                type: () => String,
                description: 'Currency name.',
                default: '',
              },
              symbolNative: {
                required: true,
                type: () => String,
                description: 'Currency native symbol.',
                default: '',
              },
              decimalDigits: {
                required: true,
                type: () => Number,
                description: 'Number of decimal digits.',
                default: 0,
              },
              rounding: {
                required: true,
                type: () => Number,
                description: 'Currency digit rounding.',
                default: 0,
              },
              code: {
                required: true,
                type: () => String,
                description:
                  'Currency code in ISO 4217 three-character format.',
                default: '',
              },
              namePlural: {
                required: true,
                type: () => String,
                description: 'Currency plural name.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Database.model.js'),
          {
            DatabaseModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Database name.',
                default: '',
              },
              enabled: {
                required: true,
                type: () => Boolean,
                description:
                  "If database is enabled. Can be 'enabled' or 'disabled'.\nWhen disabled, the database is inaccessible to users,\nbut remains accessible to Server SDKs using API keys.",
                default: true,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Deployment.model.js'),
          {
            DeploymentModel: {
              type: {
                required: true,
                type: () => String,
                description: 'Type of deployment.',
                default: '',
              },
              resourceId: {
                required: true,
                type: () => String,
                description: 'Resource ID.',
                default: '',
              },
              resourceType: {
                required: true,
                type: () => String,
                description: 'Resource type.',
                default: '',
              },
              entrypoint: {
                required: true,
                type: () => String,
                description:
                  'The entrypoint file to use to execute the deployment code.',
                default: '',
              },
              size: {
                required: true,
                type: () => Number,
                description: 'The code size in bytes.',
                default: 0,
              },
              buildSize: {
                required: true,
                type: () => Number,
                description: 'The build output size in bytes.',
                default: 0,
              },
              buildId: {
                required: true,
                type: () => String,
                description: 'The current build ID.',
                default: '',
              },
              activate: {
                required: true,
                type: () => Boolean,
                description:
                  'Whether the deployment should be automatically activated.',
                default: false,
              },
              status: {
                required: true,
                type: () => String,
                description:
                  'The deployment status. Possible values are "processing", "building", "waiting", "ready", and "failed".',
                default: '',
              },
              buildLogs: {
                required: true,
                type: () => String,
                description: 'The build logs.',
                default: '',
              },
              buildTime: {
                required: true,
                type: () => Number,
                description: 'The current build time in seconds.',
                default: 0,
              },
              providerRepositoryName: {
                required: true,
                type: () => String,
                description: 'The name of the VCS provider repository.',
                default: '',
              },
              providerRepositoryOwner: {
                required: true,
                type: () => String,
                description: 'The name of the VCS provider repository owner.',
                default: '',
              },
              providerRepositoryUrl: {
                required: true,
                type: () => String,
                description: 'The URL of the VCS provider repository.',
                default: '',
              },
              providerBranch: {
                required: true,
                type: () => String,
                description: 'The branch name of the VCS provider repository.',
                default: '',
              },
              providerCommitHash: {
                required: true,
                type: () => String,
                description: 'The commit hash of the VCS commit.',
                default: '',
              },
              providerCommitAuthorUrl: {
                required: true,
                type: () => String,
                description: 'The URL of the VCS commit author.',
                default: '',
              },
              providerCommitAuthor: {
                required: true,
                type: () => String,
                description: 'The name of the VCS commit author.',
                default: '',
              },
              providerCommitMessage: {
                required: true,
                type: () => String,
                description: 'The commit message.',
                default: '',
              },
              providerCommitUrl: {
                required: true,
                type: () => String,
                description: 'The URL of the VCS commit.',
                default: '',
              },
              providerBranchUrl: {
                required: true,
                type: () => String,
                description: 'The branch of the VCS repository.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Detection.model.js'),
          {
            DetectionModel: {
              runtime: {
                required: true,
                type: () => String,
                description: 'Runtime.',
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
          import('../../../libs/core/src/models/Execution.model.js'),
          {
            ExecutionModel: {
              functionId: {
                required: true,
                type: () => String,
                description: 'Function ID.',
                default: '',
              },
              trigger: {
                required: true,
                type: () => String,
                description:
                  'The trigger that caused the function to execute.\nPossible values can be: `http`, `schedule`, or `event`.',
                default: '',
              },
              status: {
                required: true,
                type: () => String,
                description:
                  'The status of the function execution.\nPossible values can be: `waiting`, `processing`, `completed`, or `failed`.',
                default: '',
              },
              requestMethod: {
                required: true,
                type: () => String,
                description: 'HTTP request method type.',
                default: '',
              },
              requestPath: {
                required: true,
                type: () => String,
                description: 'HTTP request path and query.',
                default: '',
              },
              requestHeaders: {
                required: true,
                type: () => [Object],
                description:
                  'HTTP response headers as a key-value object.\nThis will return only whitelisted headers.\nAll headers are returned if execution is created as synchronous.',
              },
              responseStatusCode: {
                required: true,
                type: () => Number,
                description: 'HTTP response status code.',
                default: 0,
              },
              responseBody: {
                required: true,
                type: () => String,
                description:
                  'HTTP response body.\nThis will return empty unless execution is created as synchronous.',
                default: '',
              },
              responseHeaders: {
                required: true,
                type: () => [Object],
                description:
                  'HTTP response headers as a key-value object.\nThis will return only whitelisted headers.\nAll headers are returned if execution is created as synchronous.',
              },
              logs: {
                required: true,
                type: () => String,
                description:
                  'Function logs. Includes the last 4,000 characters.\nThis will return an empty string unless the response is returned using an API key or as part of a webhook payload.',
                default: '',
              },
              errors: {
                required: true,
                type: () => String,
                description:
                  'Function errors. Includes the last 4,000 characters.\nThis will return an empty string unless the response is returned using an API key or as part of a webhook payload.',
                default: '',
              },
              duration: {
                required: true,
                type: () => Number,
                description: 'Function execution duration in seconds.',
                default: 0,
              },
              scheduledAt: {
                required: true,
                type: () => String,
                description:
                  'The scheduled time for execution.\nIf left empty, execution will be queued immediately.',
                default: '',
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
                type: () => String,
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
                type: () => String,
                description: 'File name.',
                default: '',
              },
              signature: {
                required: true,
                type: () => String,
                description: 'File MD5 signature.',
                default: '',
              },
              mimeType: {
                required: true,
                type: () => String,
                description: 'File mime type.',
                default: '',
              },
              sizeOriginal: {
                required: true,
                type: () => Number,
                description: 'File original size in bytes.',
                default: 0,
              },
              chunksTotal: {
                required: true,
                type: () => Number,
                description: 'Total number of chunks available.',
                default: 0,
              },
              chunksUploaded: {
                required: true,
                type: () => Number,
                description: 'Total number of chunks uploaded.',
                default: 0,
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Func.model.js'),
          {
            FunctionModel: {
              execute: {
                required: true,
                type: () => [String],
                description: 'Execution permissions.',
              },
              name: {
                required: true,
                type: () => String,
                description: 'Function name.',
                default: '',
              },
              enabled: {
                required: true,
                type: () => Boolean,
                description: 'Function enabled.',
                default: true,
              },
              live: {
                required: true,
                type: () => Boolean,
                description:
                  'Is the function deployed with the latest configuration?',
                default: true,
              },
              logging: {
                required: true,
                type: () => Boolean,
                description: 'Whether executions will be logged.',
                default: true,
              },
              runtime: {
                required: true,
                type: () => String,
                description: 'Function execution runtime.',
                default: '',
              },
              deployment: {
                required: true,
                type: () => String,
                description: "Function's active deployment ID.",
                default: '',
              },
              scopes: {
                required: true,
                type: () => [String],
                description: 'Allowed permission scopes.',
              },
              vars: {
                required: true,
                type: () => [Object],
                description: 'Function variables.',
              },
              events: { required: true, type: () => [String] },
              schedule: {
                required: true,
                type: () => String,
                description: 'Function execution schedule in CRON format.',
                default: '',
              },
              timeout: {
                required: true,
                type: () => Number,
                description: 'Function execution timeout in seconds.',
                default: 15,
              },
              entrypoint: {
                required: true,
                type: () => String,
                description:
                  'The entrypoint file used to execute the deployment.',
                default: '',
              },
              commands: {
                required: true,
                type: () => String,
                description: 'The build command used to build the deployment.',
                default: '',
              },
              version: {
                required: true,
                type: () => String,
                description: 'Version of Open Runtimes used for the function.',
                default: 'v4',
              },
              installationId: {
                required: true,
                type: () => String,
                description:
                  'Function VCS (Version Control System) installation id.',
                default: '',
              },
              providerRepositoryId: {
                required: true,
                type: () => String,
                description: 'VCS (Version Control System) Repository ID.',
                default: '',
              },
              providerBranch: {
                required: true,
                type: () => String,
                description: 'VCS (Version Control System) branch name.',
                default: '',
              },
              providerRootDirectory: {
                required: true,
                type: () => String,
                description:
                  'Path to function in VCS (Version Control System) repository.',
                default: '',
              },
              providerSilentMode: {
                required: true,
                type: () => Boolean,
                description:
                  'Is VCS (Version Control System) connection in silent mode?',
                default: false,
              },
              specification: {
                required: true,
                type: () => String,
                description: 'Machine specification for builds and executions.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Headers.model.js'),
          {
            HeadersModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Header name.',
                default: '',
              },
              value: {
                required: true,
                type: () => String,
                description: 'Header value.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Identity.model.js'),
          {
            IdentityModel: {
              userId: {
                required: true,
                type: () => String,
                description: 'User ID.',
                default: '',
              },
              provider: {
                required: true,
                type: () => String,
                description: 'Identity Provider.',
                default: '',
              },
              providerUid: {
                required: true,
                type: () => String,
                description: 'ID of the User in the Identity Provider.',
                default: '',
              },
              providerEmail: {
                required: true,
                type: () => String,
                description: 'Email of the User in the Identity Provider.',
                default: '',
              },
              providerAccessToken: {
                required: true,
                type: () => String,
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
                type: () => String,
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Installation.model.js'),
          {
            InstallationModel: {
              provider: {
                required: true,
                type: () => String,
                description: 'VCS (Version Control System) provider name.',
                default: '',
              },
              organization: {
                required: true,
                type: () => String,
                description: 'VCS (Version Control System) organization name.',
                default: '',
              },
              providerInstallationId: {
                required: true,
                type: () => String,
                description: 'VCS (Version Control System) installation ID.',
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
                type: () => String,
                description: 'JWT encoded string.',
                default: '',
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
                type: () => String,
                description: 'Language name.',
                default: '',
              },
              code: {
                required: true,
                type: () => String,
                description: 'Language two-character ISO 639-1 codes.',
                default: '',
              },
              nativeName: {
                required: true,
                type: () => String,
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
                type: () => String,
                description: 'User IP address.',
                default: '',
              },
              countryCode: {
                required: true,
                type: () => String,
                description: 'Country code in ISO 3166-1 two-character format.',
                default: '',
              },
              country: {
                required: true,
                type: () => String,
                description: 'Country name. This field supports localization.',
                default: '',
              },
              continentCode: {
                required: true,
                type: () => String,
                description: 'Continent code. A two character continent code.',
                default: '',
              },
              continent: {
                required: true,
                type: () => String,
                description:
                  'Continent name. This field supports localization.',
                default: '',
              },
              eu: {
                required: true,
                type: () => Boolean,
                description: 'True if country is part of the European Union.',
                default: false,
              },
              currency: {
                required: true,
                type: () => String,
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
                type: () => String,
                description: 'Locale codes in ISO 639-1.',
                default: '',
              },
              name: {
                required: true,
                type: () => String,
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
                type: () => String,
                description: 'Event name.',
                default: '',
              },
              userId: {
                required: true,
                type: () => String,
                description: 'User ID.',
                default: '',
              },
              userEmail: {
                required: true,
                type: () => String,
                description: 'User Email.',
                default: '',
              },
              userName: {
                required: true,
                type: () => String,
                description: 'User Name.',
                default: '',
              },
              mode: {
                required: true,
                type: () => String,
                description: 'API mode when event triggered.',
                default: '',
              },
              ip: {
                required: true,
                type: () => String,
                description: 'IP session in use when the session was created.',
                default: '',
              },
              time: {
                required: true,
                type: () => String,
                description: 'Log creation date in ISO 8601 format.',
              },
              osCode: { required: true, type: () => String, default: '' },
              osName: {
                required: true,
                type: () => String,
                description: 'Operating system name.',
                default: '',
              },
              osVersion: {
                required: true,
                type: () => String,
                description: 'Operating system version.',
                default: '',
              },
              clientType: {
                required: true,
                type: () => String,
                description: 'Client type.',
                default: '',
              },
              clientCode: {
                required: true,
                type: () => String,
                description: 'Client code name.',
                default: '',
              },
              clientName: {
                required: true,
                type: () => String,
                description: 'Client name.',
                default: '',
              },
              clientVersion: {
                required: true,
                type: () => String,
                description: 'Client version.',
                default: '',
              },
              clientEngine: {
                required: true,
                type: () => String,
                description: 'Client engine name.',
                default: '',
              },
              clientEngineVersion: {
                required: true,
                type: () => String,
                description: 'Client engine version.',
                default: '',
              },
              deviceName: {
                required: true,
                type: () => String,
                description: 'Device name.',
                default: '',
              },
              deviceBrand: {
                required: true,
                type: () => String,
                description: 'Device brand name.',
                default: '',
              },
              deviceModel: {
                required: true,
                type: () => String,
                description: 'Device model name.',
                default: '',
              },
              countryCode: {
                required: true,
                type: () => String,
                description: 'Country two-character ISO 3166-1 alpha code.',
                default: '',
              },
              countryName: {
                required: true,
                type: () => String,
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
                type: () => String,
                description: 'User ID.',
                default: '',
              },
              userName: {
                required: true,
                type: () => String,
                description: 'User name.',
                default: '',
              },
              userEmail: {
                required: true,
                type: () => String,
                description: 'User email address.',
                default: '',
              },
              teamId: {
                required: true,
                type: () => String,
                description: 'Team ID.',
                default: '',
              },
              teamName: {
                required: true,
                type: () => String,
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
              confirm: { required: true, type: () => Boolean, default: false },
              mfa: {
                required: true,
                type: () => Boolean,
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
                type: () => String,
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
                type: () => Number,
                default: 0,
              },
              data: {
                required: true,
                type: () => Object,
                description: 'Data of the message.',
              },
              status: { required: true, type: () => String, default: 'draft' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Metric.model.js'),
          {
            MetricModel: {
              value: {
                required: true,
                type: () => Number,
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
                type: () => String,
                description: 'Resource ID.',
                default: '',
              },
              name: {
                required: true,
                type: () => String,
                description: 'Resource name.',
                default: '',
              },
              value: {
                required: true,
                type: () => Number,
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
                type: () => String,
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
                type: () => Boolean,
                description:
                  'Can TOTP be used for MFA challenge for this account.',
                default: false,
              },
              phone: {
                required: true,
                type: () => Boolean,
                description:
                  'Can phone (SMS) be used for MFA challenge for this account.',
                default: false,
              },
              email: {
                required: true,
                type: () => Boolean,
                description:
                  'Can email be used for MFA challenge for this account.',
                default: false,
              },
              recoveryCode: {
                required: true,
                type: () => Boolean,
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
                type: () => String,
                description: 'Secret token used for TOTP factor.',
                default: '',
              },
              uri: {
                required: true,
                type: () => String,
                description: 'URI for authenticator apps.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Migration.model.js'),
          {
            MigrationModel: {
              status: {
                required: true,
                type: () => String,
                description:
                  'Migration status (pending, processing, failed, completed).',
                default: '',
              },
              stage: {
                required: true,
                type: () => String,
                description:
                  'Migration stage (init, processing, source-check, destination-check, migrating, finished).',
                default: '',
              },
              source: {
                required: true,
                type: () => String,
                description:
                  'A string containing the type of source of the migration.',
                default: '',
              },
              resources: {
                required: true,
                type: () => [String],
                description: 'Resources to migrate.',
              },
              statusCounters: { required: true, type: () => Object },
              resourceData: { required: true, type: () => [Object] },
              errors: { required: true, type: () => [String] },
            },
          },
        ],
        [
          import(
            '../../../libs/core/src/models/MigrationFirebaseProject.model.js'
          ),
          {
            MigrationFirebaseProjectModel: {
              projectId: {
                required: true,
                type: () => String,
                description: 'Project ID.',
                default: '',
              },
              displayName: {
                required: true,
                type: () => String,
                description: 'Project display name.',
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/MigrationReport.model.js'),
          {
            MigrationReportModel: {
              users: {
                required: true,
                type: () => Number,
                description: 'Number of users to be migrated.',
                default: 0,
              },
              teams: { required: true, type: () => Number, default: 0 },
              databases: { required: true, type: () => Number, default: 0 },
              documents: { required: true, type: () => Number, default: 0 },
              files: { required: true, type: () => Number, default: 0 },
              buckets: { required: true, type: () => Number, default: 0 },
              functions: { required: true, type: () => Number, default: 0 },
              size: { required: true, type: () => Number, default: 0 },
              version: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/MockNumber.model.js'),
          {
            MockNumberModel: {
              phone: {
                required: true,
                type: () => String,
                description:
                  'Mock phone number for testing phone authentication. Useful for testing phone authentication without sending an SMS.',
                default: '',
              },
              otp: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Phone.model.js'),
          {
            PhoneModel: {
              code: {
                required: true,
                type: () => String,
                description: 'Phone code.',
                default: '',
              },
              countryCode: { required: true, type: () => String, default: '' },
              countryName: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Platform.model.js'),
          {
            PlatformModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Platform name.',
                default: '',
              },
              type: { required: true, type: () => String, default: '' },
              key: { required: true, type: () => String, default: '' },
              store: { required: true, type: () => String, default: '' },
              hostname: { required: true, type: () => String, default: '' },
              httpUser: { required: true, type: () => String, default: '' },
              httpPass: { required: true, type: () => String, default: '' },
              public: { required: true, type: () => Boolean, default: false },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Provider.model.js'),
          {
            ProviderModel: {
              name: {
                required: true,
                type: () => String,
                description: 'The name for the provider instance.',
                default: '',
              },
              provider: { required: true, type: () => String, default: '' },
              enabled: { required: true, type: () => Boolean, default: true },
              type: { required: true, type: () => String, default: '' },
              credentials: { required: true, type: () => Object },
              options: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Rule.model.js'),
          {
            RuleModel: {
              domain: {
                required: true,
                type: () => String,
                description: 'Domain name.',
                default: '',
              },
              resourceType: { required: true, type: () => String, default: '' },
              resourceId: { required: true, type: () => String, default: '' },
              status: { required: true, type: () => String, default: '' },
              logs: { required: true, type: () => String, default: '' },
              renewAt: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Runtime.model.js'),
          {
            RuntimeModel: {
              key: {
                required: true,
                type: () => String,
                description: 'Parent runtime key.',
                default: '',
              },
              name: { required: true, type: () => String, default: '' },
              version: { required: true, type: () => String, default: '' },
              base: { required: true, type: () => String, default: '' },
              image: { required: true, type: () => String, default: '' },
              logo: { required: true, type: () => String, default: '' },
              supports: { required: true, type: () => [String] },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Session.model.js'),
          {
            SessionModel: {
              userId: {
                required: true,
                type: () => String,
                description: 'User ID.',
                default: '',
              },
              expire: { required: true, type: () => String, default: '' },
              provider: { required: true, type: () => String, default: '' },
              providerUid: { required: true, type: () => String, default: '' },
              providerAccessToken: {
                required: true,
                type: () => String,
                default: '',
              },
              providerAccessTokenExpiry: {
                required: true,
                type: () => String,
                default: '',
              },
              providerRefreshToken: {
                required: true,
                type: () => String,
                default: '',
              },
              ip: { required: true, type: () => String, default: '' },
              osCode: { required: true, type: () => String, default: '' },
              osName: { required: true, type: () => String, default: '' },
              osVersion: { required: true, type: () => String, default: '' },
              clientType: { required: true, type: () => String, default: '' },
              clientCode: { required: true, type: () => String, default: '' },
              clientName: { required: true, type: () => String, default: '' },
              clientVersion: {
                required: true,
                type: () => String,
                default: '',
              },
              clientEngine: { required: true, type: () => String, default: '' },
              clientEngineVersion: {
                required: true,
                type: () => String,
                default: '',
              },
              deviceName: { required: true, type: () => String, default: '' },
              deviceBrand: { required: true, type: () => String, default: '' },
              deviceModel: { required: true, type: () => String, default: '' },
              countryCode: { required: true, type: () => String, default: '' },
              countryName: { required: true, type: () => String, default: '' },
              current: { required: true, type: () => Boolean, default: false },
              factors: { required: true, type: () => [String] },
              secret: { required: true, type: () => String, default: '' },
              mfaUpdatedAt: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Specification.model.js'),
          {
            SpecificationModel: {
              memory: {
                required: true,
                type: () => Number,
                description: 'Memory size in MB.',
                default: 0,
              },
              cpus: { required: true, type: () => Number, default: 0 },
              enabled: { required: true, type: () => Boolean, default: false },
              slug: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Subscriber.model.js'),
          {
            SubscriberModel: {
              targetId: {
                required: true,
                type: () => String,
                description: 'Target ID.',
                default: '',
              },
              target: { required: true, type: () => Object },
              userId: { required: true, type: () => String, default: '' },
              userName: { required: true, type: () => String, default: '' },
              topicId: { required: true, type: () => String, default: '' },
              providerType: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Team.model.js'),
          {
            TeamModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Team name.',
                default: '',
              },
              total: { required: true, type: () => Number, default: 0 },
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
                type: () => String,
                description: 'Template type.',
                default: '',
              },
              locale: { required: true, type: () => String, default: '' },
              message: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/TemplateEmail.model.js'),
          {
            TemplateEmailModel: {
              senderName: {
                required: true,
                type: () => String,
                description: 'Name of the sender.',
                default: '',
              },
              senderEmail: { required: true, type: () => String, default: '' },
              replyTo: { required: true, type: () => String, default: '' },
              subject: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/TemplateFunction.model.js'),
          {
            TemplateFunctionModel: {
              icon: {
                required: true,
                type: () => String,
                description: 'Function Template Icon.',
                default: '',
              },
              name: { required: true, type: () => String, default: '' },
              tagline: { required: true, type: () => String, default: '' },
              permissions: { required: true, type: () => [String] },
              events: { required: true, type: () => [String] },
              cron: { required: true, type: () => String, default: '' },
              timeout: { required: true, type: () => Number, default: 15 },
              useCases: { required: true, type: () => [String] },
              runtimes: { required: true, type: () => [Object] },
              instructions: { required: true, type: () => String, default: '' },
              vcsProvider: { required: true, type: () => String, default: '' },
              providerRepositoryId: {
                required: true,
                type: () => String,
                default: '',
              },
              providerOwner: {
                required: true,
                type: () => String,
                default: '',
              },
              providerVersion: {
                required: true,
                type: () => String,
                default: '',
              },
              variables: { required: true, type: () => [Object] },
              scopes: { required: true, type: () => [String] },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/TemplateRuntime.model.js'),
          {
            TemplateRuntimeModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Runtime Name.',
                default: '',
              },
              commands: { required: true, type: () => String, default: '' },
              entrypoint: { required: true, type: () => String, default: '' },
              providerRootDirectory: {
                required: true,
                type: () => String,
                default: '',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/TemplateSMS.model.js'),
          { TemplateSMSModel: {} },
        ],
        [
          import('../../../libs/core/src/models/Token.model.js'),
          {
            TokenModel: {
              userId: {
                required: true,
                type: () => String,
                description: 'User ID.',
                default: '',
              },
              secret: { required: true, type: () => String, default: '' },
              expire: { required: true, type: () => String, default: '' },
              phrase: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Topic.model.js'),
          {
            TopicModel: {
              name: {
                required: true,
                type: () => String,
                description: 'The name of the topic.',
                default: '',
              },
              emailTotal: { required: true, type: () => Number, default: 0 },
              smsTotal: { required: true, type: () => Number, default: 0 },
              pushTotal: { required: true, type: () => Number, default: 0 },
              subscribe: { required: true, type: () => [String] },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Variable.model.js'),
          {
            VariableModel: {
              key: {
                required: true,
                type: () => String,
                description: 'Variable key.',
                default: '',
              },
              value: { required: true, type: () => String, default: '' },
              resourceType: { required: true, type: () => String, default: '' },
              resourceId: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/VcsContent.model.js'),
          {
            VcsContentModel: {
              size: {
                required: true,
                type: () => Number,
                description:
                  'Content size in bytes. Only files have size, and for directories, 0 is returned.',
                default: 0,
              },
              isDirectory: {
                required: true,
                type: () => Boolean,
                default: false,
              },
              name: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Webhook.model.js'),
          {
            WebhookModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Webhook name.',
                default: '',
              },
              url: { required: true, type: () => String, default: '' },
              events: { required: true, type: () => [String] },
              security: { required: true, type: () => Boolean, default: true },
              httpUser: { required: true, type: () => String, default: '' },
              httpPass: { required: true, type: () => String, default: '' },
              signatureKey: { required: true, type: () => String, default: '' },
              enabled: { required: true, type: () => Boolean, default: true },
              logs: { required: true, type: () => String, default: '' },
              attempts: { required: true, type: () => Number, default: 0 },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/OtherAlgos.model.js'),
          {
            AlgoPhpassModel: {
              type: { required: true, type: () => String, default: 'phpass' },
            },
            AlgoShaModel: {
              type: { required: true, type: () => String, default: 'sha' },
            },
            AlgoScryptModel: {
              type: { required: true, type: () => String, default: 'scrypt' },
              costCpu: { required: true, type: () => Number, default: 8 },
              costMemory: { required: true, type: () => Number, default: 14 },
              costParallel: { required: true, type: () => Number, default: 1 },
              length: { required: true, type: () => Number, default: 64 },
            },
            AlgoScryptModifiedModel: {
              type: {
                required: true,
                type: () => String,
                default: 'scryptMod',
              },
              salt: { required: true, type: () => String, default: '' },
              saltSeparator: {
                required: true,
                type: () => String,
                default: '',
              },
              signerKey: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Health.model.js'),
          {
            HealthAntivirusModel: {
              version: { required: true, type: () => String, default: '' },
              status: { required: true, type: () => String, default: '' },
            },
            HealthCertificateModel: {
              name: { required: true, type: () => String, default: '' },
              subjectSN: {
                required: true,
                type: () => String,
                default: 'www.google.com',
              },
              issuerOrganisation: {
                required: true,
                type: () => String,
                default: 'Google Trust Services LLC',
              },
              validFrom: { required: true, type: () => String, default: '' },
              validTo: { required: true, type: () => String, default: '' },
              signatureTypeSN: {
                required: true,
                type: () => String,
                default: '',
              },
            },
            HealthQueueModel: {
              size: { required: true, type: () => Number, default: 0 },
            },
            HealthStatusModel: {
              name: { required: true, type: () => String, default: '' },
              ping: { required: true, type: () => Number, default: 0 },
              status: { required: true, type: () => String, default: '' },
            },
            HealthTimeModel: {
              remoteTime: { required: true, type: () => Number, default: 0 },
              localTime: { required: true, type: () => Number, default: 0 },
              diff: { required: true, type: () => Number, default: 0 },
            },
            HealthVersionModel: {
              version: { required: true, type: () => String, default: '' },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Usage.model.js'),
          {
            UsageBucketsModel: {
              range: { required: true, type: () => String, default: '' },
              filesTotal: { required: true, type: () => Number, default: 0 },
              filesStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              files: { required: true, type: () => [Object] },
              storage: { required: true, type: () => [Object] },
            },
            UsageCollectionModel: {
              range: { required: true, type: () => String, default: '' },
              documentsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              documents: { required: true, type: () => [Object] },
            },
            UsageDatabaseModel: {
              range: { required: true, type: () => String, default: '' },
              collectionsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              documentsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              collections: { required: true, type: () => [Object] },
              documents: { required: true, type: () => [Object] },
            },
            UsageDatabasesModel: {
              range: { required: true, type: () => String, default: '' },
              databasesTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              collectionsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              documentsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              databases: { required: true, type: () => [Object] },
              collections: { required: true, type: () => [Object] },
              documents: { required: true, type: () => [Object] },
            },
            UsageFunctionModel: {
              range: { required: true, type: () => String, default: '' },
              deploymentsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              deploymentsStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              buildsTotal: { required: true, type: () => Number, default: 0 },
              buildsStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              buildsTimeTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              buildsMbSecondsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              executionsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              executionsTimeTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              executionsMbSecondsTotal: {
                required: true,
                type: () => Number,
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
              range: { required: true, type: () => String, default: '' },
              functionsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              deploymentsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              deploymentsStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              buildsTotal: { required: true, type: () => Number, default: 0 },
              buildsStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              buildsTimeTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              buildsMbSecondsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              executionsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              executionsTimeTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              executionsMbSecondsTotal: {
                required: true,
                type: () => Number,
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
                type: () => Number,
                default: 0,
              },
              documentsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              databasesTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              usersTotal: { required: true, type: () => Number, default: 0 },
              filesStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              functionsStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              buildsStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              deploymentsStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              bucketsTotal: { required: true, type: () => Number, default: 0 },
              executionsMbSecondsTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              buildsMbSecondsTotal: {
                required: true,
                type: () => Number,
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
              range: { required: true, type: () => String, default: '' },
              bucketsTotal: { required: true, type: () => Number, default: 0 },
              filesTotal: { required: true, type: () => Number, default: 0 },
              filesStorageTotal: {
                required: true,
                type: () => Number,
                default: 0,
              },
              buckets: { required: true, type: () => [Object] },
              files: { required: true, type: () => [Object] },
              storage: { required: true, type: () => [Object] },
            },
            UsageUsersModel: {
              range: { required: true, type: () => String, default: '' },
              usersTotal: { required: true, type: () => Number, default: 0 },
              sessionsTotal: { required: true, type: () => Number, default: 0 },
              users: { required: true, type: () => [Object] },
              sessions: { required: true, type: () => [Object] },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Organization.model.js'),
          {
            OrganizationModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Team name.',
              },
              total: {
                required: true,
                type: () => Number,
                description: 'Total number of team members.',
              },
              prefs: {
                required: true,
                type: () => Object,
                description: 'Team preferences as a key-value object',
              },
              billingBudget: {
                required: true,
                type: () => Number,
                description: 'Project budget limit',
              },
              budgetAlerts: {
                required: true,
                type: () => [String],
                description: 'Project budget limit',
              },
              billingPlan: {
                required: true,
                type: () => String,
                description:
                  'Billing plan selected. Can be one of `tier-0`, `tier-1` or `tier-2`.',
              },
              billingEmail: {
                required: true,
                type: () => String,
                description: 'Billing email set for the organization.',
              },
              billingStartDate: {
                required: true,
                type: () => String,
                description: 'Billing cycle start date.',
              },
              billingCurrentInvoiceDate: {
                required: true,
                type: () => String,
                description: 'Current invoice cycle start date.',
              },
              billingNextInvoiceDate: {
                required: true,
                type: () => String,
                description: 'Next invoice cycle start date.',
              },
              billingTrialStartDate: {
                required: true,
                type: () => String,
                description: 'Start date of trial.',
              },
              billingTrialDays: {
                required: true,
                type: () => Number,
                description: 'Number of trial days.',
              },
              billingAggregationId: {
                required: true,
                type: () => String,
                description: 'Current active aggregation id.',
              },
              paymentMethodId: {
                required: true,
                type: () => String,
                description: 'Default payment method.',
              },
              billingAddressId: {
                required: true,
                type: () => String,
                description: 'Default payment method.',
              },
              backupPaymentMethodId: {
                required: true,
                type: () => String,
                description: 'Backup payment method.',
              },
              agreementBAA: {
                required: true,
                type: () => String,
                description: 'Organization agreements',
              },
              programManagerName: {
                required: true,
                type: () => String,
                description: 'Program manager&#039;s name.',
              },
              programManagerCalendar: {
                required: true,
                type: () => String,
                description: 'Program manager&#039;s calendar link.',
              },
              programDiscordChannelName: {
                required: true,
                type: () => String,
                description: 'Program&#039;s discord channel name.',
              },
              programDiscordChannelUrl: {
                required: true,
                type: () => String,
                description: 'Program&#039;s discord channel URL.',
              },
              billingLimits: {
                required: true,
                type: () => Object,
                description: 'Billing limits reached',
              },
              billingPlanDowngrade: {
                required: true,
                type: () => Object,
                description: 'Billing plan downgrade',
              },
              billingTaxId: {
                required: true,
                type: () => String,
                description: 'Tax Id',
              },
              markedForDeletion: {
                required: true,
                type: () => Boolean,
                description: 'Marked for deletion',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/BillingAddress.model.js'),
          {
            BillingAddressModel: {
              $id: {
                required: true,
                type: () => String,
                description: 'Region ID',
              },
              streetAddress: {
                required: true,
                type: () => String,
                description: 'Street address',
              },
              addressLine2: {
                required: true,
                type: () => String,
                description: 'Address line 2',
              },
              country: {
                required: true,
                type: () => String,
                description: 'Address country',
              },
              city: { required: true, type: () => String, description: 'city' },
              state: {
                required: true,
                type: () => String,
                description: 'state',
              },
              postalCode: {
                required: true,
                type: () => String,
                description: 'postal code',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Invoice.model.js'),
          {
            InvoiceModel: {
              teamId: {
                required: true,
                type: () => String,
                description: 'Project ID',
              },
              aggregationId: {
                required: true,
                type: () => String,
                description: 'Aggregation ID',
              },
              plan: {
                required: true,
                type: () => String,
                description:
                  'Billing plan selected. Can be one of `tier-0`, `tier-1` or `tier-2`.',
              },
              usage: {
                required: true,
                type: () => Object,
                description: 'Usage breakdown per resource',
              },
              amount: {
                required: true,
                type: () => Number,
                description: 'Invoice Amount',
              },
              tax: {
                required: true,
                type: () => Number,
                description: 'Tax percentage',
              },
              taxAmount: {
                required: true,
                type: () => Number,
                description: 'Tax amount',
              },
              vat: {
                required: true,
                type: () => Number,
                description: 'VAT percentage',
              },
              vatAmount: {
                required: true,
                type: () => Number,
                description: 'VAT amount',
              },
              grossAmount: {
                required: true,
                type: () => Number,
                description:
                  'Gross amount after vat, tax, and discounts applied.',
              },
              creditsUsed: {
                required: true,
                type: () => Number,
                description: 'Credits used.',
              },
              currency: {
                required: true,
                type: () => String,
                description: 'Currency the invoice is in',
              },
              clientSecret: {
                required: true,
                type: () => String,
                description:
                  'Client secret for processing failed payments in front-end',
              },
              status: {
                required: true,
                type: () => String,
                description: 'Invoice status',
              },
              lastError: {
                required: true,
                type: () => String,
                description: 'Last payment error associated with the invoice',
              },
              dueAt: {
                required: true,
                type: () => String,
                description: 'Invoice due date.',
              },
              from: {
                required: true,
                type: () => String,
                description: 'Beginning date of the invoice',
              },
              to: {
                required: true,
                type: () => String,
                description: 'End date of the invoice',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/PaymentMethod.model.js'),
          {
            PaymentMethodModel: {
              providerMethodId: {
                required: true,
                type: () => String,
                description: 'Payment method ID from the payment provider',
              },
              clientSecret: {
                required: true,
                type: () => String,
                description: 'Client secret hash for payment setup',
              },
              providerUserId: {
                required: true,
                type: () => String,
                description: 'User ID from the payment provider.',
              },
              userId: {
                required: true,
                type: () => String,
                description: 'ID of the Team.',
              },
              expiryMonth: {
                required: true,
                type: () => Number,
                description: 'Expiry month of the payment method.',
              },
              expiryYear: {
                required: true,
                type: () => Number,
                description: 'Expiry year of the payment method.',
              },
              last4: {
                required: true,
                type: () => String,
                description: 'Last 4 digit of the payment method',
              },
              brand: {
                required: true,
                type: () => String,
                description: 'Payment method brand',
              },
              name: {
                required: true,
                type: () => String,
                description: 'Name of the owner',
              },
              mandateId: {
                required: true,
                type: () => String,
                description: 'Mandate ID of the payment method',
              },
              country: {
                required: true,
                type: () => String,
                description: 'Country of the payment method',
              },
              lastError: {
                required: true,
                type: () => String,
                description:
                  'Last payment error associated with the payment method.',
              },
              default: {
                required: true,
                type: () => Boolean,
                description: 'True when it&#039;s the default payment method.',
              },
              expired: {
                required: true,
                type: () => Boolean,
                description: 'True when payment method has expired.',
              },
              failed: {
                required: true,
                type: () => Boolean,
                description:
                  'True when payment method has failed to process multiple times.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/Plan.model.js'),
          {
            BillingPlanModel: {
              name: {
                required: true,
                type: () => String,
                description: 'Plan name',
              },
              price: {
                required: true,
                type: () => Number,
                description: 'Price',
              },
              trial: {
                required: true,
                type: () => Number,
                description: 'Trial days',
              },
              bandwidth: {
                required: true,
                type: () => Number,
                description: 'Bandwidth',
              },
              storage: {
                required: true,
                type: () => Number,
                description: 'Storage',
              },
              members: {
                required: true,
                type: () => Number,
                description: 'Members',
              },
              webhooks: {
                required: true,
                type: () => Number,
                description: 'Webhooks',
              },
              platforms: {
                required: true,
                type: () => Number,
                description: 'Platofrms',
              },
              users: {
                required: true,
                type: () => Number,
                description: 'Users',
              },
              teams: {
                required: true,
                type: () => Number,
                description: 'Teams',
              },
              databases: {
                required: true,
                type: () => Number,
                description: 'Databases',
              },
              buckets: {
                required: true,
                type: () => Number,
                description: 'Buckets',
              },
              fileSize: {
                required: true,
                type: () => Number,
                description: 'File size',
              },
              functions: {
                required: true,
                type: () => Number,
                description: 'Functions',
              },
              executions: {
                required: true,
                type: () => Number,
                description: 'Function executions',
              },
              realtime: {
                required: true,
                type: () => Number,
                description: 'Realtime connections',
              },
              logs: {
                required: true,
                type: () => Number,
                description: 'Log days',
              },
              addons: {
                required: true,
                type: () => Object,
                description: 'Additional resources',
              },
              customSmtp: {
                required: true,
                type: () => Boolean,
                description: 'Custom SMTP',
              },
              emailBranding: {
                required: true,
                type: () => Boolean,
                description: 'nuvix branding in email',
              },
              requiresPaymentMethod: {
                required: true,
                type: () => Boolean,
                description: 'Does plan require payment method',
              },
              requiresBillingAddress: {
                required: true,
                type: () => Boolean,
                description: 'Does plan require billing address',
              },
              isAvailable: {
                required: true,
                type: () => Boolean,
                description: 'Is the billing plan available',
              },
              selfService: {
                required: true,
                type: () => Boolean,
                description: 'Can user change the plan themselves',
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
          import('../../../libs/core/src/models/Project.model.js'),
          {
            ProjectModel: {
              auths: { required: true, type: () => Object },
              services: { required: true, type: () => Object },
              smtp: { required: true, type: () => Object },
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
          import('../../../libs/core/src/models/Object.model.js'),
          {
            ObjectModel: {
              bucketId: {
                required: true,
                type: () => String,
                description: 'Bucket ID.',
                default: '',
              },
              permissions: {
                required: true,
                type: () => [String],
                description: 'Object permissions.',
              },
              name: {
                required: true,
                type: () => String,
                description: 'Object name.',
                default: '',
              },
              version: {
                required: true,
                type: () => String,
                description: 'Object version.',
                default: '',
              },
              metadata: {
                required: true,
                type: () => Object,
                description: 'Object metadata.',
              },
              tokens: {
                required: true,
                type: () => [String],
                description: 'Object path_tokens.',
              },
            },
          },
        ],
        [
          import('../../../libs/core/src/models/EnvToken.model.js'),
          {
            EnvToken: {
              projectId: { required: false, type: () => String },
              name: { required: true, type: () => String },
              token: { required: true, type: () => String },
              metadata: { required: false, type: () => Object },
            },
          },
        ],
        [
          import('./database/DTO/create-schema.dto.js'),
          {
            CreateSchema: {
              name: {
                required: true,
                type: () => String,
                pattern: '/^[a-z][a-z0-9_]{0,254}$/',
              },
              description: { required: false, type: () => String },
              type: {
                required: true,
                enum: t['../../../libs/utils/src/constants.js'].SchemaType,
              },
            },
            SchemaQueryDTO: {
              type: {
                required: false,
                enum: t['../../../libs/utils/src/constants.js'].SchemaType,
              },
            },
            SchemaParamsDTO: {
              schemaId: {
                required: true,
                type: () => String,
                description: 'Schema ID.',
              },
            },
          },
        ],
        [
          import('./users/DTO/user.dto.js'),
          {
            CreateUserDTO: {
              userId: {
                required: false,
                type: () => String,
                description:
                  "User ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.",
              },
              email: {
                required: false,
                type: () => String,
                description: 'User email.',
                format: 'email',
              },
              phone: {
                required: false,
                type: () => String,
                description:
                  "Phone number. Format this number with a leading \\'+\\' and a country code, e.g., +16175551212.",
              },
              password: {
                required: false,
                type: () => String,
                description:
                  'Plain text user password. Must be at least 8 chars.',
                minLength: 8,
              },
              name: {
                required: false,
                type: () => String,
                description: 'User name. Max length: 128 chars.',
                minLength: 1,
                maxLength: 128,
              },
            },
            CreateUserWithShaDTO: {
              passwordVersion: {
                required: false,
                type: () => String,
                description:
                  "Optional SHA version used to hash password. Allowed values are: 'sha1', 'sha224', 'sha256', 'sha384', 'sha512/224', 'sha512/256', 'sha512', 'sha3-224', 'sha3-256', 'sha3-384', 'sha3-512'",
                pattern:
                  '/^(sha1|sha224|sha256|sha384|sha512\\/224|sha512\\/256|sha512|sha3-224|sha3-256|sha3-384|sha3-512)$/',
              },
            },
            CreateUserWithScryptDTO: {
              passwordSalt: {
                required: false,
                type: () => String,
                description: 'Optional salt used to hash password.',
                minLength: 1,
                maxLength: 128,
              },
              passwordCpu: {
                required: false,
                type: () => Number,
                description: 'Optional CPU cost used to hash password.',
              },
              passwordMemory: {
                required: false,
                type: () => Number,
                description: 'Optional memory cost used to hash password.',
              },
              passwordParallel: {
                required: false,
                type: () => Number,
                description:
                  'Optional parallelization cost used to hash password.',
              },
              passwordLength: {
                required: false,
                type: () => Number,
                description: 'Optional hash length used to hash password.',
              },
            },
            CreateUserWithScryptModifedDTO: {
              passwordSalt: {
                required: false,
                type: () => String,
                description: 'Salt used to hash password.',
                minLength: 1,
                maxLength: 128,
              },
              passwordSaltSeparator: {
                required: false,
                type: () => String,
                description: 'Salt separator used to hash password.',
                minLength: 1,
                maxLength: 128,
              },
              passwordSignerKey: {
                required: false,
                type: () => String,
                description: 'Signer key used to hash password.',
                minLength: 1,
                maxLength: 128,
              },
            },
            UpdateUserStatusDTO: {
              status: {
                required: true,
                type: () => Boolean,
                description:
                  'User Status. To activate the user pass `true` and to block the user pass `false`.',
              },
            },
            UpdateUserLabelDTO: {
              labels: {
                required: false,
                type: () => [String],
                pattern: '/^[a-zA-Z0-9]{1,36}$/',
              },
            },
            UpdateUserPoneVerificationDTO: {
              phoneVerification: {
                required: true,
                type: () => Boolean,
                description: 'User phone verification status.',
              },
            },
            UpdateUserEmailVerificationDTO: {
              emailVerification: {
                required: true,
                type: () => Boolean,
                description: 'User email verification status.',
              },
            },
            UpdateUserNameDTO: {
              name: {
                required: true,
                type: () => String,
                description: 'User name. Max length: 128 chars.',
                minLength: 1,
                maxLength: 128,
              },
            },
            UpdateUserPasswordDTO: {
              password: {
                required: true,
                type: () => String,
                description: 'New user password. Must be at least 8 chars.',
                minLength: 8,
              },
            },
            UpdateUserEmailDTO: {
              email: {
                required: true,
                type: () => String,
                description: 'User email.',
                format: 'email',
              },
            },
            UpdateUserPhoneDTO: {
              phone: {
                required: true,
                type: () => String,
                description: 'User phone number.',
              },
            },
            UpdateUserPrefsDTO: {
              prefs: {
                required: false,
                type: () => Object,
                description: 'Prefs key-value JSON object.',
              },
            },
            UserParamDTO: {
              userId: {
                required: true,
                type: () => String,
                description: 'User ID.',
              },
            },
            IdentityParamDTO: {
              identityId: {
                required: true,
                type: () => String,
                description: 'Identity ID.',
              },
            },
            RangeQueryDTO: {
              range: {
                required: false,
                type: () => String,
                description: 'Date range.',
                default: '30d',
              },
            },
          },
        ],
        [
          import('./users/DTO/token.dto.js'),
          {
            CreateTokenDTO: {
              length: {
                required: true,
                type: () => Number,
                description:
                  'Token length in characters. The default length is 6 characters',
                default: 6,
                minimum: 4,
                maximum: 128,
              },
              expire: {
                required: true,
                type: () => Number,
                description: 'Token expiration period in seconds.',
                minimum: 60,
              },
            },
          },
        ],
        [
          import('./users/DTO/jwt.dto.js'),
          {
            CreateJwtDTO: {
              sessionId: {
                required: false,
                type: () => String,
                description:
                  "Session ID. Use the string \\'recent\\' to use the most recent session. Defaults to the most recent session.",
                default: 'recent',
              },
              duration: {
                required: true,
                type: () => Number,
                description:
                  'Time in seconds before JWT expires. Default duration is 900 seconds, and maximum is 3600 seconds.',
                default: 900,
                minimum: 0,
                maximum: 3600,
              },
            },
          },
        ],
        [
          import('./users/sessions/DTO/session.dto.js'),
          {
            SessionParamDTO: {
              sessionId: {
                required: true,
                type: () => String,
                description: 'Session ID.',
              },
            },
          },
        ],
        [
          import('./users/targets/DTO/target.dto.js'),
          {
            CreateTargetDTO: {
              targetId: {
                required: true,
                type: () => String,
                description:
                  "Target ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.",
              },
              providerType: {
                required: true,
                type: () => String,
                description:
                  'The target provider type. Can be one of the following: `email`, `sms` or `push`.',
              },
              identifier: {
                required: true,
                type: () => String,
                description: 'The target identifier (token, email, phone etc.)',
                minLength: 1,
              },
              providerId: {
                required: false,
                type: () => String,
                description:
                  'Provider ID. Message will be sent to this target from the specified provider ID. If no provider ID is set the first setup provider will be used.',
              },
              name: {
                required: true,
                type: () => String,
                description:
                  'Target name. Max length: 128 chars. For example: My Awesome App Galaxy S24.',
                minLength: 1,
                maxLength: 128,
              },
            },
            UpdateTargetDTO: {},
            TargetParamDTO: {
              targetId: {
                required: true,
                type: () => String,
                description: 'Target ID.',
              },
            },
          },
        ],
        [
          import('./users/mfa/DTO/mfa.dto.js'),
          {
            UpdateMfaStatusDTO: {
              mfa: {
                required: true,
                type: () => Boolean,
                description: 'Enable or disable MFA.',
              },
            },
            MfaTypeParamDTO: {
              type: {
                required: true,
                type: () => String,
                description: 'Type of authenticator.',
              },
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
          import('./account/DTO/verification.dto.js'),
          {
            CreateEmailVerificationDTO: {
              url: {
                required: false,
                type: () => String,
                description:
                  'URL to redirect the user back to your app from the verification email. Only URLs from hostnames in your project platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.',
                format: 'uri',
              },
            },
            UpdateEmailVerificationDTO: {
              userId: {
                required: true,
                type: () => String,
                description: 'User ID.',
              },
              secret: {
                required: true,
                type: () => String,
                description: 'Valid verification token.',
              },
            },
            UpdatePhoneVerificationDTO: {},
          },
        ],
        [
          import('./account/identities/DTO/identity.dto.js'),
          {
            IdentityIdParamDTO: {
              identityId: {
                required: true,
                type: () => String,
                description: 'Identity ID.',
              },
            },
          },
        ],
        [
          import('./account/mfa/DTO/mfa.dto.js'),
          {
            UpdateAccountMfaDTO: {
              mfa: {
                required: true,
                type: () => Boolean,
                description: 'Enable or disable MFA.',
              },
            },
            MfaAuthenticatorTypeParamDTO: {
              type: {
                required: true,
                type: () => String,
                description: 'Type of authenticator. Must be `totp`',
              },
            },
            VerifyMfaAuthenticatorDTO: {
              otp: {
                required: true,
                type: () => String,
                description: 'Valid verification token.',
              },
            },
            CreateMfaChallengeDTO: {
              factor: { required: true, type: () => String },
            },
            VerifyMfaChallengeDTO: {
              challengeId: {
                required: true,
                type: () => String,
                description: 'ID of the challenge.',
              },
              otp: {
                required: true,
                type: () => String,
                description: 'Valid verification token.',
              },
            },
          },
        ],
        [
          import('./account/recovery/DTO/recovery.dto.js'),
          {
            CreateRecoveryDTO: {
              email: {
                required: true,
                type: () => String,
                description: 'User email.',
                format: 'email',
              },
              url: {
                required: true,
                type: () => String,
                description:
                  'URL to redirect the user back to your app from the recovery email. Only URLs from hostnames in your project platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.',
                format: 'uri',
              },
            },
            UpdateRecoveryDTO: {
              userId: {
                required: true,
                type: () => String,
                description: 'User ID.',
              },
              secret: {
                required: true,
                type: () => String,
                description: 'Valid reset token.',
              },
              password: {
                required: true,
                type: () => String,
                description:
                  'New user password. Must be between 8 and 256 chars.',
              },
            },
          },
        ],
        [
          import('./account/sessions/DTO/session.dto.js'),
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
            CreateSessionDTO: {
              userId: {
                required: true,
                type: () => String,
                description:
                  "User ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.",
              },
              secret: {
                required: true,
                type: () => String,
                description:
                  'Secret of a token generated by login methods. For example, the `createMagicURLToken` or `createPhoneToken` methods.',
                minLength: 200,
                maxLength: 256,
              },
            },
            CreateOAuth2SessionDTO: {
              success: {
                required: false,
                type: () => String,
                description:
                  "URL to redirect back to your app after a successful login attempt.  Only URLs from hostnames in your project\\'s platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.",
                format: 'uri',
              },
              failure: {
                required: false,
                type: () => String,
                description:
                  "URL to redirect back to your app after a failed login attempt.  Only URLs from hostnames in your project\\'s platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.",
                format: 'uri',
              },
              scopes: { required: false, type: () => [String] },
            },
            OAuth2CallbackDTO: {
              code: {
                required: false,
                type: () => String,
                description:
                  'OAuth2 code. This is a temporary code that the will be later exchanged for an access token.',
                maxLength: 2048,
              },
              state: {
                required: false,
                type: () => String,
                description: 'Login state params.',
                maxLength: 2048,
              },
              error: {
                required: false,
                type: () => String,
                description: 'Error code returned from the OAuth2 provider.',
                maxLength: 2048,
              },
              error_description: {
                required: false,
                type: () => String,
                description:
                  'Human-readable text providing additional information about the error returned from the OAuth2 provider.',
                maxLength: 2048,
              },
            },
            ProviderParamDTO: {
              provider: { required: true, type: () => Object },
            },
            SessionsParamDTO: {
              sessionId: {
                required: true,
                type: () => String,
                description:
                  "Session ID. Use the string \\'current\\' to refer current device session.",
              },
            },
            OAuth2CallbackParamDTO: {
              projectId: {
                required: true,
                type: () => String,
                description: 'Project ID.',
              },
              provider: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('./account/sessions/DTO/token.dto.js'),
          {
            CreateOAuth2TokenDTO: {
              success: {
                required: false,
                type: () => String,
                description:
                  "URL to redirect back to your app after a successful login attempt.  Only URLs from hostnames in your project\\'s platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.",
                format: 'uri',
              },
              failure: {
                required: false,
                type: () => String,
                description:
                  "URL to redirect back to your app after a failed login attempt.  Only URLs from hostnames in your project\\'s platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.",
                format: 'uri',
              },
              scopes: {
                required: true,
                type: () => [String],
                description: 'Array of OAuth2 scopes.',
              },
            },
            CreateMagicURLTokenDTO: {
              userId: {
                required: true,
                type: () => String,
                description:
                  "Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars. If the email address has never been used, a new account is created using the provided userId. Otherwise, if the email address is already attached to an account, the user ID is ignored.",
              },
              email: {
                required: true,
                type: () => String,
                description: 'User email.',
                format: 'email',
              },
              url: {
                required: false,
                type: () => String,
                description:
                  'URL to redirect the user back to your app from the magic URL login. Only URLs from hostnames in your project platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.',
                format: 'uri',
              },
              phrase: {
                required: false,
                type: () => Boolean,
                description:
                  'Toggle for security phrase. If enabled, email will be send with a randomly generated phrase and the phrase will also be included in the response. Confirming phrases match increases the security of your authentication flow.',
                default: false,
              },
            },
            CreateEmailTokenDTO: {},
            CreatePhoneTokenDTO: {
              phone: {
                required: true,
                type: () => String,
                description:
                  "Phone number. Format this number with a leading \\'+\\' and a country code, e.g., +16175551212.",
              },
            },
          },
        ],
        [
          import('./account/targets/DTO/target.dto.js'),
          {
            CreatePushTargetDTO: {
              targetId: {
                required: true,
                type: () => String,
                description:
                  "Target ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.",
              },
              identifier: {
                required: true,
                type: () => String,
                description: 'The target identifier (token, email, phone etc.)',
              },
              providerId: {
                required: false,
                type: () => String,
                description:
                  'Provider ID. Message will be sent to this target from the specified provider ID. If no provider ID is set the first setup provider will be used.',
              },
            },
            UpdatePushTargetDTO: {},
            TargetIdParamDTO: {
              targetId: {
                required: true,
                type: () => String,
                description: 'Target ID.',
              },
            },
          },
        ],
        [
          import('./teams/DTO/team.dto.js'),
          {
            CreateTeamDTO: {
              teamId: {
                required: true,
                type: () => String,
                description:
                  "Team ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.",
              },
              name: {
                required: true,
                type: () => String,
                description: 'Team name. Max length: 128 chars.',
                minLength: 1,
                maxLength: 128,
              },
              roles: {
                required: false,
                type: () => [String],
                minLength: 1,
                maxLength: 32,
              },
            },
            UpdateTeamDTO: {},
            UpdateTeamPrefsDTO: {
              prefs: {
                required: false,
                type: () => Object,
                description: 'Prefs key-value JSON object.',
              },
            },
            TeamsParamDTO: {
              teamId: {
                required: true,
                type: () => String,
                description: 'Team ID.',
              },
            },
          },
        ],
        [
          import('./teams/memberships/DTO/membership.dto.js'),
          {
            CreateMembershipDTO: {
              email: {
                required: false,
                type: () => String,
                description: 'Email of the new team member.',
                format: 'email',
              },
              userId: {
                required: false,
                type: () => String,
                description: 'ID of the user to be added to a team.',
              },
              phone: {
                required: false,
                type: () => String,
                description:
                  "Phone number. Format this number with a leading \\'+\\' and a country code, e.g., +16175551212.",
              },
              roles: {
                required: true,
                type: () => [String],
                description:
                  'Array of strings. Use this param to set the user roles in the team. A role can be any string. Learn more about [roles and permissions](https://docs.nuvix.in/permissions).',
              },
              url: {
                required: false,
                type: () => String,
                description:
                  'URL to redirect the user back to your app from the invitation email. This parameter is not required when an API key is supplied. Only URLs from hostnames in your project platform list are allowed. This requirement helps to prevent an [open redirect](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) attack against your project API.',
                format: 'uri',
              },
              name: {
                required: false,
                type: () => String,
                description: 'Name of the new team member.',
                maxLength: 128,
              },
            },
            UpdateMembershipDTO: {
              roles: {
                required: true,
                type: () => [String],
                description:
                  "An array of strings. Use this param to set the user\\'s roles in the team. A role can be any string. Learn more about [roles and permissions](https://docs.nuvix.in/permissions).",
              },
            },
            UpdateMembershipStatusDTO: {
              userId: {
                required: true,
                type: () => String,
                description: 'User ID.',
              },
              secret: {
                required: true,
                type: () => String,
                description: 'Secret key.',
                maxLength: 256,
              },
            },
            MembershipParamDTO: {
              membershipId: {
                required: true,
                type: () => String,
                description: 'Membership ID.',
              },
            },
          },
        ],
        [
          import('./storage/DTO/bucket.dto.js'),
          {
            CreateBucketDTO: {
              bucketId: {
                required: true,
                type: () => String,
                description:
                  "Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.",
              },
              name: {
                required: true,
                type: () => String,
                description: 'Bucket name',
                maxLength: 128,
              },
              permissions: {
                required: true,
                type: () => [String],
                description:
                  'An array of permission strings. By default, no user is granted with any permissions. [Learn more about permissions](https://docs.nuvix.in/permissions).',
              },
              fileSecurity: {
                required: true,
                type: () => Boolean,
                description:
                  'Enables configuring permissions for individual file. A user needs one of file or bucket level permissions to access a file. [Learn more about permissions](https://docs.nuvix.in/permissions).',
                default: false,
              },
              enabled: {
                required: true,
                type: () => Boolean,
                description:
                  "Is bucket enabled? When set to \\'disabled\\', users cannot access the files in this bucket but Server SDKs with and API key can still access the bucket. No files are lost when this is toggled.",
                default: true,
              },
              maximumFileSize: {
                required: true,
                type: () => Number,
                description: 'Maximum file size allowed in bytes.',
                minimum: 1,
              },
              allowedFileExtensions: {
                required: true,
                type: () => [String],
                description: 'Allowed file extensions.',
              },
              compression: {
                required: true,
                type: () => String,
                description: 'Compression algorithm choosen for compression.',
                default: 'none',
              },
              encryption: {
                required: true,
                type: () => Boolean,
                description: 'Is encryption enabled?',
                default: false,
              },
              antivirus: {
                required: true,
                type: () => Boolean,
                description: 'Is virus scanning enabled?',
                default: false,
              },
            },
            UpdateBucketDTO: {},
            BucketParamsDTO: {
              bucketId: {
                required: true,
                type: () => String,
                description: 'Bucket ID.',
              },
            },
            UsageQueryDTO: {
              range: {
                required: false,
                type: () => String,
                description: 'Date range.',
                default: '30d',
              },
            },
          },
        ],
        [
          import('./storage/files/DTO/file.dto.js'),
          {
            CreateFileDTO: {
              fileId: { required: true, type: () => String },
              permissions: {
                required: false,
                type: () => [String],
                description:
                  'An array of permission strings. By default, only the current user is granted all permissions. [Learn more about permissions](https://docs.nuvix.in/permissions).',
              },
            },
            UpdateFileDTO: {
              name: {
                required: false,
                type: () => String,
                description: 'A name for the file (1-255 characters).',
                minLength: 1,
                maxLength: 255,
              },
            },
            FileParamsDTO: {
              fileId: {
                required: true,
                type: () => String,
                description: 'The file ID.',
              },
            },
            PreviewFileQueryDTO: {
              width: {
                required: false,
                type: () => Number,
                description:
                  'Resize preview image width, integer between 0 and 4000.',
                minimum: 0,
                maximum: 4000,
              },
              height: {
                required: false,
                type: () => Number,
                description:
                  'Resize preview image height, integer between 0 and 4000.',
                minimum: 0,
                maximum: 4000,
              },
              gravity: {
                required: false,
                type: () => String,
                description: 'Image crop gravity.',
              },
              quality: {
                required: false,
                type: () => Number,
                description:
                  'Preview image quality, integer between 0 and 100.',
                minimum: 0,
                maximum: 100,
              },
              borderWidth: {
                required: false,
                type: () => Number,
                description:
                  'Preview image border in pixels, integer between 0 and 100.',
                minimum: 0,
                maximum: 100,
              },
              borderColor: {
                required: false,
                type: () => String,
                description:
                  'Preview image border color, valid HEX without # prefix.',
              },
              borderRadius: {
                required: false,
                type: () => Number,
                description:
                  'Preview image border radius in pixels, integer between 0 and 4000.',
                minimum: 0,
                maximum: 4000,
              },
              opacity: {
                required: false,
                type: () => Number,
                description: 'Preview image opacity, number between 0 and 1.',
                minimum: 0,
                maximum: 1,
              },
              rotation: {
                required: false,
                type: () => Number,
                description:
                  'Preview image rotation in degrees, integer between -360 and 360.',
                minimum: -360,
                maximum: 360,
              },
              background: {
                required: false,
                type: () => String,
                description:
                  'Preview image background color, valid HEX without # prefix.',
              },
              output: {
                required: false,
                type: () => String,
                description: 'Output format type (jpeg, jpg, png, gif, webp).',
              },
            },
          },
        ],
        [
          import('./messaging/DTO/message.dto.js'),
          {
            CreateEmailMessageDTO: {
              subject: {
                required: true,
                type: () => String,
                description: 'Email Subject.',
                maxLength: 998,
              },
              content: {
                required: true,
                type: () => String,
                description: 'Email Content.',
                maxLength: 64230,
              },
              cc: {
                required: false,
                type: () => [String],
                description: 'Array of target IDs to be added as CC.',
              },
              bcc: {
                required: false,
                type: () => [String],
                description: "Array of target IDs to be added as BCC.'",
              },
              attachments: {
                required: false,
                type: () => [String],
                description:
                  'Array of compound ID strings of bucket IDs and file IDs to be attached to the email. They should be formatted as <BUCKET_ID>:<FILE_ID>.',
              },
              html: {
                required: false,
                type: () => Boolean,
                description: 'Is content of type HTML',
              },
            },
            CreateSmsMessageDTO: {
              content: {
                required: true,
                type: () => String,
                description: 'SMS Content.',
                maxLength: 64230,
              },
            },
            CreatePushMessageDTO: {
              title: {
                required: false,
                type: () => String,
                description: 'Title for push notification.',
                maxLength: 256,
              },
              body: {
                required: false,
                type: () => String,
                description: 'Body for push notification.',
                maxLength: 64230,
              },
              data: {
                required: false,
                type: () => Object,
                description:
                  'Additional key-value pair data for push notification.',
              },
              action: {
                required: false,
                type: () => String,
                description: 'Action for push notification.',
                maxLength: 256,
              },
              image: {
                required: false,
                type: () => String,
                description:
                  'Image for push notification. Must be a compound bucket ID to file ID of a jpeg, png, or bmp image in Nuvix Storage. It should be formatted as <BUCKET_ID>:<FILE_ID>.',
              },
              icon: {
                required: false,
                type: () => String,
                description:
                  'Icon for push notification. Available only for Android and Web Platform.',
                maxLength: 256,
              },
              sound: {
                required: false,
                type: () => String,
                description:
                  'Sound for push notification. Available only for Android and iOS Platform.',
                maxLength: 256,
              },
              color: {
                required: false,
                type: () => String,
                description:
                  'Color for push notification. Available only for Android Platform.',
                maxLength: 256,
              },
              tag: {
                required: false,
                type: () => String,
                description:
                  'Tag for push notification. Available only for Android Platform.',
                maxLength: 256,
              },
              badge: {
                required: false,
                type: () => Number,
                description:
                  'Badge for push notification. Available only for iOS Platform.',
                minimum: -1,
              },
              contentAvailable: {
                required: false,
                type: () => Boolean,
                description:
                  'If set to true, the notification will be delivered in the background. Available only for iOS Platform.',
              },
              critical: {
                required: false,
                type: () => Boolean,
                description:
                  'If set to true, the notification will be marked as critical. This requires the app to have the critical notification entitlement. Available only for iOS Platform.',
              },
              priority: {
                required: false,
                type: () => Object,
                description:
                  'Set the notification priority. "normal" will consider device state and may not deliver notifications immediately. "high" will always attempt to immediately deliver the notification.',
                default: 'high',
              },
            },
            UpdateEmailMessageDTO: {},
            UpdateSmsMessageDTO: {},
            UpdatePushMessageDTO: {},
            MessageParamsDTO: {
              messageId: {
                required: true,
                type: () => String,
                description: 'Message ID.',
              },
            },
          },
        ],
        [
          import('./messaging/providers/DTO/base.dto.js'),
          {
            CreateProviderDTO: {
              providerId: {
                required: true,
                type: () => String,
                description:
                  "Provider ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.",
              },
              name: {
                required: true,
                type: () => String,
                description: 'Provider name.',
                maxLength: 128,
              },
              enabled: {
                required: false,
                type: () => Boolean,
                description: 'Set as enabled.',
              },
            },
            ProviderParamsDTO: {
              providerId: {
                required: true,
                type: () => String,
                description: 'Provider ID.',
              },
            },
          },
        ],
        [
          import('./messaging/providers/DTO/mailgun.dto.js'),
          {
            CreateMailgunProviderDTO: {
              apiKey: {
                required: false,
                type: () => String,
                description: 'Mailgun API Key.',
              },
              domain: {
                required: false,
                type: () => String,
                description: 'Mailgun Domain.',
              },
              isEuRegion: {
                required: false,
                type: () => Boolean,
                description: 'Set as EU region.',
              },
              fromName: {
                required: false,
                type: () => String,
                description: 'Sender Name.',
                maxLength: 128,
              },
              fromEmail: {
                required: false,
                type: () => String,
                description: 'Sender email address.',
                format: 'email',
              },
              replyToName: {
                required: false,
                type: () => String,
                description:
                  'Name set in the reply to field for the mail. Default value is sender name. Reply to name must have reply to email as well.',
                maxLength: 128,
              },
              replyToEmail: {
                required: false,
                type: () => String,
                description:
                  'Email set in the reply to field for the mail. Default value is sender email. Reply to email must have reply to name as well.',
                format: 'email',
              },
            },
            UpdateMailgunProviderDTO: {},
          },
        ],
        [
          import('./messaging/providers/DTO/sendgrid.dto.js'),
          {
            CreateSendgridProviderDTO: {
              apiKey: {
                required: true,
                type: () => String,
                description: 'Sendgrid API key.',
              },
              fromName: {
                required: false,
                type: () => String,
                description: 'Sender Name.',
                maxLength: 128,
              },
              fromEmail: {
                required: false,
                type: () => String,
                description: 'Sender email address.',
                format: 'email',
              },
              replyToName: {
                required: false,
                type: () => String,
                description:
                  'Name set in the reply to field for the mail. Default value is sender name.',
                maxLength: 128,
              },
              replyToEmail: {
                required: false,
                type: () => String,
                description:
                  'Email set in the reply to field for the mail. Default value is sender email.',
                format: 'email',
              },
            },
            UpdateSendgridProviderDTO: {},
          },
        ],
        [
          import('./messaging/providers/DTO/twilio.dto.js'),
          {
            CreateTwilioProviderDTO: {
              from: {
                required: false,
                type: () => String,
                description:
                  "Sender Phone number. Format this number with a leading \\'+\\' and a country code, e.g., +16175551212.",
              },
              accountSid: {
                required: false,
                type: () => String,
                description: 'Twilio account secret ID.',
              },
              authToken: {
                required: false,
                type: () => String,
                description: 'Twilio authentication token.',
              },
            },
            UpdateTwilioProviderDTO: {},
          },
        ],
        [
          import('./messaging/providers/DTO/smtp.dto.js'),
          {
            CreateSMTPProviderDTO: {
              host: {
                required: true,
                type: () => String,
                description:
                  'SMTP hosts. Either a single hostname or multiple semicolon-delimited hostnames. You can also specify a different port for each host such as `smtp1.example.com:25;smtp2.example.com`. You can also specify encryption type, for example: `tls://smtp1.example.com:587;ssl://smtp2.example.com:465"`. Hosts will be tried in order.',
              },
              port: {
                required: false,
                type: () => Number,
                description: 'The default SMTP server port.',
                default: 587,
                minimum: 1,
                maximum: 65535,
              },
              username: {
                required: false,
                type: () => String,
                description: 'Authentication username.',
              },
              password: {
                required: false,
                type: () => String,
                description: 'Authentication password.',
              },
              encryption: {
                required: false,
                type: () => String,
                description: "Encryption type. Can be omitted, 'ssl' or 'tls'",
                default: 'none',
              },
              autoTLS: {
                required: false,
                type: () => Boolean,
                description: 'Enable SMTP AutoTLS feature.',
                default: true,
              },
              mailer: {
                required: false,
                type: () => String,
                description: 'The value to use for the X-Mailer header.',
              },
              fromName: {
                required: false,
                type: () => String,
                description: 'Sender Name.',
                maxLength: 128,
              },
              fromEmail: {
                required: false,
                type: () => String,
                description: 'Sender email address.',
                format: 'email',
              },
              replyToName: {
                required: false,
                type: () => String,
                description:
                  'Name set in the reply to field for the mail. Default value is sender name.',
                maxLength: 128,
              },
              replyToEmail: {
                required: false,
                type: () => String,
                description:
                  'Email set in the reply to field for the mail. Default value is sender email.',
                format: 'email',
              },
            },
            UpdateSMTPProviderDTO: {},
          },
        ],
        [
          import('./messaging/providers/DTO/msg91.dto.js'),
          {
            CreateMsg91ProviderDTO: {
              templateId: {
                required: false,
                type: () => String,
                description: 'Msg91 template ID',
              },
              senderId: {
                required: false,
                type: () => String,
                description: 'Msg91 sender ID.',
              },
              authKey: {
                required: false,
                type: () => String,
                description: 'Msg91 auth key.',
              },
            },
            UpdateMsg91ProviderDTO: {},
          },
        ],
        [
          import('./messaging/providers/DTO/telesign.dto.js'),
          {
            CreateTelesignProviderDTO: {
              from: {
                required: false,
                type: () => String,
                description:
                  "Sender Phone number. Format this number with a leading \\'+\\' and a country code, e.g., +16175551212.",
              },
              customerId: {
                required: false,
                type: () => String,
                description: 'Telesign customer ID.',
              },
              apiKey: {
                required: false,
                type: () => String,
                description: 'Telesign API key.',
              },
            },
            UpdateTelesignProviderDTO: {},
          },
        ],
        [
          import('./messaging/providers/DTO/textmagic.dto.js'),
          {
            CreateTextmagicProviderDTO: {
              from: {
                required: false,
                type: () => String,
                description:
                  "Sender Phone number. Format this number with a leading \\'+\\' and a country code, e.g., +16175551212.",
              },
              username: {
                required: false,
                type: () => String,
                description: 'Textmagic username.',
              },
              apiKey: {
                required: false,
                type: () => String,
                description: 'Textmagic apiKey.',
              },
            },
            UpdateTextmagicProviderDTO: {},
          },
        ],
        [
          import('./messaging/providers/DTO/vonage.dto.js'),
          {
            CreateVonageProviderDTO: {
              from: {
                required: false,
                type: () => String,
                description:
                  "Sender Phone number. Format this number with a leading \\'+\\' and a country code, e.g., +16175551212.",
              },
              apiKey: {
                required: false,
                type: () => String,
                description: 'Vonage API key.',
              },
              apiSecret: {
                required: false,
                type: () => String,
                description: 'Vonage API secret.',
              },
            },
            UpdateVonageProviderDTO: {},
          },
        ],
        [
          import('./messaging/providers/DTO/fcm.dto.js'),
          {
            CreateFcmProviderDTO: {
              serviceAccountJSON: {
                required: false,
                type: () => Object,
                description: 'FCM service account JSON.',
              },
            },
            UpdateFcmProviderDTO: {},
          },
        ],
        [
          import('./messaging/providers/DTO/apns.dto.js'),
          {
            CreateApnsProviderDTO: {
              authKey: {
                required: false,
                type: () => String,
                description: 'APNS authentication key.',
              },
              authKeyId: {
                required: false,
                type: () => String,
                description: 'APNS authentication key ID.',
              },
              teamId: {
                required: false,
                type: () => String,
                description: 'APNS team ID.',
              },
              bundleId: {
                required: false,
                type: () => String,
                description: 'APNS bundle ID.',
              },
              sandbox: {
                required: false,
                type: () => Boolean,
                description: 'Use APNS sandbox environment.',
                default: false,
              },
            },
            UpdateApnsProviderDTO: {},
          },
        ],
        [
          import('./messaging/topics/DTO/topics.dto.js'),
          {
            CreateTopicDTO: {
              topicId: {
                required: true,
                type: () => String,
                description:
                  'Topic ID. Choose a custom Topic ID or a new Topic ID.',
              },
              name: {
                required: true,
                type: () => String,
                description: 'Topic Name.',
                maxLength: 128,
              },
              subscribe: {
                required: false,
                type: () => [String],
                description:
                  'An array of role strings with subscribe permission. By default all users are granted with any subscribe permission. [learn more about roles](https://docs.nuvix.in/permissions#permission-roles).',
              },
            },
            UpdateTopicDTO: {},
            TopicParamsDTO: {
              topicId: {
                required: true,
                type: () => String,
                description: 'Topic ID.',
              },
            },
          },
        ],
        [
          import('./messaging/topics/subscribers/DTO/subscriber.dto.js'),
          {
            CreateSubscriberDTO: {
              subscriberId: {
                required: true,
                type: () => String,
                description:
                  'Subscriber ID. Choose a custom Subscriber ID or a new Subscriber ID.',
              },
              targetId: {
                required: true,
                type: () => String,
                description:
                  'Target ID. The target ID to link to the specified Topic ID.',
              },
            },
            SubscriberParamsDTO: {
              subscriberId: {
                required: true,
                type: () => String,
                description: 'Subscriber ID.',
              },
            },
          },
        ],
        [
          import('./schemas/DTO/permissions.dto.js'),
          {
            PermissionsDTO: {
              permissions: {
                required: true,
                type: () => [String],
                description:
                  "An array of permissions strings. [Learn more about permissions](https://docs.nuvix.in/permissions).'",
              },
            },
          },
        ],
        [
          import('./schemas/DTO/table.dto.js'),
          {
            TableParamsDTO: {
              schemaId: {
                required: true,
                type: () => String,
                description:
                  'Schema ID. (See [Schemas](https://docs.nuvix.in/schemas)).',
                default: 'public',
              },
              tableId: {
                required: true,
                type: () => String,
                description: 'Table ID.',
              },
            },
            FunctionParamsDTO: {
              schemaId: {
                required: true,
                type: () => String,
                description:
                  'Schema ID. (See [Schemas](https://docs.nuvix.in/schemas)).',
                default: 'public',
              },
              functionId: {
                required: true,
                type: () => String,
                description: 'Function ID.',
              },
            },
            RowParamsDTO: {
              rowId: {
                required: true,
                type: () => Number,
                description:
                  'Row ID. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#_id))',
              },
            },
          },
        ],
        [
          import('./schemas/collections/DTO/collection.dto.js'),
          {
            CreateCollectionDTO: {
              collectionId: {
                required: true,
                type: () => String,
                description:
                  "Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.",
              },
              name: {
                required: true,
                type: () => String,
                description: 'Collection name. Max length: 128 chars.',
                maxLength: 128,
              },
              permissions: {
                required: false,
                type: () => [String],
                description:
                  'An array of permissions strings. By default, no user is granted with any permissions. [Learn more about permissions](https://docs.nuvix.in/permissions).',
              },
              documentSecurity: {
                required: true,
                type: () => Boolean,
                description:
                  'Enables configuring permissions for individual documents. A user needs one of document or collection level permissions to access a document. [Learn more about permissions](https://docs.nuvix.in/permissions).',
                default: false,
              },
              enabled: {
                required: true,
                type: () => Boolean,
                description:
                  "Is collection enabled? When set to \\'disabled\\', users cannot access the collection but Server SDKs with and API key can still read and write to the collection. No data is lost when this is toggled.",
                default: true,
              },
            },
            UpdateCollectionDTO: {
              documentSecurity: {
                required: false,
                type: () => Boolean,
                description:
                  'Enables configuring permissions for individual documents. A user needs one of document or collection level permissions to access a document. [Learn more about permissions](https://docs.nuvix.in/permissions).',
              },
            },
            CollectionParamsDTO: {
              schemaId: {
                required: true,
                type: () => String,
                description:
                  'Schema ID. (See [Schemas](https://docs.nuvix.in/schemas)).',
              },
              collectionId: {
                required: true,
                type: () => String,
                description: 'Collection ID.',
              },
            },
          },
        ],
        [
          import('./schemas/collections/documents/DTO/document.dto.js'),
          {
            CreateDocumentDTO: {
              documentId: {
                required: true,
                type: () => String,
                description:
                  "ocument ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\\'t start with a special char. Max length is 36 chars.",
              },
              data: {
                required: true,
                type: () => Object,
                description: 'Document data as JSON object.',
              },
              permissions: {
                required: true,
                type: () => [String],
                description:
                  "An array of permissions strings. By default, only the current user is granted all permissions. [Learn more about permissions](https://docs.nuvix.in/permissions).'",
              },
            },
            UpdateDocumentDTO: {},
            DocumentParamsDTO: {
              documentId: {
                required: true,
                type: () => String,
                description: 'Document ID.',
              },
            },
          },
        ],
        [
          import('./schemas/collections/attributes/DTO/attributes.dto.js'),
          {
            CreateStringAttributeDTO: {
              key: {
                required: true,
                type: () => String,
                description: 'Attribute Key.',
              },
              size: {
                required: true,
                type: () => Number,
                description:
                  'Attribute size for text attributes, in number of characters',
                default: 0,
                minimum: 1,
              },
              required: {
                required: false,
                type: () => Boolean,
                description: 'Is attribute required?',
                default: false,
              },
              default: {
                required: false,
                type: () => String,
                nullable: true,
                description:
                  'Default value for attribute when not provided. Cannot be set when attribute is required.',
                default: null,
              },
              array: {
                required: false,
                type: () => Boolean,
                description: 'Is attribute an array?',
                default: false,
              },
              encrypt: {
                required: false,
                type: () => Boolean,
                description:
                  'Toggle encryption for the attribute. Encryption enhances security by not storing any plain text values in the database. However, encrypted attributes cannot be queried.',
                default: false,
              },
            },
            CreateEmailAttributeDTO: {},
            CreateEnumAttributeDTO: {
              elements: {
                required: false,
                type: () => [String],
                description:
                  'Array of elements in enumerated type. Uses length of longest element to determine size.',
                minLength: 1,
                maxLength: 1024,
              },
              default: {
                required: false,
                type: () => Object,
                description:
                  'Default value for attribute when not provided. Cannot be set when attribute is required.',
                default: null,
              },
            },
            CreateIpAttributeDTO: {},
            CreateURLAttributeDTO: {},
            CreateIntegerAttributeDTO: {
              min: {
                required: false,
                type: () => Number,
                description: 'Minimum value to enforce on new documents',
              },
              max: {
                required: false,
                type: () => Number,
                description: 'Maximum value to enforce on new documents',
              },
              default: {
                required: false,
                type: () => Number,
                description:
                  'Default value for attribute when not provided. Cannot be set when attribute is required.',
              },
            },
            CreateFloatAttributeDTO: {},
            CreateBooleanAttributeDTO: {
              default: {
                required: false,
                type: () => Boolean,
                description:
                  'Default value for attribute when not provided. Cannot be set when attribute is required.',
                default: false,
              },
            },
            CreateDatetimeAttributeDTO: {},
            CreateRelationAttributeDTO: {
              relatedCollectionId: {
                required: true,
                type: () => String,
                description: 'Related Collection ID.',
              },
              type: {
                required: true,
                description: 'Relation type',
                enum: t['@nuvix/db'].RelationType,
              },
              twoWay: {
                required: false,
                type: () => Boolean,
                description: 'Is Two Way?',
                default: false,
              },
              key: {
                required: true,
                type: () => String,
                description: 'Attribute Key.',
              },
              twoWayKey: {
                required: false,
                type: () => String,
                description: 'Two Way Attribute Key.',
              },
              onDelete: {
                required: true,
                description: 'Constraints option',
                enum: t['@nuvix/db'].OnDelete,
              },
            },
            UpdateStringAttributeDTO: {
              newKey: {
                required: false,
                type: () => String,
                description: 'New attribute key.',
              },
            },
            UpdateEmailAttributeDTO: {},
            UpdateEnumAttributeDTO: {
              newKey: {
                required: false,
                type: () => String,
                description: 'New attribute key.',
              },
            },
            UpdateIpAttributeDTO: {
              newKey: {
                required: false,
                type: () => String,
                description: 'New attribute key.',
              },
            },
            UpdateURLAttributeDTO: {
              newKey: {
                required: false,
                type: () => String,
                description: 'New attribute key.',
              },
            },
            UpdateIntegerAttributeDTO: {
              newKey: {
                required: false,
                type: () => String,
                description: 'New attribute key.',
              },
            },
            UpdateFloatAttributeDTO: {
              newKey: {
                required: false,
                type: () => String,
                description: 'New attribute key.',
              },
            },
            UpdateBooleanAttributeDTO: {
              newKey: {
                required: false,
                type: () => String,
                description: 'New attribute key.',
              },
            },
            UpdateDatetimeAttributeDTO: {
              newKey: {
                required: false,
                type: () => String,
                description: 'New attribute key.',
              },
            },
            UpdateRelationAttributeDTO: {
              newKey: {
                required: false,
                type: () => String,
                description: 'New attribute key.',
              },
            },
            AttributeParamsDTO: {
              key: {
                required: true,
                type: () => String,
                description: 'Attribute Key.',
              },
            },
          },
        ],
        [
          import('./schemas/collections/indexes/DTO/indexes.dto.js'),
          {
            CreateIndexDTO: {
              key: {
                required: true,
                type: () => String,
                description: 'Index Key.',
              },
              type: {
                required: true,
                description: 'Index type.',
                enum: t['@nuvix/db'].IndexType,
              },
              attributes: {
                required: true,
                type: () => [String],
                description: 'Array of attributes to index.',
              },
              orders: {
                required: true,
                type: () => [String],
                description: 'Array of index orders.',
                enum: t['@nuvix/db'].Order,
                isArray: true,
              },
            },
            IndexParamsDTO: {
              key: {
                required: true,
                type: () => String,
                description: 'Index Key.',
              },
            },
          },
        ],
      ],
      controllers: [
        [
          import('./app.controller.js'),
          { AppController: { main: {}, getFavicon: {} } },
        ],
        [
          import('./database/database.controller.js'),
          {
            DatabaseController: {
              getSchemas: {},
              createSchema: { type: Object },
              getSchema: { type: Object },
            },
          },
        ],
        [
          import('./avatars/avatars.controller.js'),
          { AvatarsController: { generateAvatar: {} } },
        ],
        [
          import('./users/users.controller.js'),
          {
            UsersController: {
              create: { type: Object },
              createWithArgon2: { type: Object },
              createWithBcrypt: { type: Object },
              createWithMd5: { type: Object },
              createWithSha: { type: Object },
              createWithPhpass: { type: Object },
              createWithScrypt: { type: Object },
              createWithScryptModified: { type: Object },
              findAll: {},
              getUsage: { type: Object },
              getIdentities: {},
              deleteIdentity: {},
              findOne: { type: Object },
              getPrefs: { type: Object },
              updatePrefs: { type: Object },
              updateStatus: { type: Object },
              updateLabels: { type: Object },
              updateName: { type: Object },
              updatePassword: { type: Object },
              updateEmail: { type: Object },
              updatePhone: { type: Object },
              createJwt: {},
              getMemberships: {},
              createToken: { type: Object },
              getLogs: {},
              verify: { type: Object },
              verifyPhone: { type: Object },
              remove: {},
            },
          },
        ],
        [
          import('./users/sessions/sessions.controller.js'),
          {
            SessionsController: {
              getSessions: {},
              createSession: { type: Object },
              deleteSessions: {},
              deleteSession: {},
            },
          },
        ],
        [
          import('./users/targets/targets.controller.js'),
          {
            TargetsController: {
              addTarget: { type: Object },
              getTargets: {},
              getTarget: { type: Object },
              updateTarget: { type: Object },
              deleteTarget: {},
            },
          },
        ],
        [
          import('./users/mfa/mfa.controller.js'),
          {
            MfaController: {
              updateMfa: { type: Object },
              getMfaFactors: { type: Object },
              getMfaRecoveryCodes: {},
              generateMfaRecoveryCodes: {},
              regenerateMfaRecoveryCodes: {},
              deleteMfaAuthenticator: {},
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
              getPrefs: { type: Object },
              updatePrefs: { type: Object },
              updateName: { type: Object },
              updatePassword: { type: Object },
              updateEmail: { type: Object },
              updatePhone: { type: Object },
              updateStatus: { type: Object },
              createEmailVerification: { type: Object },
              updateEmailVerification: { type: Object },
              createPhoneVerification: { type: Object },
              updatePhoneVerification: {},
            },
          },
        ],
        [
          import('./account/identities/identity.controller.js'),
          { IdentityController: { getIdentities: {}, deleteIdentity: {} } },
        ],
        [
          import('./account/mfa/mfa.controller.js'),
          {
            MfaController: {
              updateMfa: { type: Object },
              getMfaFactors: {},
              createMfaAuthenticator: {},
              verifyMfaAuthenticator: { type: Object },
              createMfaRecoveryCodes: {},
              updateMfaRecoveryCodes: {},
              getMfaRecoveryCodes: {},
              deleteMfaAuthenticator: {},
              createMfaChallenge: { type: Object },
              updateMfaChallenge: { type: Object },
            },
          },
        ],
        [
          import('./account/recovery/recovery.controller.js'),
          {
            RecoveryController: {
              createRecovery: { type: Object },
              updateRecovery: { type: Object },
            },
          },
        ],
        [
          import('./account/sessions/session.controller.js'),
          {
            SessionsController: {
              getSessions: {},
              deleteSessions: {},
              getSession: { type: Object },
              deleteSession: {},
              updateSession: { type: Object },
              createEmailSession: { type: Object },
              createAnonymousSession: { type: Object },
              createSession: { type: Object },
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
            },
          },
        ],
        [
          import('./account/targets/targets.controller.js'),
          {
            TargetsController: {
              createPushTarget: { type: Object },
              updatePushTarget: { type: Object },
              deletePushTarget: {},
            },
          },
        ],
        [
          import('./teams/teams.controller.js'),
          {
            TeamsController: {
              create: { type: Object },
              findAll: {},
              findOne: { type: Object },
              update: { type: Object },
              remove: {},
              getPrefs: { type: Object },
              setPrefs: { type: Object },
              teamLogs: {},
            },
          },
        ],
        [
          import('./teams/memberships/memberships.controller.js'),
          {
            MembershipsController: {
              addMember: { type: Object },
              getMembers: {},
              getMember: { type: Object },
              updateMember: { type: Object },
              updateMemberStatus: { type: Object },
              removeMember: {},
            },
          },
        ],
        [
          import('./storage/storage.controller.js'),
          {
            StorageController: {
              getBuckets: {},
              createBucket: { type: Object },
              getBucket: { type: Object },
              updateBucket: { type: Object },
              deleteBucket: {},
              getUsage: { type: Object },
              getBucketUsage: { type: Object },
            },
          },
        ],
        [
          import('./storage/files/files.controller.js'),
          {
            FilesController: {
              getFiles: {},
              createFile: { type: Object },
              getFile: { type: Object },
              previewFile: {},
              downloadFile: {},
              viewFile: {},
              getFileForPushNotification: {},
              updateFile: { type: Object },
              deleteFile: {},
            },
          },
        ],
        [
          import('./messaging/messaging.controller.js'),
          {
            MessagingController: {
              createEmail: { type: Object },
              createSms: { type: Object },
              createPush: { type: Object },
              listMessages: {},
              getMessage: { type: Object },
              listTargets: {},
              updateEmail: { type: Object },
              updateSms: { type: Object },
              updatePush: { type: Object },
              deleteMessage: {},
            },
          },
        ],
        [
          import('./messaging/providers/providers.controller.js'),
          {
            ProvidersController: {
              createMailgunProvider: { type: Object },
              createSendgridProvider: { type: Object },
              createSMTPProvider: { type: Object },
              createMsg91Provider: { type: Object },
              createTelesignProvider: { type: Object },
              createTextmagicProvider: { type: Object },
              createTwilioProvider: { type: Object },
              createVonageProvider: { type: Object },
              createFcmProvider: { type: Object },
              createApnsProvider: { type: Object },
              listProviders: {},
              getProvider: { type: Object },
              updateMailgunProvider: { type: Object },
              updateSendgridProvider: { type: Object },
              updateSmtpProvider: { type: Object },
              updateMsg91Provider: { type: Object },
              updateTelesignProvider: { type: Object },
              updateTextmagicProvider: { type: Object },
              updateTwilioProvider: { type: Object },
              updateVonageProvider: { type: Object },
              updateFcmProvider: { type: Object },
              updateApnsProvider: { type: Object },
              deleteProvider: {},
            },
          },
        ],
        [
          import('./messaging/topics/topics.controller.js'),
          {
            TopicsController: {
              createTopic: { type: Object },
              listTopics: {},
              getTopic: { type: Object },
              updateTopic: { type: Object },
              deleteTopic: {},
            },
          },
        ],
        [
          import('./messaging/topics/subscribers/subscribers.controller.js'),
          {
            SubscribersController: {
              createSubscriber: { type: Object },
              listSubscribers: {},
              getSubscriber: { type: Object },
              deleteSubscriber: {},
            },
          },
        ],
        [
          import('./schemas/schemas.controller.js'),
          {
            SchemasController: {
              queryTable: { type: Object },
              insertIntoTable: { type: Object },
              updateTables: { type: Object },
              upsertTable: {},
              deleteTables: { type: Object },
              callFunction: { type: Object },
              manageTablePermissions: { type: [String] },
              manageRowPermissions: { type: [String] },
              getTablePermissions: { type: [String] },
              getRowPermissions: { type: [String] },
            },
          },
        ],
        [
          import('./schemas/collections/collections.controller.js'),
          {
            CollectionsController: {
              findCollections: {},
              createCollection: { type: Object },
              findCollection: { type: Object },
              updateCollection: { type: Object },
              removeCollection: {},
              getCollectionUsage: { type: Object },
              findCollectionLogs: {},
            },
          },
        ],
        [
          import('./schemas/collections/documents/documents.controller.js'),
          {
            DocumentsController: {
              findDocuments: {},
              createDocument: {},
              findDocument: {},
              updateDocument: {},
              removeDocument: {},
              findDocumentLogs: {},
            },
          },
        ],
        [
          import('./schemas/collections/attributes/attributes.controller.js'),
          {
            AttributesController: {
              findAttributes: {},
              createStringAttribute: { type: Object },
              createEmailAttribute: { type: Object },
              createEnumAttribute: { type: Object },
              createIpAttribute: { type: Object },
              createUrlAttribute: { type: Object },
              createIntegerAttribute: { type: Object },
              createFloatAttribute: { type: Object },
              createBooleanAttribute: { type: Object },
              createDatetimeAttribute: { type: Object },
              createRelationAttribute: { type: Object },
              findAttribute: { type: Object },
              updateStringAttribute: { type: Object },
              updateEmailAttribute: { type: Object },
              updateEnumAttribute: { type: Object },
              updateIpAttribute: { type: Object },
              updateUrlAttribute: { type: Object },
              updateIntegerAttribute: { type: Object },
              updateFloatAttribute: { type: Object },
              updateBooleanAttribute: { type: Object },
              updateDatetimeAttribute: { type: Object },
              updateRelationAttribute: { type: Object },
              removeAttribute: {},
            },
          },
        ],
        [
          import('./schemas/collections/indexes/indexes.controller.js'),
          {
            IndexesController: {
              createIndex: { type: Object },
              findIndexes: {},
              findIndex: { type: Object },
              removeIndex: {},
            },
          },
        ],
        [
          import('./locale/locale.controller.js'),
          {
            LocaleController: {
              getUserLocale: { type: Object },
              getLocaleCodes: {},
              getCountries: {},
              getEuCountries: {},
              getCountriesPhone: {},
              getContinents: {},
              getCurrencies: {},
              getLanguages: {},
            },
          },
        ],
      ],
    },
  }
}
