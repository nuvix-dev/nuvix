import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class RuleModel extends BaseModel {
  /**
   * Domain name.
   */
  @Expose() domain = '' // Default to empty string

  /**
   * Action definition for the rule. Possible values are "api", "function", or "redirect".
   */
  @Expose() resourceType = '' // Default to empty string

  /**
   * ID of resource for the action type. If resourceType is "api" or "url", it is empty. If resourceType is "function", it is ID of the function.
   */
  @Expose() resourceId = '' // Default to empty string

  /**
   * Domain verification status. Possible values are "created", "verifying", "verified" and "unverified".
   */
  @Expose() status = '' // Default to empty string

  /**
   * Certificate generation logs. This will return an empty string if generation did not run, or succeeded.
   */
  @Expose() logs = '' // Default to empty string

  /**
   * Certificate auto-renewal date in ISO 8601 format.
   */
  @Expose() renewAt = '' // Default to empty string

  constructor(partial: Partial<RuleModel>) {
    super()
    Object.assign(this, partial)
  }
}
