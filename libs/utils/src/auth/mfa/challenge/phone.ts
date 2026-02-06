import { MfaType } from '@nuvix/core/validators'
import { type ChallengesDoc, UsersDoc } from '@nuvix/utils/types'
import { Challenge } from '../challenge'

export class Phone extends Challenge {
  static override async verify(
    challenge: UsersDoc,
    otp: string,
  ): Promise<boolean> {
    return challenge.get('code') === otp
  }

  static override async challenge(
    challenge: ChallengesDoc,
    _user: UsersDoc,
    otp: string,
  ): Promise<boolean> {
    if (challenge.has('type') && challenge.get('type') === MfaType.PHONE) {
      return Phone.verify(challenge as UsersDoc, otp)
    }
    return false
  }
}
