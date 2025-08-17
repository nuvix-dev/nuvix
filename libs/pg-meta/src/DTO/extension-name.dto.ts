import { IsString } from 'class-validator';

export class ExtensionNameParamDTO {
  @IsString()
  declare name: string;
}
