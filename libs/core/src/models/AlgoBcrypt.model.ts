import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class AlgoBcryptModel extends BaseModel {
  /**
   * Algo type.
   */
  @Expose() type: string = 'bcrypt';

  constructor(partial: Partial<AlgoBcryptModel>) {
    super();
    Object.assign(this, partial);
  }
}
