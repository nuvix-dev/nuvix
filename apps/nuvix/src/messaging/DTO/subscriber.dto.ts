import { IsCustomID, IsUID } from '@nuvix/core/validators';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubscriberDTO {
  @IsCustomID()
  subscriberId!: string;

  @IsUID()
  targetId!: string;
}
