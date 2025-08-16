import { Challenge } from '../challenge';
import { MfaType } from '@nuvix/core/validators';
import {  UsersDoc, type ChallengesDoc } from '@nuvix/utils/types';

export class Phone extends Challenge {
  static override verify(challenge: UsersDoc, otp: string): boolean {
    return challenge.get('code') === otp;
  }

  static override challenge(challenge: ChallengesDoc, user: UsersDoc, otp: string): boolean {
    if (
      challenge.has('type') &&
      challenge.get('type') === MfaType.PHONE
    ) {
      return this.verify(challenge as UsersDoc, otp);
    }
    return false;
  }
}
