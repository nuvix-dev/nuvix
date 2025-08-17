import { IsCustomID } from '@nuvix/core/validators/input.validator';

export class IdentityIdParamDTO {
  @IsCustomID()
  identityId!: string;
}
