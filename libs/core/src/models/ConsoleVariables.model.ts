import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class ConsoleVariablesModel extends BaseModel {
  /**
   * CNAME target for your nuvix custom domains.
   */
  @Expose() APP_DOMAIN_TARGET: string = '';

  /**
   * Maximum file size allowed for file upload in bytes.
   */
  @Expose() APP_STORAGE_LIMIT: number = 0;

  /**
   * Maximum file size allowed for deployment in bytes.
   */
  @Expose() APP_FUNCTIONS_SIZE_LIMIT: number = 0;

  /**
   * Defines if usage stats are enabled.
   * This value is set to 'enabled' by default,
   * to disable the usage stats set the value to 'disabled'.
   */
  @Expose() APP_USAGE_STATS: string = 'enabled';

  /**
   * Defines if VCS (Version Control System) is enabled.
   */
  @Expose() APP_VCS_ENABLED: boolean = false;

  /**
   * Defines if main domain is configured.
   * If so, custom domains can be created.
   */
  @Expose() APP_DOMAIN_ENABLED: boolean = false;

  /**
   * Defines if AI assistant is enabled.
   */
  @Expose() APP_ASSISTANT_ENABLED: boolean = false;

  constructor(partial: Partial<ConsoleVariablesModel>) {
    super();
    Object.assign(this, partial);
  }
}
