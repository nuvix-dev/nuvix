import { MfaType } from '@nuvix/core/validators'
import { type ChallengesDoc, UsersDoc } from '@nuvix/utils/types'
import { Challenge } from '../challenge'

export class Email extends Challenge {
  public static override async verify(
    challenge: UsersDoc,
    otp: string,
  ): Promise<boolean> {
    return challenge.get('code') === otp
  }

  public static override async challenge(
    challenge: ChallengesDoc,
    _user: UsersDoc,
    otp: string,
  ): Promise<boolean> {
    if (challenge.has('type') && challenge.get('type') === MfaType.EMAIL) {
      return Email.verify(challenge as UsersDoc, otp)
    }

    return false
  }
}
