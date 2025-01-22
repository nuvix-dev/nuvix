import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class TemplateVariableModel extends BaseModel {
  /**
   * Variable Name.
   */
  @Expose() name: string = ''; // Default to empty string

  /**
   * Variable Description.
   */
  @Expose() description: string = ''; // Default to empty string

  /**
   * Variable Value.
   */
  @Expose() value: string = ''; // Default to empty string

  /**
   * Variable Placeholder.
   */
  @Expose() placeholder: string = ''; // Default to empty string

  /**
   * Is the variable required?
   */
  @Expose() required: boolean = false; // Default to false

  /**
   * Variable Type.
   */
  @Expose() type: string = ''; // Default to empty string

  constructor(partial: Partial<TemplateVariableModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}
