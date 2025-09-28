import {
  Body,
  Controller,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { MfaService } from './mfa.service'
import { MfaTypeParamDTO, UpdateMfaStatusDTO } from './DTO/mfa.dto'
import { Models } from '@nuvix/core/helper/response.helper'
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor'
import { Namespace, AuthDatabase, Auth, AuthType } from '@nuvix/core/decorators'
import type { Database, Doc } from '@nuvix/db'
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard'
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor'
import { ApiTags } from '@nestjs/swagger'
import { UserParamDTO } from '../DTO/user.dto'
import { Delete, Get, Patch, Put } from '@nuvix/core'
import { IResponse } from '@nuvix/utils'
import { UsersDoc } from '@nuvix/utils/types'

@Namespace('users')
@ApiTags('mfa')
@Controller({ version: ['1'], path: 'users/:userId/mfa' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.KEY])
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Patch('', {
    summary: 'Update MFA',
    scopes: 'users.update',
    model: Models.USER,
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
    @AuthDatabase() db: Database,
    @Param() { userId }: UserParamDTO,
    @Body() { mfa }: UpdateMfaStatusDTO,
  ): Promise<IResponse<UsersDoc>> {
    return this.mfaService.updateMfaStatus(db, userId, mfa)
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
  async getMfaFactors(
    @AuthDatabase() db: Database,
    @Param() { userId }: UserParamDTO,
  ): Promise<unknown> {
    return this.mfaService.getMfaFactors(db, userId)
  }

  @Get('recovery-codes', {
    summary: 'Get MFA recovery codes',
    scopes: 'users.read',
    model: Models.MFA_RECOVERY_CODES,
    sdk: {
      name: 'getMfaRecoveryCodes',
      descMd: '/docs/references/users/get-mfa-recovery-codes.md',
    },
  })
  async getMfaRecoveryCodes(
    @AuthDatabase() db: Database,
    @Param() { userId }: UserParamDTO,
  ): Promise<
    Doc<{
      recoveryCodes: string[]
    }>
  > {
    return this.mfaService.getMfaRecoveryCodes(db, userId)
  }

  @Patch('recovery-codes', {
    summary: 'Create MFA recovery codes',
    scopes: 'users.update',
    model: Models.MFA_RECOVERY_CODES,
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
  async generateMfaRecoveryCodes(
    @AuthDatabase() db: Database,
    @Param() { userId }: UserParamDTO,
  ): Promise<
    Doc<{
      recoveryCodes: string[]
    }>
  > {
    return this.mfaService.generateMfaRecoveryCodes(db, userId)
  }

  @Put('recovery-codes', {
    summary: 'Update MFA recovery codes (regenerate)',
    scopes: 'users.update',
    model: Models.MFA_RECOVERY_CODES,
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
  async regenerateMfaRecoveryCodes(
    @AuthDatabase() db: Database,
    @Param() { userId }: UserParamDTO,
  ): Promise<
    Doc<{
      recoveryCodes: string[]
    }>
  > {
    return this.mfaService.regenerateMfaRecoveryCodes(db, userId)
  }

  @Delete('authenticators/:type', {
    summary: 'Delete authenticator',
    scopes: 'users.update',
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
    @AuthDatabase() db: Database,
    @Param() { userId, type }: MfaTypeParamDTO,
  ): Promise<void> {
    return this.mfaService.deleteMfaAuthenticator(db, userId, type)
  }
}
