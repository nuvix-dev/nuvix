import { IsCustomID, IsUID } from '@nuvix/core/validators';

export class CreateSubscriberDTO {
  @IsCustomID()
  subscriberId!: string;

  @IsUID()
  targetId!: string;
}
