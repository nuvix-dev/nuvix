import { Exclude, Expose } from "class-transformer";
import { BaseListModel } from "src/core/models/base.model";

@Exclude()
export class AuthProviderModel {
  /**
 * Auth Provider.
 */
  @Expose() key: string;
  /**
   * Auth Provider name.
   */
  @Expose() name: string;
  /**
   * OAuth 2.0 application ID.
   */
  @Expose() appId: string;
  /**
   * OAuth 2.0 application secret. Might be JSON string if provider requires extra configuration.
   */
  @Expose() secret: string;
  /**
   * Auth Provider is active and can be used to create session.
   */
  @Expose() enabled: boolean;

  constructor(data: Partial<AuthProviderModel | any>) {
    Object.assign(this, data);
  }
}


export class AuthProviderListModel extends BaseListModel {

  authProviders: AuthProviderModel[];

  constructor(data: Partial<AuthProviderListModel | any>) {
    super();
    this.authProviders = data.authProviders.map((authProvider: AuthProviderModel) => new AuthProviderModel(authProvider));
    this.total = data.total || this.authProviders.length;
  }
}