import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class AlgoArgon2Model extends BaseModel {
  /**
   * Algo type.
   */
  @Expose() type = 'argon2'

  /**
   * Memory used to compute hash.
   */
  @Expose() memoryCost = 65536

  /**
   * Amount of time consumed to compute hash.
   */
  @Expose() timeCost = 4

  /**
   * Number of threads used to compute hash.
   */
  @Expose() threads = 3

  constructor(partial: Partial<AlgoArgon2Model>) {
    super()
    Object.assign(this, partial)
  }
}
