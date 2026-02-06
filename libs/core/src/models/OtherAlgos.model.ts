import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class AlgoPhpassModel extends BaseModel {
  @Expose() type = 'phpass'

  constructor(partial: Partial<AlgoPhpassModel>) {
    super()
    Object.assign(this, partial)
  }
}

@Exclude()
export class AlgoShaModel extends BaseModel {
  @Expose() type = 'sha'

  constructor(partial: Partial<AlgoShaModel>) {
    super()
    Object.assign(this, partial)
  }
}

@Exclude()
export class AlgoScryptModel extends BaseModel {
  @Expose() type = 'scrypt'
  @Expose() costCpu = 8
  @Expose() costMemory = 14
  @Expose() costParallel = 1
  @Expose() length = 64

  constructor(partial: Partial<AlgoScryptModel>) {
    super()
    Object.assign(this, partial)
  }
}

@Exclude()
export class AlgoScryptModifiedModel extends BaseModel {
  @Expose() type = 'scryptMod'
  @Expose() salt = ''
  @Expose() saltSeparator = ''
  @Expose() signerKey = ''

  constructor(partial: Partial<AlgoScryptModifiedModel>) {
    super()
    Object.assign(this, partial)
  }
}
