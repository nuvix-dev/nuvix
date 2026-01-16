import { IsUID } from '@nuvix/core/validators'

export class IdentityIdParamDTO {
  /**
   * Identity ID.
   */
  @IsUID()
  declare identityId: string
}
