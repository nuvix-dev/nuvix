import {  UsersDoc, type ChallengesDoc } from 'libs/utils/types';

export abstract class Challenge {
  public static verify(user: UsersDoc, otp: string): boolean {
    return false;
  }
  public static challenge(
    challenge: ChallengesDoc,
    user: UsersDoc,
    otp: string,
  ): boolean {
    return false;
  }
}
