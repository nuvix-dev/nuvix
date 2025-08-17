import { MfaType } from '@nuvix/core/validators';
import { Challenge } from '../challenge';
import { UsersDoc, type ChallengesDoc } from '@nuvix/utils/types';

export class Email extends Challenge {
  public static override verify(challenge: UsersDoc, otp: string): boolean {
    return challenge.get('code') === otp;
  }

  public static override challenge(
    challenge: ChallengesDoc,
    user: UsersDoc,
    otp: string,
  ): boolean {
    if (challenge.has('type') && challenge.get('type') === MfaType.EMAIL) {
      return this.verify(challenge as UsersDoc, otp);
    }

    return false;
  }
}
