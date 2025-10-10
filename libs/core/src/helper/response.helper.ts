import { AccountModel } from '../models/Account.model'
import { AlgoArgon2Model } from '../models/AlgoArgon2.model'
import { AlgoBcryptModel } from '../models/AlgoBcrypt.model'
import { AlgoMd5Model } from '../models/AlgoMd5.model'
import { AttributeModel } from '../models/Attribute.model'
import { AuthProviderModel } from '../models/AuthProvider.model'
import { BucketModel } from '../models/Bucket.model'
import { BuildModel } from '../models/Build.model'
import { CollectionModel } from '../models/Collection.model'
import { ContinentModel } from '../models/Continent.model'
import { CountryModel } from '../models/Country.model'
import { CurrencyModel } from '../models/Currency.model'
import { DatabaseModel } from '../models/Database.model'
import { DeploymentModel } from '../models/Deployment.model'
import { DetectionModel } from '../models/Detection.model'
import { DocumentModel } from '../models/Document.model'
import { ExecutionModel } from '../models/Execution.model'
import { FileModel } from '../models/File.model'
import { FunctionModel } from '../models/Func.model'
import { HeadersModel } from '../models/Headers.model'
import { IdentityModel } from '../models/Identity.model'
import { IndexModel } from '../models/Index.model'
import { InstallationModel } from '../models/Installation.model'
import { JWTModel } from '../models/JWT.model'
import { LanguageModel } from '../models/Language.model'
import { LocaleModel } from '../models/Locale.model'
import { LocaleCodeModel } from '../models/LocaleCode.model'
import { LogModel } from '../models/Log.model'
import { MembershipModel } from '../models/Membership.model'
import { MessageModel } from '../models/Message.model'
import { MetricModel } from '../models/Metric.model'
import { MetricBreakdownModel } from '../models/MetricBreakdown.model'
import { MFAChallengeModel } from '../models/MFAChallenge.model'
import { MFAFactorsModel } from '../models/MFAFactors.model'
import { MFARecoveryCodesModel } from '../models/MFARecoveryCodes.model'
import { MFATypeModel } from '../models/MFAType.model'
import { MigrationModel } from '../models/Migration.model'
import { MigrationFirebaseProjectModel } from '../models/MigrationFirebaseProject.model'
import { MigrationReportModel } from '../models/MigrationReport.model'
import { MockNumberModel } from '../models/MockNumber.model'
import { PhoneModel } from '../models/Phone.model'
import { PlatformModel } from '../models/Platform.model'
import { ProviderModel } from '../models/Provider.model'
import { RuleModel } from '../models/Rule.model'
import { RuntimeModel } from '../models/Runtime.model'
import { SessionModel } from '../models/Session.model'
import { SpecificationModel } from '../models/Specification.model'
import { SubscriberModel } from '../models/Subscriber.model'
import { TargetModel } from '../models/Target.model'
import { TeamModel } from '../models/Team.model'
import { TemplateEmailModel } from '../models/TemplateEmail.model'
import { TemplateFunctionModel } from '../models/TemplateFunction.model'
import { TemplateRuntimeModel } from '../models/TemplateRuntime.model'
import { TemplateSMSModel } from '../models/TemplateSMS.model'
import { TokenModel } from '../models/Token.model'
import { TopicModel } from '../models/Topic.model'
import { UserModel } from '../models/User.model'
import { VariableModel } from '../models/Variable.model'
import { VcsContentModel } from '../models/VcsContent.model'
import { WebhookModel } from '../models/Webhook.model'
import {
  AlgoPhpassModel,
  AlgoScryptModel,
  AlgoScryptModifiedModel,
  AlgoShaModel,
} from '../models/OtherAlgos.model'
import {
  HealthAntivirusModel,
  HealthCertificateModel,
  HealthQueueModel,
  HealthStatusModel,
  HealthTimeModel,
  HealthVersionModel,
} from '../models/Health.model'
import {
  UsageBucketsModel,
  UsageCollectionModel,
  UsageDatabaseModel,
  UsageDatabasesModel,
  UsageFunctionModel,
  UsageFunctionsModel,
  UsageProjectModel,
  UsageStorageModel,
  UsageUsersModel,
} from '../models/Usage.model'
import {
  AttributeBooleanModel,
  AttributeDatetimeModel,
  AttributeEmailModel,
  AttributeEnumModel,
  AttributeFloatModel,
  AttributeIntegerModel,
  AttributeIPModel,
  AttributeRelationshipModel,
  AttributeStringModel,
  AttributeURLModel,
} from '../models/Attributes.model'
import { OrganizationModel } from '../models/Organization.model'
import { BillingAddressModel } from '../models/BillingAddress.model'
import { InvoiceModel } from '../models/Invoice.model'
import { PaymentMethodModel } from '../models/PaymentMethod.model'
import { BillingPlanModel } from '../models/Plan.model'
import { KeyModel } from '../models/Key.model'
import { ProjectModel } from '../models/Project.model'
import { SchemaModel } from '../models/Schema.model'
import { ObjectModel } from '../models/Object.model'
import { EnvToken } from '../models/EnvToken.model'

/**
 * The `Models` class provides a collection of static properties representing various models used in the application.
 * These models are categorized into different sections such as Database, Users, MFA, Storage, Locale, Messaging, Teams, VCS, Functions, Proxy, Migrations, Project, and Health.
 * Each static property holds a reference to a specific model class or a string identifier.
 */
export class Models {
  public static NONE = class {}
  public static ANY = class {}
  public static LOG = LogModel
  public static METRIC = MetricModel
  public static METRIC_BREAKDOWN = MetricBreakdownModel
  public static USAGE_DATABASES = UsageDatabasesModel
  public static USAGE_DATABASE = UsageDatabaseModel
  public static USAGE_COLLECTION = UsageCollectionModel
  public static USAGE_USERS = UsageUsersModel
  public static USAGE_BUCKETS = UsageBucketsModel
  public static USAGE_STORAGE = UsageStorageModel
  public static USAGE_FUNCTIONS = UsageFunctionsModel
  public static USAGE_FUNCTION = UsageFunctionModel
  public static USAGE_PROJECT = UsageProjectModel

  // Database
  public static DATABASE = DatabaseModel
  public static COLLECTION = CollectionModel
  public static INDEX = IndexModel
  public static DOCUMENT = DocumentModel

  // Database Attributes
  public static ATTRIBUTE = AttributeModel
  public static ATTRIBUTE_STRING = AttributeStringModel
  public static ATTRIBUTE_INTEGER = AttributeIntegerModel
  public static ATTRIBUTE_FLOAT = AttributeFloatModel
  public static ATTRIBUTE_BOOLEAN = AttributeBooleanModel
  public static ATTRIBUTE_EMAIL = AttributeEmailModel
  public static ATTRIBUTE_ENUM = AttributeEnumModel
  public static ATTRIBUTE_IP = AttributeIPModel
  public static ATTRIBUTE_URL = AttributeURLModel
  public static ATTRIBUTE_DATETIME = AttributeDatetimeModel
  public static ATTRIBUTE_RELATIONSHIP = AttributeRelationshipModel

  // Users
  public static ACCOUNT = AccountModel
  public static USER = UserModel
  public static SESSION = SessionModel
  public static IDENTITY = IdentityModel
  public static TOKEN = TokenModel
  public static JWT = JWTModel
  public static PREFERENCES = class {
    [key: string]: any
  }

  // MFA
  public static MFA_TYPE = MFATypeModel
  public static MFA_FACTORS = MFAFactorsModel
  /**@deprecated Not Implemented */
  public static MFA_OTP = 'mfaTotp'
  public static MFA_CHALLENGE = MFAChallengeModel
  public static MFA_RECOVERY_CODES = MFARecoveryCodesModel

  // Users password algos
  public static ALGO_MD5 = AlgoMd5Model
  public static ALGO_SHA = AlgoShaModel
  public static ALGO_SCRYPT = AlgoScryptModel
  public static ALGO_SCRYPT_MODIFIED = AlgoScryptModifiedModel
  public static ALGO_BCRYPT = AlgoBcryptModel
  public static ALGO_ARGON2 = AlgoArgon2Model
  public static ALGO_PHPASS = AlgoPhpassModel

  // Storage
  public static FILE = FileModel
  public static BUCKET = BucketModel
  public static OBJECT = ObjectModel

  // Locale
  public static LOCALE = LocaleModel
  public static LOCALE_CODE = LocaleCodeModel
  public static COUNTRY = CountryModel
  public static CONTINENT = ContinentModel
  public static CURRENCY = CurrencyModel
  public static LANGUAGE = LanguageModel
  public static PHONE = PhoneModel

  // Messaging
  public static PROVIDER = ProviderModel
  public static MESSAGE = MessageModel
  public static TOPIC = TopicModel
  public static SUBSCRIBER = SubscriberModel
  public static TARGET = TargetModel

  // Teams
  public static TEAM = TeamModel
  public static MEMBERSHIP = MembershipModel

  // VCS
  public static INSTALLATION = InstallationModel
  public static PROVIDER_REPOSITORY = ProviderModel
  public static BRANCH = 'branch'
  public static DETECTION = DetectionModel
  public static VCS_CONTENT = VcsContentModel

  // Functions
  public static FUNCTION = FunctionModel
  public static RUNTIME = RuntimeModel
  public static DEPLOYMENT = DeploymentModel
  public static EXECUTION = ExecutionModel
  public static BUILD = BuildModel // Not used anywhere yet
  public static FUNC_PERMISSIONS = 'funcPermissions'
  public static HEADERS = HeadersModel
  public static SPECIFICATION = SpecificationModel
  public static TEMPLATE_FUNCTION = TemplateFunctionModel
  public static TEMPLATE_RUNTIME = TemplateRuntimeModel
  public static TEMPLATE_VARIABLE = TemplateRuntimeModel

  // Proxy
  public static PROXY_RULE = RuleModel

  // Migrations
  public static MIGRATION = MigrationModel
  public static MIGRATION_REPORT = MigrationReportModel
  public static MIGRATION_FIREBASE_PROJECT = MigrationFirebaseProjectModel

  // Project
  public static PROJECT = ProjectModel //'project'
  public static WEBHOOK = WebhookModel
  public static KEY = KeyModel
  public static MOCK_NUMBER = MockNumberModel
  public static AUTH_PROVIDER = AuthProviderModel
  public static PLATFORM = PlatformModel
  public static VARIABLE = VariableModel
  public static VCS = 'vcs'
  public static SMS_TEMPLATE = TemplateSMSModel
  public static EMAIL_TEMPLATE = TemplateEmailModel
  public static ENV_TOKEN = EnvToken

  // Health
  public static HEALTH_STATUS = HealthStatusModel
  public static HEALTH_VERSION = HealthVersionModel
  public static HEALTH_QUEUE = HealthQueueModel
  public static HEALTH_TIME = HealthTimeModel
  public static HEALTH_ANTIVIRUS = HealthAntivirusModel
  public static HEALTH_CERTIFICATE = HealthCertificateModel

  // Organization
  public static ORGANIZATION = OrganizationModel

  public static BILLING_ADDRESS = BillingAddressModel
  public static INVOICE = InvoiceModel
  public static PAYMENT_METHOD = PaymentMethodModel
  public static BILLING_PLAN = BillingPlanModel

  // Schema
  public static SCHEMA = SchemaModel

  public empty() {
    return Models.NONE
  }
}
