import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class ConsoleVariablesModel extends BaseModel {
  /**
   * CNAME target for your nuvix custom domains.
   */
  @Expose() APP_DOMAIN_TARGET = ''

  /**
   * Maximum file size allowed for file upload in bytes.
   */
  @Expose() APP_STORAGE_LIMIT = 0

  /**
   * Maximum file size allowed for deployment in bytes.
   */
  @Expose() APP_FUNCTIONS_SIZE_LIMIT = 0

  /**
   * Defines if usage stats are enabled.
   * This value is set to 'enabled' by default,
   * to disable the usage stats set the value to 'disabled'.
   */
  @Expose() APP_USAGE_STATS = 'enabled'

  /**
   * Defines if VCS (Version Control System) is enabled.
   */
  @Expose() APP_VCS_ENABLED = false

  /**
   * Defines if main domain is configured.
   * If so, custom domains can be created.
   */
  @Expose() APP_DOMAIN_ENABLED = false

  /**
   * Defines if AI assistant is enabled.
   */
  @Expose() APP_ASSISTANT_ENABLED = false

  constructor(partial: Partial<ConsoleVariablesModel>) {
    super()
    Object.assign(this, partial)
  }
}
