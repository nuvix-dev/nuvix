import { totp } from 'otplib'
import { Auth } from '../helpers/auth.helper'
import { Doc } from '@nuvix/db'
import { UsersDoc, type AuthenticatorsDoc } from '@nuvix/utils/types'

enum MfaType {
  TOTP = 'totp',
  EMAIL = 'email',
  PHONE = 'phone',
  RECOVERY_CODE = 'recoveryCode',
}

abstract class Mfa {
  protected instance: typeof totp

  public static readonly TOTP = 'totp'
  public static readonly EMAIL = 'email'
  public static readonly PHONE = 'phone'
  public static readonly RECOVERY_CODE = 'recoveryCode'

  constructor(instance: typeof totp) {
    this.instance = instance
  }

  public setLabel(label: string): this {
    this.instance.options['label'] = label
    return this
  }

  public getLabel(): string | null {
    return this.instance.options.algorithm || null
  }

  public setIssuer(issuer: string): this {
    this.instance.options['issuer'] = issuer
    return this
  }

  public getIssuer(): string | null {
    return (this.instance.options['issuer'] as string) || null
  }

  public getSecret(): string {
    return this.instance.options['secret'] as string
  }

  public getProvisioningUri(): string {
    return this.instance.toString()
  }

  public static generateBackupCodes(
    length: number = 10,
    total: number = 6,
  ): string[] {
    const backups: string[] = []

    for (let i = 0; i < total; i++) {
      backups.push(Auth.tokenGenerator(length))
    }

    return backups
  }
}

class TOTP extends Mfa {
  constructor() {
    super(totp)
  }

  public static getAuthenticatorFromUser(
    user: UsersDoc,
  ): AuthenticatorsDoc | null {
    const authenticators = user.get('authenticators', [])
    for (const authenticator of authenticators as Doc[]) {
      if (authenticator.get('type') === MfaType.TOTP) {
        return authenticator as AuthenticatorsDoc
      }
    }
    return null
  }
}

export { MfaType, TOTP }
