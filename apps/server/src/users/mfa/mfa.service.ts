import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { MfaType, TOTP } from '@nuvix/core/validators'

import { Database, Doc } from '@nuvix/db'

@Injectable()
export class MfaService {
  /**
   * Update Mfa Status
   */
  async updateMfaStatus(id: string, mfa: boolean) {
    const user = await this.db.getDocument('users', id)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    user.set('mfa', mfa)

    const updatedUser = await this.db.updateDocument(
      'users',
      user.getId(),
      user,
    )

    // TODO: Implement queue for events

    return updatedUser
  }

  /**
   * Get Mfa factors
   */
  async getMfaFactors(userId: string) {
    const user = await this.db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const totp = TOTP.getAuthenticatorFromUser(user)

    return new Doc({
      [MfaType.TOTP]: totp?.get('verified', false),
      [MfaType.EMAIL]:
        user.get('email', false) && user.get('emailVerification', false),
      [MfaType.PHONE]:
        user.get('phone', false) && user.get('phoneVerification', false),
    })
  }

  /**
   * Get Mfa Recovery Codes
   */
  async getMfaRecoveryCodes(userId: string) {
    const user = await this.db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', [])

    if (!mfaRecoveryCodes.length) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND)
    }

    return new Doc({
      recoveryCodes: mfaRecoveryCodes,
    })
  }

  /**
   * Generate Mfa Recovery Codes
   */
  async generateMfaRecoveryCodes(userId: string) {
    const user = await this.db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', [])

    if (mfaRecoveryCodes.length > 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_ALREADY_EXISTS)
    }

    const newRecoveryCodes = TOTP.generateBackupCodes()
    user.set('mfaRecoveryCodes', newRecoveryCodes)
    await this.db.updateDocument('users', user.getId(), user)

    // TODO: Implement queue for events

    return new Doc({
      recoveryCodes: newRecoveryCodes,
    })
  }

  /**
   * Regenerate Mfa Recovery Codes
   */
  async regenerateMfaRecoveryCodes(userId: string) {
    const user = await this.db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', [])
    if (!mfaRecoveryCodes.length) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND)
    }

    const newRecoveryCodes = TOTP.generateBackupCodes()
    user.set('mfaRecoveryCodes', newRecoveryCodes)
    await this.db.updateDocument('users', user.getId(), user)

    // TODO: Implement queue for events

    return new Doc({
      recoveryCodes: newRecoveryCodes,
    })
  }

  /**
   * Delete Mfa Authenticator
   */
  async deleteMfaAuthenticator(userId: string, _type: string) {
    const user = await this.db.getDocument('users', userId)

    if (user.empty()) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }

    const authenticator = TOTP.getAuthenticatorFromUser(user)

    if (authenticator === null) {
      throw new Exception(Exception.USER_AUTHENTICATOR_NOT_FOUND)
    }

    await this.db.deleteDocument('authenticators', authenticator.getId())
    await this.db.purgeCachedDocument('users', user.getId())

    // TODO: Implement queue for events
  }
}
