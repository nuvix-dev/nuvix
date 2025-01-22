import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export abstract class TemplateModel extends BaseModel {
  /**
   * Template type.
   */
  @Expose() type: string = ''; // Default to empty string

  /**
   * Template locale.
   */
  @Expose() locale: string = ''; // Default to empty string

  /**
   * Template message.
   */
  @Expose() message: string = ''; // Default to empty string

  constructor(partial: Partial<TemplateModel>) {
    super();
    Object.assign(this, partial);
  }
}
