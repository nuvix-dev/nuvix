import { Exclude, Expose } from "class-transformer";

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
}