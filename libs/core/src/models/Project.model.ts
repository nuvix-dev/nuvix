import { Permission } from '@nuvix-tech/db';
import { AuthProviderModel } from './AuthProvider.model';
import BaseModel from './base.model';
import { MockNumberModel } from './MockNumber.model';
import { PlatformModel } from './Platform.model';
import { WebhookModel } from './Webhook.model';
import { Exclude, Expose, Transform } from 'class-transformer';
import { KeyModel } from './Key.model';

@Exclude()
export class ProjectModel extends BaseModel {
  @Expose({ toClassOnly: true }) auths: any;
  @Expose({ toClassOnly: true }) services: any;
  @Expose({ toClassOnly: true }) smtp: any;

  @Exclude() declare $permissions: string[] | Permission[];
  /**
   * Project name.
   */
  @Expose() declare name: string;
  /**
   * Project description.
   */
  @Expose() declare description: string;
  /**
   * Project team ID.
   */
  @Expose() declare teamId: string;
  /**
   * Project logo file ID.
   */
  @Expose() declare logo: string;
  /**
   * Project website URL.
   */
  @Expose() declare url: string;
  /**
   * Session duration in seconds.
   */
  @Expose()
  get authDuration(): number {
    return this.auths?.duration ?? 0;
  }
  /**
   * Max users allowed. 0 is unlimited.
   */
  @Expose()
  get authLimit(): number {
    return this.auths?.limit ?? 0;
  }
  /**
   * Max sessions allowed per user. 100 maximum.
   */
  @Expose()
  get authSessionsLimit(): number {
    return this.auths?.sessionsLimit ?? 0;
  }
  /**
   * Max allowed passwords in the history list per user. Max passwords limit allowed in history is 20. Use 0 for disabling password history.
   */
  @Expose()
  get authPasswordHistory(): number {
    return this.auths?.passwordHistory ?? 0;
  }
  /**
   * Whether or not to check user's password against most commonly used passwords.
   */
  @Expose()
  get authPasswordDictionary(): boolean {
    return this.auths?.passwordDictionary ?? false;
  }
  /**
   * Whether or not to check the user password for similarity with their personal data.
   */
  @Expose()
  get authPersonalDataCheck(): boolean {
    return this.auths?.personalDataCheck ?? false;
  }
  /**
   * An array of mock numbers and their corresponding verification codes (OTPs).
   */
  @Expose()
  get authMockNumbers(): MockNumberModel[] {
    return this.auths?.mockNumbers ?? [];
  }
  /**
   * Whether or not to send session alert emails to users.
   */
  @Expose()
  get authSessionAlerts(): boolean {
    return this.auths?.sessionAlerts ?? false;
  }
  /**
   * Whether or not to show user names in the teams membership response.
   */
  @Expose()
  get authMembershipsUserName(): boolean {
    return this.auths?.membershipsUserName ?? false;
  }
  /**
   * Whether or not to show user emails in the teams membership response.
   */
  @Expose()
  get authMembershipsUserEmail(): boolean {
    return this.auths?.membershipsUserEmail ?? false;
  }
  /**
   * Whether or not to show user MFA status in the teams membership response.
   */
  @Expose()
  get authMembershipsMfa(): boolean {
    return this.auths?.membershipsMfa ?? false;
  }
  /**
   * List of Auth Providers.
   */
  @Expose() declare oAuthProviders: AuthProviderModel[];
  /**
   * List of Platforms.
   */
  @Expose() declare platforms: PlatformModel[];
  /**
   * List of Webhooks.
   */
  @Expose() declare webhooks: WebhookModel[];
  /**
   * List of API Keys.
   */
  @Expose() declare keys: KeyModel[];
  /**
   * Status for custom SMTP
   */
  @Expose()
  get smtpEnabled(): boolean {
    return this.smtp?.enabled ?? false;
  }
  /**
   * SMTP sender name
   */
  @Expose()
  get smtpSenderName(): string {
    return this.smtp?.senderName ?? '';
  }
  /**
   * SMTP sender email
   */
  @Expose()
  get smtpSenderEmail(): string {
    return this.smtp?.senderEmail ?? '';
  }
  /**
   * SMTP reply to email
   */
  @Expose()
  get smtpReplyTo(): string {
    return this.smtp?.replyTo ?? '';
  }
  /**
   * SMTP server host name
   */
  @Expose()
  get smtpHost(): string {
    return this.smtp?.host ?? '';
  }
  /**
   * SMTP server port
   */
  @Expose()
  get smtpPort(): number {
    return this.smtp?.port ?? 0;
  }
  /**
   * SMTP server username
   */
  @Expose()
  get smtpUsername(): string {
    return this.smtp?.username ?? '';
  }
  /**
   * SMTP server password
   */
  @Expose()
  get smtpPassword(): string {
    return this.smtp?.password ?? '';
  }
  /**
   * SMTP server secure protocol
   */
  @Expose()
  get smtpSecure(): boolean {
    return this.smtp?.secure ?? false;
  }
  /**
   * Number of times the ping was received for this project.
   */
  @Expose() declare pingCount: number;
  /**
   * Last ping datetime in ISO 8601 format.
   */
  @Expose() declare pingedAt: string;
  /**
   * Email/Password auth method status
   */
  @Expose()
  get authEmailPassword(): boolean {
    return this.auths?.emailPassword ?? false;
  }
  /**
   * Magic URL auth method status
   */
  @Expose()
  get authUsersAuthMagicURL(): boolean {
    return this.auths?.usersAuthMagicURL ?? false;
  }
  /**
   * Email (OTP) auth method status
   */
  @Expose()
  get authEmailOtp(): boolean {
    return this.auths?.emailOtp ?? false;
  }
  /**
   * Anonymous auth method status
   */
  @Expose()
  get authAnonymous(): boolean {
    return this.auths?.anonymous ?? false;
  }
  /**
   * Invites auth method status
   */
  @Expose()
  get authInvites(): boolean {
    return this.auths?.invites ?? false;
  }
  /**
   * JWT auth method status
   */
  @Expose()
  get authJWT(): boolean {
    return this.auths?.JWT ?? false;
  }
  /**
   * Phone auth method status
   */
  @Expose()
  get authPhone(): boolean {
    return this.auths?.phone ?? false;
  }
  /**
   * Account service status
   */
  @Expose()
  get serviceStatusForAccount(): boolean {
    return this.services?.account ?? false;
  }
  /**
   * Avatars service status
   */
  @Expose()
  get serviceStatusForAvatars(): boolean {
    return this.services?.avatars ?? false;
  }
  /**
   * Databases service status
   */
  @Expose()
  get serviceStatusForDatabases(): boolean {
    return this.services?.databases ?? false;
  }
  /**
   * Locale service status
   */
  @Expose()
  get serviceStatusForLocale(): boolean {
    return this.services?.locale ?? false;
  }
  /**
   * Health service status
   */
  @Expose()
  get serviceStatusForHealth(): boolean {
    return this.services?.health ?? false;
  }
  /**
   * Storage service status
   */
  @Expose()
  get serviceStatusForStorage(): boolean {
    return this.services?.storage ?? false;
  }
  /**
   * Teams service status
   */
  @Expose()
  get serviceStatusForTeams(): boolean {
    return this.services?.teams ?? false;
  }
  /**
   * Users service status
   */
  @Expose()
  get serviceStatusForUsers(): boolean {
    return this.services?.users ?? false;
  }
  /**
   * Functions service status
   */
  @Expose()
  get serviceStatusForFunctions(): boolean {
    return this.services?.functions ?? false;
  }
  /**
   * GraphQL service status
   */
  @Expose()
  get serviceStatusForGraphql(): boolean {
    return this.services?.graphql ?? false;
  }
  /**
   * Messaging service status
   */
  @Expose()
  get serviceStatusForMessaging(): boolean {
    return this.services?.messaging ?? false;
  }
  /**
   * Project region
   */
  @Expose() declare region: string;
  /**
   * Project status
   */
  @Expose() declare status: string;
  /**
   * Is project enabled
   */
  @Expose() declare enabled: boolean;
  /**
   * Environment 
   */
  @Expose() declare environment: string;
  /**
   * Database
   */
  @Transform(({ value }) => {
    if (!value) return {};
    const dbConfig = {
      postgres: {
        host: value['postgres']['host'] || 'localhost',
        port: value['postgres']['port'] || 5432,
        database: value['postgres']['database'] || 'postgres',
        user: value['postgres']['user'] || 'postgres',
      },
      pool: {
        host: value['pool']['host'] || 'localhost',
        port: value['pool']['port'] || 6432,
        database: value['pool']['database'] || 'postgres',
        user: value['pool']['user'] || 'postgres',
      }
    };
    return dbConfig;
  })
  @Expose() declare database: Record<string, any>;

  constructor() {
    super();
    this.$permissions = [];
  }
}
