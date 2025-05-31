import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class IdentityIdParamDTO {
  @IsString()
  @IsNotEmpty()
  @IsUUID() // Assuming identityId is a UUID
  identityId: string;
}
