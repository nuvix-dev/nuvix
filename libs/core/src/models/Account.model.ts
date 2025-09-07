import { Exclude } from 'class-transformer';
import { UserModel } from './User.model';

@Exclude()
export class AccountModel extends UserModel {
  /**
   * Hashed user password.
   */
  @Exclude() declare password?: string;
  /**
   * Password hashing algorithm.
   */
  @Exclude() declare hash?: string;
  /**
   * Password hashing algorithm configuration.
   */
  @Exclude() declare hashOptions?: object;

  @Exclude() declare mfaRecoveryCodes: string[];

  constructor(data: Partial<AccountModel>) {
    super(data);
  }
}
