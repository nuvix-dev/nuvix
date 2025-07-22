import { IsCustomID } from '@nuvix/core/validators/input.validator';
import { IsNotEmpty, IsString } from 'class-validator';

export class IdentityIdParamDTO {
  @IsString()
  @IsNotEmpty()
  @IsCustomID()
  identityId: string;
}
