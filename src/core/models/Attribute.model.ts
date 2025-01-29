import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class AttributeModel extends BaseModel {
  @Exclude() override $id: string;
  @Exclude() override $permissions: string[] | any[];
  /**
   * Attribute Key.
   */
  @Expose() key: string = '';

  /**
   * Attribute type.
   */
  @Expose() type: string = '';

  /**
   * Attribute status. Possible values: `available`, `processing`, `deleting`, `stuck`, or `failed`.
   */
  @Expose() status: string = 'available';

  /**
   * Error message. Displays error generated on failure of creating or deleting an attribute.
   */
  @Expose() error: string = '';

  /**
   * Is attribute required?
   */
  @Expose() required: boolean = false;

  /**
   * Is attribute an array?
   */
  @Expose() array: boolean = false;

  @Expose() format: string;
  @Expose() default: any | null;
  @Expose() elements: string[];
  @Expose() min: number | null;
  @Expose() max: number | null;

  constructor(partial: Partial<AttributeModel>) {
    super();
    Object.assign(this, partial);
  }
}
