import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class JWTModel extends BaseModel {
  /**
   * JWT encoded string.
   */
  @Expose() jwt: string = ''

  constructor(partial: Partial<JWTModel>) {
    super()
    Object.assign(this, partial)
  }
}
