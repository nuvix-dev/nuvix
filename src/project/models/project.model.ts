import { Exclude, Expose } from "class-transformer";
import { Document } from "mongoose";
import BaseModel, { BaseListModel } from "src/core/models/base.model";
import { AuthProviderModel } from "./authprovider.model";
import { PlatformModel } from "./platform.model";
import { WebhookModel } from "./webhook.model";
import { KeyModel } from "./key.model";

// @Exclude()
export class ProjectModel extends BaseModel {

  /**
   * Project name.
   */
  @Expose() name: string;
  /**
   * Project description.
   */
  @Expose() description: string;
  /**
   * Project team ID.
   */
  @Expose() teamId: string;
  /**
   * Project logo file ID.
   */
  @Expose() logo: string;
  /**
   * Project website URL.
   */
  @Expose() url: string;
  /**
   * Company legal name.
   */
  @Expose() legalName: string;
  /**
   * Country code in [ISO 3166-1](http://en.wikipedia.org/wiki/ISO_3166-1) two-character format.
   */
  @Expose() legalCountry: string;
  /**
   * State name.
   */
  @Expose() legalState: string;
  /**
   * City name.
   */
  @Expose() legalCity: string;
  /**
   * Company Address.
   */
  @Expose() legalAddress: string;
  /**
   * Company Tax ID.
   */
  @Expose() legalTaxId: string;
  /**
   * Session duration in seconds.
   */
  @Expose() authDuration: number;
  /**
   * Max users allowed. 0 is unlimited.
   */
  @Expose() authLimit: number;
  /**
   * Max sessions allowed per user. 100 maximum.
   */
  @Expose() authSessionsLimit: number;
  /**
   * Max allowed passwords in the history list per user. Max passwords limit allowed in history is 20. Use 0 for disabling password history.
   */
  @Expose() authPasswordHistory: number;
  /**
   * Whether or not to check user&#039;s password against most commonly used passwords.
   */
  @Expose() authPasswordDictionary: boolean;
  /**
   * Whether or not to check the user password for similarity with their personal data.
   */
  @Expose() authPersonalDataCheck: boolean;
  /**
   * An array of mock numbers and their corresponding verification codes (OTPs).
   */
  @Expose() authMockNumbers: MockNumberModel[];
  /**
   * Whether or not to send session alert emails to users.
   */
  @Expose() authSessionAlerts: boolean;
  /**
   * Whether or not to show user names in the teams membership response.
   */
  @Expose() authMembershipsUserName: boolean;
  /**
   * Whether or not to show user emails in the teams membership response.
   */
  @Expose() authMembershipsUserEmail: boolean;
  /**
   * Whether or not to show user MFA status in the teams membership response.
   */
  @Expose() authMembershipsMfa: boolean;
  /**
   * List of Auth Providers.
   */
  @Expose() oAuthProviders: AuthProviderModel[];
  /**
   * List of Platforms.
   */
  @Expose() platforms: PlatformModel[];
  /**
   * List of Webhooks.
   */
  @Expose() webhooks: WebhookModel[];
  /**
   * List of API Keys.
   */
  @Expose() keys: KeyModel[];
  /**
   * Status for custom SMTP
   */
  @Expose() smtpEnabled: boolean;
  /**
   * SMTP sender name
   */
  @Expose() smtpSenderName: string;
  /**
   * SMTP sender email
   */
  @Expose() smtpSenderEmail: string;
  /**
   * SMTP reply to email
   */
  @Expose() smtpReplyTo: string;
  /**
   * SMTP server host name
   */
  @Expose() smtpHost: string;
  /**
   * SMTP server port
   */
  @Expose() smtpPort: number;
  /**
   * SMTP server username
   */
  @Expose() smtpUsername: string;
  /**
   * SMTP server password
   */
  @Expose() smtpPassword: string;
  /**
   * SMTP server secure protocol
   */
  @Expose() smtpSecure: string;
  /**
   * Number of times the ping was received for this project.
   */
  @Expose() pingCount: number;
  /**
   * Last ping datetime in ISO 8601 format.
   */
  @Expose() pingedAt: string;
  /**
   * Email/Password auth method status
   */
  @Expose() authEmailPassword: boolean;
  /**
   * Magic URL auth method status
   */
  @Expose() authUsersAuthMagicURL: boolean;
  /**
   * Email (OTP) auth method status
   */
  @Expose() authEmailOtp: boolean;
  /**
   * Anonymous auth method status
   */
  @Expose() authAnonymous: boolean;
  /**
   * Invites auth method status
   */
  @Expose() authInvites: boolean;
  /**
   * JWT auth method status
   */
  @Expose() authJWT: boolean;
  /**
   * Phone auth method status
   */
  @Expose() authPhone: boolean;
  /**
   * Account service status
   */
  @Expose() serviceStatusForAccount: boolean;
  /**
   * Avatars service status
   */
  @Expose() serviceStatusForAvatars: boolean;
  /**
   * Databases service status
   */
  @Expose() serviceStatusForDatabases: boolean;
  /**
   * Locale service status
   */
  @Expose() serviceStatusForLocale: boolean;
  /**
   * Health service status
   */
  @Expose() serviceStatusForHealth: boolean;
  /**
   * Storage service status
   */
  @Expose() serviceStatusForStorage: boolean;
  /**
   * Teams service status
   */
  @Expose() serviceStatusForTeams: boolean;
  /**
   * Users service status
   */
  @Expose() serviceStatusForUsers: boolean;
  /**
   * Functions service status
   */
  @Expose() serviceStatusForFunctions: boolean;
  /**
   * GraphQL service status
   */
  @Expose() serviceStatusForGraphql: boolean;
  /**
   * Messaging service status
   */
  @Expose() serviceStatusForMessaging: boolean;
  /**
   * Project region
   */
  @Expose() region: string;

  constructor(partial: Partial<ProjectModel> | Document) {
    super(partial);
  }
}

@Exclude()
class MockNumberModel {
  /**
   * Mock phone number for testing phone authentication. Useful for testing phone authentication without sending an SMS.
   */
  @Expose() phone: string;
  /**
   * Mock OTP for the number. 
   */
  @Expose() otp: string;
}

export class ProjectListModel extends BaseListModel {

  projects: ProjectModel[];

  constructor(partial: Partial<ProjectListModel | { projects: Document[] | { [key: string]: string }[] }>) {
    super();
    if (partial.projects) {
      this.projects = (partial.projects as Document[]).map((projects) => new ProjectModel(projects));
    }
    Object.assign(this, { ...partial, projects: this.projects });
  }
}