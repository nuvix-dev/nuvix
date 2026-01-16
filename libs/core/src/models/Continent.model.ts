import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class ContinentModel extends BaseModel {
  /**
   * Continent name.
   */
  @Expose() name: string = ''

  /**
   * Continent two letter code.
   */
  @Expose() code: string = ''

  constructor(partial: Partial<ContinentModel>) {
    super()
    Object.assign(this, partial)
  }
}
