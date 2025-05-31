import { Document } from '@nuvix/database';
import { TOTP as TOTPType } from '@nuvix/core/validators';
import { Challenge } from '../challenge';

export class Email extends Challenge {
  public static verify(challenge: Document, otp: string): boolean {
    return challenge.getAttribute('code') === otp;
  }

  public static challenge(
    challenge: Document,
    user: Document,
    otp: string,
  ): boolean {
    if (
      challenge.isSet('type') &&
      challenge.getAttribute('type') === TOTPType.EMAIL
    ) {
      return this.verify(challenge, otp);
    }

    return false;
  }
}
