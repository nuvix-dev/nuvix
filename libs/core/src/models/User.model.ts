import { Exclude, Expose, Type } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';
import { TargetModel } from './Target.model';

type Preferences = {
  [key: string]: any;
};

@Exclude()
export class UserModel extends BaseModel {
  /**
   * User name.
   */
  @Expose() declare name: string;
  /**
   * Hashed user password.
   */
  @Expose() declare password?: string;
  /**
   * Password hashing algorithm.
   */
  @Expose() hash?: string = '';
  /**
   * Password hashing algorithm configuration.
   */
  @Expose() hashOptions?: object = {};
  /**
   * User registration date in ISO 8601 format.
   */
  @Expose() declare registration: Date;
  /**
   * User status. Pass `true` for enabled and `false` for disabled.
   */
  @Expose() declare status: boolean;
  /**
   * Labels for the user.
   */
  @Expose() labels: string[] = [];
  /**
   * Password update time in ISO 8601 format.
   */
  @Expose() declare passwordUpdate: Date;
  /**
   * User email address.
   */
  @Expose() declare email: string;
  /**
   * User phone number in E.164 format.
   */
  @Expose() phone: string = '';
  /**
   * Email verification status.
   */
  @Expose() declare emailVerification: boolean;
  /**
   * Phone verification status.
   */
  @Expose() declare phoneVerification: boolean;
  /**
   * Multi factor authentication status.
   */
  @Expose() declare mfa: boolean;
  /**
   * User preferences as a key-value object
   */
  @Expose() declare prefs: Preferences;
  /**
   * A user-owned message receiver. A single user may have multiple e.g. emails, phones, and a browser. Each target is registered with a single provider.
   */
  @Type(() => TargetModel)
  @Expose()
  declare targets: TargetModel[];
  /**
   * Most recent access date in ISO 8601 format. This attribute is only updated again after 24 hours.
   */
  @Expose() declare accessedAt: Date;

  constructor(partial: Partial<UserModel | any>) {
    super();
    Object.assign(this, partial);
  }
}

export class UsersListModel {
  /**
   * Total number of Users.
   */
  total: number = 0;

  /**
   * List of users.
   */
  @Type(() => UserModel)
  users: UserModel[] = [];

  constructor(partial: Partial<UsersListModel>) {
    Object.assign(this, partial);
  }
}
