import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class VariableModel extends BaseModel {
  /**
   * Variable key.
   */
  @Expose() key: string = ''; // Default to empty string

  /**
   * Variable value.
   */
  @Expose() value: string = ''; // Default to empty string

  /**
   * Service to which the variable belongs. Possible values are "project", "function".
   */
  @Expose() resourceType: string = ''; // Default to empty string

  /**
   * ID of resource to which the variable belongs. If resourceType is "project", it is empty. If resourceType is "function", it is ID of the function.
   */
  @Expose() resourceId: string = ''; // Default to empty string

  constructor(partial: Partial<VariableModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}
