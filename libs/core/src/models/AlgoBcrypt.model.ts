import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class AlgoBcryptModel extends BaseModel {
  /**
   * Algo type.
   */
  @Expose() type = 'bcrypt'

  constructor(partial: Partial<AlgoBcryptModel>) {
    super()
    Object.assign(this, partial)
  }
}
