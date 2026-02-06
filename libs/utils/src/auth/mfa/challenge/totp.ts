import { MfaType, TOTP as TOTPType } from '@nuvix/core/validators'
import { type ChallengesDoc, UsersDoc } from '@nuvix/utils/types'
import { TOTP as BaseTOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import { Challenge } from '../challenge'

export class TOTP extends Challenge {
  public static override async verify(
    user: UsersDoc,
    otp: string,
  ): Promise<boolean> {
    const authenticatorDoc = TOTPType.getAuthenticatorFromUser(user)
    const data = authenticatorDoc?.get('data') as unknown as {
      secret: string
      label: string
      issuer: string
    }

    const result = await new BaseTOTP({
      crypto: new NobleCryptoPlugin(),
      base32: new ScureBase32Plugin(),
    }).verify(otp, {
      secret: data.secret,
      label: data.label,
      issuer: data.issuer,
    })
    return result.valid
  }

  public static override async challenge(
    challenge: ChallengesDoc,
    user: UsersDoc,
    otp: string,
  ): Promise<boolean> {
    if (challenge.has('type') && challenge.get('type') === MfaType.TOTP) {
      return TOTP.verify(user, otp)
    }

    return false
  }
}
