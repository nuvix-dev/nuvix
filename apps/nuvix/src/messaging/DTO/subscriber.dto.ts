import { IsCustomID } from '@nuvix/core/validators';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubscriberDTO {
  @IsCustomID()
  subscriberId: string;

  @IsString()
  @IsNotEmpty()
  targetId: string;
}
