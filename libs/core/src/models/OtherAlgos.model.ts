import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class AlgoPhpassModel extends BaseModel {
  @Expose() type: string = 'phpass';

  constructor(partial: Partial<AlgoPhpassModel>) {
    super();
    Object.assign(this, partial);
  }
}

@Exclude()
export class AlgoShaModel extends BaseModel {
  @Expose() type: string = 'sha';

  constructor(partial: Partial<AlgoShaModel>) {
    super();
    Object.assign(this, partial);
  }
}

@Exclude()
export class AlgoScryptModel extends BaseModel {
  @Expose() type: string = 'scrypt';
  @Expose() costCpu: number = 8;
  @Expose() costMemory: number = 14;
  @Expose() costParallel: number = 1;
  @Expose() length: number = 64;

  constructor(partial: Partial<AlgoScryptModel>) {
    super();
    Object.assign(this, partial);
  }
}

@Exclude()
export class AlgoScryptModifiedModel extends BaseModel {
  @Expose() type: string = 'scryptMod';
  @Expose() salt: string = '';
  @Expose() saltSeparator: string = '';
  @Expose() signerKey: string = '';

  constructor(partial: Partial<AlgoScryptModifiedModel>) {
    super();
    Object.assign(this, partial);
  }
}
