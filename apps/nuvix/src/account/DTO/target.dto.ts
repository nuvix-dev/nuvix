import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePushTargetDTO {
  @IsString()
  @IsNotEmpty()
  identifier: string; // Push identifier (token, ID, etc...)

  @IsOptional()
  @IsString()
  // @IsUUID() // providerId might not always be a UUID, could be a string key
  providerId?: string; // Push provider ID
}

export class TargetIdParamDTO {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  targetId: string;
}
