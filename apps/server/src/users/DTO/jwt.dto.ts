import { IsUID } from '@nuvix/core/validators'
import { IsInt, Min, Max, IsOptional } from 'class-validator'

export class CreateJwtDTO {
  /**
   * Session ID. Use the string \'recent\' to use the most recent session. Defaults to the most recent session.
   */
  @IsOptional()
  @IsUID()
  sessionId?: string = 'recent'

  /**
   * Time in seconds before JWT expires. Default duration is 900 seconds, and maximum is 3600 seconds.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  duration: number = 900
}
