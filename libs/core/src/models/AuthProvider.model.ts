import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class AuthProviderModel extends BaseModel {
  /**
   * Auth Provider key.
   */
  @Expose() key: string = '';

  /**
   * Auth Provider name.
   */
  @Expose() name: string = '';

  /**
   * OAuth 2.0 application ID.
   */
  @Expose() appId: string = '';

  /**
   * OAuth 2.0 application secret. Might be JSON string if provider requires extra configuration.
   */
  @Expose() secret: string = '';

  /**
   * Auth Provider is active and can be used to create session.
   */
  @Expose() enabled: boolean = false;

  constructor(partial: Partial<AuthProviderModel>) {
    super();
    Object.assign(this, partial);
  }

  /**
   * Get Name
   *
   * @return string
   */
  getName(): string {
    return 'AuthProvider';
  }

  /**
   * Get Type
   *
   * @return string
   */
  getType(): string {
    return 'MODEL_AUTH_PROVIDER';
  }
}
