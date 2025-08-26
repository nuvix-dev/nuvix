import type { Validator } from '@nuvix-tech/db';
import { Auth } from '../helper/auth.helper';
import { PasswordValidator } from './password.validator';
import type { HashAlgorithm } from '@nuvix/utils';

export class PasswordHistoryValidator implements Validator {
  private history: string[];
  private algo: string;
  private algoOptions: object;
  private passwordValidator: PasswordValidator = new PasswordValidator();

  constructor(history: string[], algo: string, algoOptions: object = {}) {
    this.history = history;
    this.algo = algo;
    this.algoOptions = algoOptions;
  }

  $description: string = "Password shouldn't be in the history.";

  /**
   * Is valid.
   *
   * @param value
   *
   * @return bool
   */
  async $valid(value: string): Promise<boolean> {
    if (!this.passwordValidator.$valid(value)) return false;
    for (const hash of this.history) {
      if (
        hash &&
        (await Auth.passwordVerify(
          value,
          hash,
          this.algo as HashAlgorithm,
          this.algoOptions,
        ))
      ) {
        return false;
      }
    }
    return true;
  }
}
