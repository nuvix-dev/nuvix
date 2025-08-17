import { Exclude } from 'class-transformer';
import { UserModel } from './User.model';

@Exclude()
export class AccountModel extends UserModel {
  /**
   * Hashed user password.
   */
  declare password?: string;
  /**
   * Password hashing algorithm.
   */
  declare hash?: string;
  /**
   * Password hashing algorithm configuration.
   */
  declare hashOptions?: object;

  declare mfaRecoveryCodes: string[];

  constructor(data: Partial<AccountModel>) {
    super(data);
  }
}
