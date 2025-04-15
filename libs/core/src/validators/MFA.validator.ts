import { totp } from 'otplib';
import { Auth } from '../helper/auth.helper';
import { Document } from '@nuvix/database';

abstract class MfaType {
  protected instance: typeof totp;

  public static readonly TOTP = 'totp';
  public static readonly EMAIL = 'email';
  public static readonly PHONE = 'phone';
  public static readonly RECOVERY_CODE = 'recoveryCode';

  constructor(instance: typeof totp) {
    this.instance = instance;
  }

  public setLabel(label: string): this {
    this.instance.options.label = label;
    return this;
  }

  public getLabel(): string | null {
    return this.instance.options.algorithm || null;
  }

  public setIssuer(issuer: string): this {
    this.instance.options.issuer = issuer;
    return this;
  }

  public getIssuer(): string | null {
    return (this.instance.options.issuer as string) || null;
  }

  public getSecret(): string {
    return this.instance.options.secret as string;
  }

  public getProvisioningUri(): string {
    return this.instance.toString();
  }

  public static generateBackupCodes(
    length: number = 10,
    total: number = 6,
  ): string[] {
    const backups: string[] = [];

    for (let i = 0; i < total; i++) {
      backups.push(Auth.tokenGenerator(length));
    }

    return backups;
  }
}

class TOTP extends MfaType {
  constructor() {
    super(totp);
  }

  public static getAuthenticatorFromUser(user: Document): Document {
    const authenticators = user.getAttribute('authenticators', []);
    for (const authenticator of authenticators) {
      if (authenticator.getAttribute('type') === MfaType.TOTP) {
        return authenticator;
      }
    }
    return null;
  }
}

export { MfaType, TOTP };
