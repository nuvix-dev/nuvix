import { Document } from '@nuvix/database';

export abstract class Challenge {
  public static verify(user: Document, otp: string): boolean {
    return false;
  }
  public static challenge(
    challenge: Document,
    user: Document,
    otp: string,
  ): boolean {
    return false;
  }
}
