import { Exclude, Expose } from "class-transformer";
import BaseModel from "src/core/models/base.model";

@Exclude()
export class AttributeModel extends BaseModel {
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

  constructor(partial: Partial<AttributeModel>) {
    super();
    Object.assign(this, partial);
  }

  /**
   * Get Name
   *
   * @return string
   */
  getName(): string {
    return 'Attribute';
  }

  /**
   * Get Type
   *
   * @return string
   */
  getType(): string {
    return 'MODEL_ATTRIBUTE';
  }
}