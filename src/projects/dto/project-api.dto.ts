import { OmitType } from "@nestjs/mapped-types";
import { IsBoolean, IsIn } from "class-validator";
import apis from "src/core/config/apis";


export class ProjectApiStatusDto {

  @IsIn(Object.values(apis).map(api => api.key))
  api: string;

  @IsBoolean()
  status: boolean;
}


export class ProjectApiStatusAllDto extends OmitType(ProjectApiStatusDto, ['api']) { }