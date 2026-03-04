import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class HealthStatusModel extends BaseModel {
  @Expose() name = ''
  @Expose() ping = 0
  @Expose() status = ''

  constructor(partial: Partial<HealthStatusModel>) {
    super()
    Object.assign(this, partial)
  }
}

@Exclude()
export class HealthTimeModel extends BaseModel {
  @Expose() remoteTime = 0
  @Expose() localTime = 0
  @Expose() diff = 0

  constructor(partial: Partial<HealthTimeModel>) {
    super()
    Object.assign(this, partial)
  }
}

@Exclude()
export class HealthVersionModel extends BaseModel {
  @Expose() version = ''

  constructor(partial: Partial<HealthVersionModel>) {
    super()
    Object.assign(this, partial)
  }
}
