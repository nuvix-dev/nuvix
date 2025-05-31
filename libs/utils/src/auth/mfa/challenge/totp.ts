import { authenticator } from 'otplib';
import { Document } from '@nuvix/database';
import { TOTP as TOTPType } from '@nuvix/core/validators';
import { Challenge } from '../challenge';

export class TOTP extends Challenge {
  public static verify(user: Document, otp: string): boolean {
    const authenticatorDoc = TOTPType.getAuthenticatorFromUser(user);
    const data = authenticatorDoc.getAttribute('data');

    return authenticator.verify({
      token: otp,
      secret: data.secret,
    });
  }

  public static challenge(
    challenge: Document,
    user: Document,
    otp: string,
  ): boolean {
    if (challenge.isSet('type') && challenge.getAttribute('type') === 'TOTP') {
      return this.verify(user, otp);
    }

    return false;
  }
}
