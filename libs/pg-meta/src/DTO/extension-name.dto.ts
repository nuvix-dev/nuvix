import { IsString } from 'class-validator';

export class ExtensionNameParamDTO {
  @IsString()
  name: string;
}
