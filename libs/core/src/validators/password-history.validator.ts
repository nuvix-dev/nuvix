import { Auth } from '../helper/auth.helper';
import { PasswordValidator } from './password.validator';

export class PasswordHistoryValidator extends PasswordValidator {
  private history: string[];
  private algo: string;
  private algoOptions: object;

  constructor(history: string[], algo: string, algoOptions: object = {}) {
    super();
    this.history = history;
    this.algo = algo;
    this.algoOptions = algoOptions;
  }

  /**
   * Get Description.
   *
   * Returns validator description
   *
   * @return string
   */
  getDescription(): string {
    return "Password shouldn't be in the history.";
  }

  /**
   * Is valid.
   *
   * @param value
   *
   * @return bool
   */
  isValid(value: string): boolean {
    for (const hash of this.history) {
      if (
        hash &&
        Auth.passwordVerify(value, hash, this.algo, this.algoOptions)
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Is array
   *
   * Function will return true if object is array.
   *
   * @return bool
   */
  isArray(): boolean {
    return false;
  }

  /**
   * Get Type
   *
   * Returns validator type.
   *
   * @return string
   */
  getType(): string {
    return 'string';
  }
}
