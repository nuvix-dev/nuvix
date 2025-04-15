import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class TeamModel extends BaseModel {
  /**
   * Team name.
   */
  @Expose() name: string = ''; // Default to empty string

  /**
   * Total number of team members.
   */
  @Expose() total: number = 0; // Default to 0

  /**
   * Team preferences as a key-value object.
   */
  @Expose() prefs: Record<string, any> = {}; // Default to empty object

  constructor(partial: Partial<TeamModel>) {
    super();
    Object.assign(this, partial);
  }
}
