import { Doc } from '@nuvix/db'
import { type AuthenticatorsDoc, UsersDoc } from '@nuvix/utils/types'
import { TOTP as BaseTOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import { Auth } from '../helpers/auth.helper'

enum MfaType {
  TOTP = 'totp',
  EMAIL = 'email',
  PHONE = 'phone',
  RECOVERY_CODE = 'recoveryCode',
}

abstract class Mfa {
  protected options: {
    issuer?: string
    label?: string
    secret?: string
  } = {}

  public static readonly TOTP = 'totp'
  public static readonly EMAIL = 'email'
  public static readonly PHONE = 'phone'
  public static readonly RECOVERY_CODE = 'recoveryCode'

  public setLabel(label: string): this {
    this.options.label = label
    return this
  }

  public getLabel(): string | null {
    return this.options.label || null
  }

  public setIssuer(issuer: string): this {
    this.options.issuer = issuer
    return this
  }

  public getIssuer(): string | null {
    return this.options.issuer || null
  }

  public getSecret(): string {
    if (!this.options.secret) {
      this.options.secret = new BaseTOTP({
        crypto: new NobleCryptoPlugin(),
        base32: new ScureBase32Plugin(),
      }).generateSecret()
    }
    return this.options.secret
  }

  public getProvisioningUri(): string {
    return new BaseTOTP({
      crypto: new NobleCryptoPlugin(),
      base32: new ScureBase32Plugin(),
    }).toURI({
      secret: this.getSecret(),
      label: this.getLabel() || undefined,
      issuer: this.getIssuer() || undefined,
    })
  }

  public static generateBackupCodes(length = 10, total = 6): string[] {
    const backups: string[] = []

    for (let i = 0; i < total; i++) {
      backups.push(Auth.tokenGenerator(length))
    }

    return backups
  }
}

class TOTP extends Mfa {
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
