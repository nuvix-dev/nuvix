import { authenticator } from 'otplib';
import { MfaType, TOTP as TOTPType } from '@nuvix/core/validators';
import { Challenge } from '../challenge';
import { UsersDoc, type ChallengesDoc } from '@nuvix/utils/types';

export class TOTP extends Challenge {
  public static override verify(user: UsersDoc, otp: string): boolean {
    const authenticatorDoc = TOTPType.getAuthenticatorFromUser(user);
    const data = authenticatorDoc?.get('data') as unknown as { secret: string };

    return authenticator.verify({
      token: otp,
      secret: data.secret,
    });
  }

  public static override challenge(
    challenge: ChallengesDoc,
    user: UsersDoc,
    otp: string,
  ): boolean {
    if (challenge.has('type') && challenge.get('type') === MfaType.TOTP) {
      return this.verify(user, otp);
    }

    return false;
  }
}
