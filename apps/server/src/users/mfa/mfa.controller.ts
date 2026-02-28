import { Body, Controller, Param, UseInterceptors } from '@nestjs/common'
import { Delete, Get, Patch, Put } from '@nuvix/core'
import { Auth, AuthType, Namespace } from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { ApiInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import type { Doc } from '@nuvix/db'
import { IResponse } from '@nuvix/utils'
import { UsersDoc } from '@nuvix/utils/types'
import { UserParamDTO } from '../DTO/user.dto'
import { MfaTypeParamDTO, UpdateMfaStatusDTO } from './DTO/mfa.dto'
import { MfaService } from './mfa.service'

@Namespace('users')
@Controller({ version: ['1'], path: 'users/:userId/mfa' })
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.KEY])
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Patch('', {
    summary: 'Update MFA',
    scopes: 'users.write',
    model: Models.USER,
    secretFields: ['password', 'hashOptions'],
    audit: {
      key: 'user.update',
      resource: 'user/{params.userId}',
    },
    sdk: {
      name: 'updateMfa',
      descMd: '/docs/references/users/update-user-mfa.md',
    },
  })
  async updateMfa(
    @Param() { userId }: UserParamDTO,
    @Body() { mfa }: UpdateMfaStatusDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.mfaService.updateMfaStatus(userId, mfa)
  }

  @Get('factors', {
    summary: 'List factors',
    scopes: 'users.read',
    model: Models.MFA_FACTORS,
    sdk: {
      name: 'listMfaFactors',
      descMd: '/docs/references/users/list-mfa-factors.md',
    },
  })
  async getMfaFactors(@Param() { userId }: UserParamDTO): Promise<unknown> {
    return this.mfaService.getMfaFactors(userId)
  }

  @Get('recovery-codes', {
    summary: 'Get MFA recovery codes',
    scopes: 'users.read',
    model: Models.MFA_RECOVERY_CODES,
    secretFields: ['recoveryCodes'],
    sdk: {
      name: 'getMfaRecoveryCodes',
      descMd: '/docs/references/users/get-mfa-recovery-codes.md',
    },
  })
  async getMfaRecoveryCodes(@Param() { userId }: UserParamDTO): Promise<
    Doc<{
      recoveryCodes: string[]
    }>
  > {
    return this.mfaService.getMfaRecoveryCodes(userId)
  }

  @Patch('recovery-codes', {
    summary: 'Create MFA recovery codes',
    scopes: 'users.write',
    model: Models.MFA_RECOVERY_CODES,
    secretFields: ['recoveryCodes'],
    audit: {
      key: 'recovery.create',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'createMfaRecoveryCodes',
      descMd: '/docs/references/users/create-mfa-recovery-codes.md',
    },
  })
  async generateMfaRecoveryCodes(@Param() { userId }: UserParamDTO): Promise<
    Doc<{
      recoveryCodes: string[]
    }>
  > {
    return this.mfaService.generateMfaRecoveryCodes(userId)
  }

  @Put('recovery-codes', {
    summary: 'Update MFA recovery codes (regenerate)',
    scopes: 'users.write',
    model: Models.MFA_RECOVERY_CODES,
    secretFields: ['recoveryCodes'],
    audit: {
      key: 'recovery.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updateMfaRecoveryCodes',
      descMd: '/docs/references/users/update-mfa-recovery-codes.md',
    },
  })
  async regenerateMfaRecoveryCodes(@Param() { userId }: UserParamDTO): Promise<
    Doc<{
      recoveryCodes: string[]
    }>
  > {
    return this.mfaService.regenerateMfaRecoveryCodes(userId)
  }

  @Delete('authenticators/:type', {
    summary: 'Delete authenticator',
    scopes: 'users.write',
    model: Models.NONE,
    audit: {
      key: 'user.update',
      resource: 'user/{params.userId}',
      userId: '{params.userId}',
    },
    sdk: {
      name: 'deleteMfaAuthenticator',
      descMd: '/docs/references/users/delete-mfa-authenticator.md',
    },
  })
  async deleteMfaAuthenticator(
    @Param() { userId, type }: MfaTypeParamDTO,
  ): Promise<void> {
    return this.mfaService.deleteMfaAuthenticator(userId, type)
  }
}
