import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class TokenModel extends BaseModel {
  /**
   * User ID.
   */
  @Expose() userId = '' // Default to empty string

  /**
   * Token secret key. This will return an empty string unless the response is returned using an API key or as part of a webhook payload.
   */
  @Expose() secret = '' // Default to empty string

  /**
   * Token expiration date in ISO 8601 format.
   */
  @Expose() expire = '' // Default to empty string

  /**
   * Security phrase of a token. Empty if security phrase was not requested when creating a token.
   */
  @Expose() phrase = '' // Default to empty string

  constructor(partial: Partial<TokenModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
