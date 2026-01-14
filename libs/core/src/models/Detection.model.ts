import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class DetectionModel extends BaseModel {
  /**
   * Runtime.
   */
  @Expose() runtime: string = ''

  constructor(partial: Partial<DetectionModel>) {
    super()
    Object.assign(this, partial)
  }
}
