import { Exclude } from 'class-transformer';
import { UserModel } from './User.model';

@Exclude()
export class AccountModel extends UserModel {
  /**
   * Hashed user password.
   */
  override password?: string;
  /**
   * Password hashing algorithm.
   */
  override hash?: string;
  /**
   * Password hashing algorithm configuration.
   */
  override hashOptions?: object;

  mfaRecoveryCodes: string[];

  constructor(data: Partial<AccountModel>) {
    super(data);
  }
}
