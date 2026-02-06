import { OmitType, PartialType } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'
import { CreateProjectDTO } from './create-project.dto'

export class UpdateProjectDTO extends PartialType(
  OmitType(CreateProjectDTO, ['region', 'teamId', 'projectId'] as const),
) {}

export class UpdateProjectTeamDTO {
  /**
   * Team ID of the team to transfer project to.
   */
  @IsNotEmpty()
  @IsString()
  declare teamId: string
}
