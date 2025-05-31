import { Document } from '@nuvix/database';
import { Challenge } from '../challenge';
import { TOTP as TOTPType } from '@nuvix/core/validators';

export class Phone extends Challenge {
  static verify(challenge: Document, otp: string): boolean {
    return challenge.getAttribute('code') === otp;
  }

  static challenge(challenge: Document, user: Document, otp: string): boolean {
    if (
      challenge.isSet('type') &&
      challenge.getAttribute('type') === TOTPType.PHONE
    ) {
      return this.verify(challenge, otp);
    }
    return false;
  }
}
