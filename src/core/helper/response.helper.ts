import { AccountModel } from "../models/Account.model";
import { AlgoArgon2Model } from "../models/AlgoArgon2.model";
import { AlgoBcryptModel } from "../models/AlgoBcrypt.model";
import { AlgoMd5Model } from "../models/AlgoMd5.model";
import { AttributeModel } from "../models/Attribute.model";
import { AuthProviderModel } from "../models/AuthProvider.model";
import { BucketModel } from "../models/Bucket.model";
import { BuildModel } from "../models/Build.model";
import { CollectionModel } from "../models/Collection.model";
import { ContinentModel } from "../models/Continent.model";
import { CountryModel } from "../models/Country.model";
import { CurrencyModel } from "../models/Currency.model";
import { DatabaseModel } from "../models/Database.model";
import { DeploymentModel } from "../models/Deployment.model";
import { DetectionModel } from "../models/Detection.model";
import { DocumentModel } from "../models/Document.model";
import { ExecutionModel } from "../models/Execution.model";
import { FileModel } from "../models/File.model";
import { FunctionModel } from "../models/Func.model";
import { HeadersModel } from "../models/Headers.model";
import { IdentityModel } from "../models/Identity.model";
import { IndexModel } from "../models/Index.model";
import { InstallationModel } from "../models/Installation.model";
import { JWTModel } from "../models/JWT.model";
import { LanguageModel } from "../models/Language.model";
import { LocaleModel } from "../models/Locale.model";
import { LocaleCodeModel } from "../models/LocaleCode.model";
import { LogModel } from "../models/Log.model";
import { MembershipModel } from "../models/Membership.model";
import { MessageModel } from "../models/Message.model";
import { MetricModel } from "../models/Metric.model";
import { MetricBreakdownModel } from "../models/MetricBreakdown.model";
import { MFAChallengeModel } from "../models/MFAChallenge.model";
import { MFAFactorsModel } from "../models/MFAFactors.model";
import { MFARecoveryCodesModel } from "../models/MFARecoveryCodes.model";
import { MFATypeModel } from "../models/MFAType.model";
import { MigrationModel } from "../models/Migration.model";
import { MigrationFirebaseProjectModel } from "../models/MigrationFirebaseProject.model";
import { MigrationReportModel } from "../models/MigrationReport.model";
import { MockNumberModel } from "../models/MockNumber.model";
import { PhoneModel } from "../models/Phone.model";
import { PlatformModel } from "../models/Platform.model";
import { ProviderModel } from "../models/Provider.model";
import { RuleModel } from "../models/Rule.model";
import { RuntimeModel } from "../models/Runtime.model";
import { SessionModel } from "../models/Session.model";
import { SpecificationModel } from "../models/Specification.model";
import { SubscriberModel } from "../models/Subscriber.model";
import { TargetModel } from "../models/Target.model";
import { TeamModel } from "../models/Team.model";
import { TemplateEmailModel } from "../models/TemplateEmail.model";
import { TemplateFunctionModel } from "../models/TemplateFunction.model";
import { TemplateRuntimeModel } from "../models/TemplateRuntime.model";
import { TemplateSMSModel } from "../models/TemplateSMS.model";
import { TokenModel } from "../models/Token.model";
import { TopicModel } from "../models/Topic.model";
import { UserModel } from "../models/User.model";
import { VariableModel } from "../models/Variable.model";
import { VcsContentModel } from "../models/VcsContent.model";
import { WebhookModel } from "../models/Webhook.model";
import { AlgoPhpassModel, AlgoScryptModel, AlgoScryptModifiedModel, AlgoShaModel } from "../models/OtherAlgos.model";
import { HealthAntivirusModel, HealthCertificateModel, HealthQueueModel, HealthStatusModel, HealthTimeModel, HealthVersionModel } from "../models/Health.model";
import { UsageBucketsModel, UsageCollectionModel, UsageDatabaseModel, UsageDatabasesModel, UsageFunctionModel, UsageFunctionsModel, UsageProjectModel, UsageStorageModel, UsageUsersModel } from "../models/Usage.model";
import { AttributeBooleanModel, AttributeDatetimeModel, AttributeEmailModel, AttributeEnumModel, AttributeFloatModel, AttributeIntegerModel, AttributeIPModel, AttributeRelationshipModel, AttributeStringModel, AttributeURLModel } from "../models/Attributes.model";


/**
 * The `Response` class provides a collection of static properties representing various models used in the application.
 * These models are categorized into different sections such as Database, Users, MFA, Storage, Locale, Messaging, Teams, VCS, Functions, Proxy, Migrations, Project, and Health.
 * Each static property holds a reference to a specific model class or a string identifier.
 * 
 * ## Models
 * 
 * ### General
 * - `MODEL_NONE`: Represents no model.
 * - `MODEL_ANY`: Represents any model.
 * - `MODEL_LOG`: Represents the `LogModel`.
 * - `MODEL_ERROR`: Represents an error model.
 * - `MODEL_METRIC`: Represents the `MetricModel`.
 * - `MODEL_METRIC_BREAKDOWN`: Represents the `MetricBreakdownModel`.
 * - `MODEL_ERROR_DEV`: Represents a development error model.
 * - `MODEL_USAGE_DATABASES`: Represents the `UsageDatabasesModel`.
 * - `MODEL_USAGE_DATABASE`: Represents the `UsageDatabaseModel`.
 * - `MODEL_USAGE_COLLECTION`: Represents the `UsageCollectionModel`.
 * - `MODEL_USAGE_USERS`: Represents the `UsageUsersModel`.
 * - `MODEL_USAGE_BUCKETS`: Represents the `UsageBucketsModel`.
 * - `MODEL_USAGE_STORAGE`: Represents the `UsageStorageModel`.
 * - `MODEL_USAGE_FUNCTIONS`: Represents the `UsageFunctionsModel`.
 * - `MODEL_USAGE_FUNCTION`: Represents the `UsageFunctionModel`.
 * - `MODEL_USAGE_PROJECT`: Represents the `UsageProjectModel`.
 * 
 * ### Database
 * - `MODEL_DATABASE`: Represents the `DatabaseModel`.
 * - `MODEL_COLLECTION`: Represents the `CollectionModel`.
 * - `MODEL_INDEX`: Represents the `IndexModel`.
 * - `MODEL_DOCUMENT`: Represents the `DocumentModel`.
 * 
 * ### Database Attributes
 * - `MODEL_ATTRIBUTE`: Represents the `AttributeModel`.
 * - `MODEL_ATTRIBUTE_STRING`: Represents the `AttributeStringModel`.
 * - `MODEL_ATTRIBUTE_INTEGER`: Represents the `AttributeIntegerModel`.
 * - `MODEL_ATTRIBUTE_FLOAT`: Represents the `AttributeFloatModel`.
 * - `MODEL_ATTRIBUTE_BOOLEAN`: Represents the `AttributeBooleanModel`.
 * - `MODEL_ATTRIBUTE_EMAIL`: Represents the `AttributeEmailModel`.
 * - `MODEL_ATTRIBUTE_ENUM`: Represents the `AttributeEnumModel`.
 * - `MODEL_ATTRIBUTE_IP`: Represents the `AttributeIPModel`.
 * - `MODEL_ATTRIBUTE_URL`: Represents the `AttributeURLModel`.
 * - `MODEL_ATTRIBUTE_DATETIME`: Represents the `AttributeDatetimeModel`.
 * - `MODEL_ATTRIBUTE_RELATIONSHIP`: Represents the `AttributeRelationshipModel`.
 * 
 * ### Users
 * - `MODEL_ACCOUNT`: Represents the `AccountModel`.
 * - `MODEL_USER`: Represents the `UserModel`.
 * - `MODEL_SESSION`: Represents the `SessionModel`.
 * - `MODEL_IDENTITY`: Represents the `IdentityModel`.
 * - `MODEL_TOKEN`: Represents the `TokenModel`.
 * - `MODEL_JWT`: Represents the `JWTModel`.
 * - `MODEL_PREFERENCES`: Represents user preferences.
 * 
 * ### MFA (Multi-Factor Authentication)
 * - `MODEL_MFA_TYPE`: Represents the `MFATypeModel`.
 * - `MODEL_MFA_FACTORS`: Represents the `MFAFactorsModel`.
 * - `MODEL_MFA_OTP`: Represents the OTP (One-Time Password) model.
 * - `MODEL_MFA_CHALLENGE`: Represents the `MFAChallengeModel`.
 * - `MODEL_MFA_RECOVERY_CODES`: Represents the `MFARecoveryCodesModel`.
 * 
 * ### Users Password Algorithms
 * - `MODEL_ALGO_MD5`: Represents the `AlgoMd5Model`.
 * - `MODEL_ALGO_SHA`: Represents the `AlgoShaModel`.
 * - `MODEL_ALGO_SCRYPT`: Represents the `AlgoScryptModel`.
 * - `MODEL_ALGO_SCRYPT_MODIFIED`: Represents the `AlgoScryptModifiedModel`.
 * - `MODEL_ALGO_BCRYPT`: Represents the `AlgoBcryptModel`.
 * - `MODEL_ALGO_ARGON2`: Represents the `AlgoArgon2Model`.
 * - `MODEL_ALGO_PHPASS`: Represents the `AlgoPhpassModel`.
 * 
 * ### Storage
 * - `MODEL_FILE`: Represents the `FileModel`.
 * - `MODEL_BUCKET`: Represents the `BucketModel`.
 * 
 * ### Locale
 * - `MODEL_LOCALE`: Represents the `LocaleModel`.
 * - `MODEL_LOCALE_CODE`: Represents the `LocaleCodeModel`.
 * - `MODEL_COUNTRY`: Represents the `CountryModel`.
 * - `MODEL_CONTINENT`: Represents the `ContinentModel`.
 * - `MODEL_CURRENCY`: Represents the `CurrencyModel`.
 * - `MODEL_LANGUAGE`: Represents the `LanguageModel`.
 * - `MODEL_PHONE`: Represents the `PhoneModel`.
 * 
 * ### Messaging
 * - `MODEL_PROVIDER`: Represents the `ProviderModel`.
 * - `MODEL_MESSAGE`: Represents the `MessageModel`.
 * - `MODEL_TOPIC`: Represents the `TopicModel`.
 * - `MODEL_SUBSCRIBER`: Represents the `SubscriberModel`.
 * - `MODEL_TARGET`: Represents the `TargetModel`.
 * 
 * ### Teams
 * - `MODEL_TEAM`: Represents the `TeamModel`.
 * - `MODEL_MEMBERSHIP`: Represents the `MembershipModel`.
 * 
 * ### VCS (Version Control System)
 * - `MODEL_INSTALLATION`: Represents the `InstallationModel`.
 * - `MODEL_PROVIDER_REPOSITORY`: Represents the `ProviderModel`.
 * - `MODEL_BRANCH`: Represents a branch model.
 * - `MODEL_DETECTION`: Represents the `DetectionModel`.
 * - `MODEL_VCS_CONTENT`: Represents the `VcsContentModel`.
 * 
 * ### Functions
 * - `MODEL_FUNCTION`: Represents the `FunctionModel`.
 * - `MODEL_RUNTIME`: Represents the `RuntimeModel`.
 * - `MODEL_DEPLOYMENT`: Represents the `DeploymentModel`.
 * - `MODEL_EXECUTION`: Represents the `ExecutionModel`.
 * - `MODEL_BUILD`: Represents the `BuildModel`.
 * - `MODEL_FUNC_PERMISSIONS`: Represents function permissions.
 * - `MODEL_HEADERS`: Represents the `HeadersModel`.
 * - `MODEL_SPECIFICATION`: Represents the `SpecificationModel`.
 * - `MODEL_TEMPLATE_FUNCTION`: Represents the `TemplateFunctionModel`.
 * - `MODEL_TEMPLATE_RUNTIME`: Represents the `TemplateRuntimeModel`.
 * - `MODEL_TEMPLATE_VARIABLE`: Represents the `TemplateRuntimeModel`.
 * 
 * ### Proxy
 * - `MODEL_PROXY_RULE`: Represents the `RuleModel`.
 * 
 * ### Migrations
 * - `MODEL_MIGRATION`: Represents the `MigrationModel`.
 * - `MODEL_MIGRATION_REPORT`: Represents the `MigrationReportModel`.
 * - `MODEL_MIGRATION_FIREBASE_PROJECT`: Represents the `MigrationFirebaseProjectModel`.
 * 
 * ### Project
 * - `MODEL_PROJECT`: Represents a project model.
 * - `MODEL_WEBHOOK`: Represents the `WebhookModel`.
 * - `MODEL_KEY`: Represents a key model.
 * - `MODEL_MOCK_NUMBER`: Represents the `MockNumberModel`.
 * - `MODEL_AUTH_PROVIDER`: Represents the `AuthProviderModel`.
 * - `MODEL_PLATFORM`: Represents the `PlatformModel`.
 * - `MODEL_VARIABLE`: Represents the `VariableModel`.
 * - `MODEL_VCS`: Represents a VCS model.
 * - `MODEL_SMS_TEMPLATE`: Represents the `TemplateSMSModel`.
 * - `MODEL_EMAIL_TEMPLATE`: Represents the `TemplateEmailModel`.
 * 
 * ### Health
 * - `MODEL_HEALTH_STATUS`: Represents the `HealthStatusModel`.
 * - `MODEL_HEALTH_VERSION`: Represents the `HealthVersionModel`.
 * - `MODEL_HEALTH_QUEUE`: Represents the `HealthQueueModel`.
 * - `MODEL_HEALTH_TIME`: Represents the `HealthTimeModel`.
 * - `MODEL_HEALTH_ANTIVIRUS`: Represents the `HealthAntivirusModel`.
 * - `MODEL_HEALTH_CERTIFICATE`: Represents the `HealthCertificateModel`.
 */
export class Response {

  public static MODEL_NONE = 'none';
  public static MODEL_ANY = 'any';
  public static MODEL_LOG = LogModel;
  public static MODEL_ERROR = 'error';
  public static MODEL_METRIC = MetricModel;
  public static MODEL_METRIC_BREAKDOWN = MetricBreakdownModel;
  public static MODEL_ERROR_DEV = 'errorDev';
  public static MODEL_USAGE_DATABASES = UsageDatabasesModel;
  public static MODEL_USAGE_DATABASE = UsageDatabaseModel;
  public static MODEL_USAGE_COLLECTION = UsageCollectionModel;
  public static MODEL_USAGE_USERS = UsageUsersModel;
  public static MODEL_USAGE_BUCKETS = UsageBucketsModel;
  public static MODEL_USAGE_STORAGE = UsageStorageModel;
  public static MODEL_USAGE_FUNCTIONS = UsageFunctionsModel;
  public static MODEL_USAGE_FUNCTION = UsageFunctionModel;
  public static MODEL_USAGE_PROJECT = UsageProjectModel;

  // Database
  public static MODEL_DATABASE = DatabaseModel;
  public static MODEL_COLLECTION = CollectionModel;
  public static MODEL_INDEX = IndexModel;
  public static MODEL_DOCUMENT = DocumentModel;

  // Database Attributes
  public static MODEL_ATTRIBUTE = AttributeModel;
  public static MODEL_ATTRIBUTE_STRING = AttributeStringModel;
  public static MODEL_ATTRIBUTE_INTEGER = AttributeIntegerModel;
  public static MODEL_ATTRIBUTE_FLOAT = AttributeFloatModel;
  public static MODEL_ATTRIBUTE_BOOLEAN = AttributeBooleanModel;
  public static MODEL_ATTRIBUTE_EMAIL = AttributeEmailModel;
  public static MODEL_ATTRIBUTE_ENUM = AttributeEnumModel;
  public static MODEL_ATTRIBUTE_IP = AttributeIPModel;
  public static MODEL_ATTRIBUTE_URL = AttributeURLModel;
  public static MODEL_ATTRIBUTE_DATETIME = AttributeDatetimeModel;
  public static MODEL_ATTRIBUTE_RELATIONSHIP = AttributeRelationshipModel;

  // Users
  public static MODEL_ACCOUNT = AccountModel;
  public static MODEL_USER = UserModel;
  public static MODEL_SESSION = SessionModel;
  public static MODEL_IDENTITY = IdentityModel;
  public static MODEL_TOKEN = TokenModel;
  public static MODEL_JWT = JWTModel;
  public static MODEL_PREFERENCES = 'preferences';

  // MFA
  public static MODEL_MFA_TYPE = MFATypeModel;
  public static MODEL_MFA_FACTORS = MFAFactorsModel;
  public static MODEL_MFA_OTP = 'mfaTotp';
  public static MODEL_MFA_CHALLENGE = MFAChallengeModel;
  public static MODEL_MFA_RECOVERY_CODES = MFARecoveryCodesModel;

  // Users password algos
  public static MODEL_ALGO_MD5 = AlgoMd5Model;
  public static MODEL_ALGO_SHA = AlgoShaModel;
  public static MODEL_ALGO_SCRYPT = AlgoScryptModel;
  public static MODEL_ALGO_SCRYPT_MODIFIED = AlgoScryptModifiedModel;
  public static MODEL_ALGO_BCRYPT = AlgoBcryptModel;
  public static MODEL_ALGO_ARGON2 = AlgoArgon2Model;
  public static MODEL_ALGO_PHPASS = AlgoPhpassModel;

  // Storage
  public static MODEL_FILE = FileModel;
  public static MODEL_BUCKET = BucketModel;

  // Locale
  public static MODEL_LOCALE = LocaleModel;
  public static MODEL_LOCALE_CODE = LocaleCodeModel;
  public static MODEL_COUNTRY = CountryModel;
  public static MODEL_CONTINENT = ContinentModel;
  public static MODEL_CURRENCY = CurrencyModel;
  public static MODEL_LANGUAGE = LanguageModel;
  public static MODEL_PHONE = PhoneModel;

  // Messaging
  public static MODEL_PROVIDER = ProviderModel;
  public static MODEL_MESSAGE = MessageModel;
  public static MODEL_TOPIC = TopicModel;
  public static MODEL_SUBSCRIBER = SubscriberModel;
  public static MODEL_TARGET = TargetModel;

  // Teams
  public static MODEL_TEAM = TeamModel;
  public static MODEL_MEMBERSHIP = MembershipModel;

  // VCS
  public static MODEL_INSTALLATION = InstallationModel;
  public static MODEL_PROVIDER_REPOSITORY = ProviderModel;
  public static MODEL_BRANCH = 'branch';
  public static MODEL_DETECTION = DetectionModel;
  public static MODEL_VCS_CONTENT = VcsContentModel;

  // Functions
  public static MODEL_FUNCTION = FunctionModel;
  public static MODEL_RUNTIME = RuntimeModel;
  public static MODEL_DEPLOYMENT = DeploymentModel;
  public static MODEL_EXECUTION = ExecutionModel;
  public static MODEL_BUILD = BuildModel;  // Not used anywhere yet
  public static MODEL_FUNC_PERMISSIONS = 'funcPermissions';
  public static MODEL_HEADERS = HeadersModel;
  public static MODEL_SPECIFICATION = SpecificationModel;
  public static MODEL_TEMPLATE_FUNCTION = TemplateFunctionModel;
  public static MODEL_TEMPLATE_RUNTIME = TemplateRuntimeModel;
  public static MODEL_TEMPLATE_VARIABLE = TemplateRuntimeModel;

  // Proxy
  public static MODEL_PROXY_RULE = RuleModel;

  // Migrations
  public static MODEL_MIGRATION = MigrationModel;
  public static MODEL_MIGRATION_REPORT = MigrationReportModel;
  public static MODEL_MIGRATION_FIREBASE_PROJECT = MigrationFirebaseProjectModel;

  // Project
  public static MODEL_PROJECT = 'project';
  public static MODEL_WEBHOOK = WebhookModel;
  public static MODEL_KEY = 'key';
  public static MODEL_MOCK_NUMBER = MockNumberModel;
  public static MODEL_AUTH_PROVIDER = AuthProviderModel;
  public static MODEL_PLATFORM = PlatformModel;
  public static MODEL_VARIABLE = VariableModel;
  public static MODEL_VCS = 'vcs';
  public static MODEL_SMS_TEMPLATE = TemplateSMSModel;
  public static MODEL_EMAIL_TEMPLATE = TemplateEmailModel;

  // Health
  public static MODEL_HEALTH_STATUS = HealthStatusModel;
  public static MODEL_HEALTH_VERSION = HealthVersionModel;
  public static MODEL_HEALTH_QUEUE = HealthQueueModel;
  public static MODEL_HEALTH_TIME = HealthTimeModel;
  public static MODEL_HEALTH_ANTIVIRUS = HealthAntivirusModel;
  public static MODEL_HEALTH_CERTIFICATE = HealthCertificateModel;


}