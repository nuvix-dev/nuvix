import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class AlgoArgon2Model extends BaseModel {
  /**
   * Algo type.
   */
  @Expose() type: string = 'argon2';

  /**
   * Memory used to compute hash.
   */
  @Expose() memoryCost: number = 65536;

  /**
   * Amount of time consumed to compute hash.
   */
  @Expose() timeCost: number = 4;

  /**
   * Number of threads used to compute hash.
   */
  @Expose() threads: number = 3;

  constructor(partial: Partial<AlgoArgon2Model>) {
    super();
    Object.assign(this, partial);
  }
}
