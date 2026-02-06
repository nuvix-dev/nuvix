import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class AlgoMd5Model extends BaseModel {
  /**
   * Algo type.
   */
  @Expose() type = 'md5'

  constructor(partial: Partial<AlgoMd5Model>) {
    super()
    Object.assign(this, partial)
  }
}
