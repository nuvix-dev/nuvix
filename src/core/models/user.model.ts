import { Exclude, Expose, Type } from "class-transformer";
import BaseModel from "src/core/models/base.model";

type Preferences = {
  [key: string]: any;
}

@Exclude()
export class UserModel extends BaseModel {
  /**
   * User name.
   */
  @Expose() name: string;
  /**
   * Hashed user password.
   */
  @Expose() password?: string;
  /**
   * Password hashing algorithm.
   */
  @Expose() hash?: string = "";
  /**
   * Password hashing algorithm configuration.
   */
  @Expose() hashOptions?: object = {};
  /**
   * User registration date in ISO 8601 format.
   */
  @Expose() registration: Date;
  /**
   * User status. Pass `true` for enabled and `false` for disabled.
   */
  @Expose() status: boolean;
  /**
   * Labels for the user.
   */
  @Expose() labels: string[] = [];
  /**
   * Password update time in ISO 8601 format.
   */
  @Expose() passwordUpdate: Date;
  /**
   * User email address.
   */
  @Expose() email: string;
  /**
   * User phone number in E.164 format.
   */
  @Expose() phone: string = "";
  /**
   * Email verification status.
   */
  @Expose() emailVerification: boolean;
  /**
   * Phone verification status.
   */
  @Expose() phoneVerification: boolean;
  /**
   * Multi factor authentication status.
   */
  @Expose() mfa: boolean;
  /**
   * User preferences as a key-value object
   */
  @Expose() prefs: Preferences;
  /**
   * A user-owned message receiver. A single user may have multiple e.g. emails, phones, and a browser. Each target is registered with a single provider.
   */
  // @Type(() => Target)
  // @Expose() targets: Target[];
  /**
   * Most recent access date in ISO 8601 format. This attribute is only updated again after 24 hours.
   */
  @Expose() accessedAt: Date;

  constructor(partial: Partial<UserModel>) {
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
  users: UserModel[] = [];
  constructor(partial: Partial<UsersListModel | { users: any[] | { [key: string]: string }[] }>) {
    if (partial.users) {
      this.users = partial.users.map((user: any) => new UserModel(user));
    }
    Object.assign(this, { ...partial, users: this.users });
  }

}