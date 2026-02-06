import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class ProviderModel extends BaseModel {
  /**
   * The name for the provider instance.
   */
  @Expose() name = '' // Default to empty string

  /**
   * The name of the provider service.
   */
  @Expose() provider = '' // Default to empty string

  /**
   * Is provider enabled?
   */
  @Expose() enabled = true // Default to true

  /**
   * Type of provider.
   */
  @Expose() type = '' // Default to empty string

  /**
   * Provider credentials.
   */
  @Expose() credentials: Record<string, any> = {} // Default to empty object

  /**
   * Provider options.
   */
  @Expose() options: Record<string, any> = {} // Default to empty object

  constructor(partial: Partial<ProviderModel>) {
    super()
    Object.assign(this, partial)
  }
}
