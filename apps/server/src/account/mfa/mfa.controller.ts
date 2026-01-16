import {
  Body,
  Controller,
  Param,
  Req,
  Session,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'

import { Database, type Doc } from '@nuvix/db'
import { Auth, AuthType, Namespace, Scope } from '@nuvix/core/decorators'
import { Locale } from '@nuvix/core/decorators'
import { AuthDatabase, Project } from '@nuvix/core/decorators'
import { User } from '@nuvix/core/decorators'
import { Exception } from '@nuvix/core/extend/exception'
import { LocaleTranslator } from '@nuvix/core/helpers'
import { Models } from '@nuvix/core/helpers'
import { ProjectGuard } from '@nuvix/core/resolvers'
import { ApiInterceptor } from '@nuvix/core/resolvers'
import { ResponseInterceptor } from '@nuvix/core/resolvers'
import { MfaService } from './mfa.service'
import {
  CreateMfaChallengeDTO,
  MfaAuthenticatorTypeParamDTO,
  UpdateAccountMfaDTO,
  VerifyMfaChallengeDTO,
  VerifyMfaAuthenticatorDTO,
} from './DTO/mfa.dto'
import type {
  ChallengesDoc,
  ProjectsDoc,
  SessionsDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { Delete, Get, Patch, Post, Put } from '@nuvix/core'
import type { IResponse } from '@nuvix/utils'

@Controller({ version: ['1'], path: 'account/mfa' })
@Namespace('account')
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.SESSION, AuthType.JWT])
@Scope('account')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Patch('', {
    summary: 'Update MFA',
    model: Models.ACCOUNT,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updateMFA',
      descMd: '/docs/references/account/update-mfa.md',
    },
  })
  async updateMfa(
    @Body() { mfa }: UpdateAccountMfaDTO,
    @User() user: UsersDoc,
    @Session() session: SessionsDoc,
    @AuthDatabase() db: Database,
  ): Promise<IResponse<UsersDoc>> {
    return this.mfaService.updateMfa({
      mfa,
      session,
      user,
      db,
    })
  }

  @Get('factors', {
    summary: 'List factors',
    model: Models.MFA_CHALLENGE,
    sdk: {
      name: 'listMfaFactors',
      descMd: '/docs/references/account/list-mfa-factors.md',
    },
  })
  async getMfaFactors(
    @User() user: UsersDoc,
  ): Promise<IResponse<Doc<{ [key: string]: boolean }>>> {
    return this.mfaService.getMfaFactors(user)
  }

  @Post('authenticators/:type', {
    summary: 'Create authenticator',
    model: Models.MFA_TYPE,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'createMfaAuthenticator',
      descMd: '/docs/references/account/create-mfa-authenticator.md',
    },
  })
  async createMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @Project() project: ProjectsDoc,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ): Promise<
    IResponse<
      Doc<{
        secret: string
        uri: string
      }>
    >
  > {
    return this.mfaService.createMfaAuthenticator({
      type,
      project,
      user,
      db,
    })
  }

  @Put('authenticators/:type', {
    summary: 'Update authenticator (confirmation)',
    model: Models.ACCOUNT,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updateMfaAuthenticator',
      descMd: '/docs/references/account/update-mfa-authenticator.md',
    },
  })
  async verifyMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @Body() { otp }: VerifyMfaAuthenticatorDTO,
    @User() user: UsersDoc,
    @Session() session: SessionsDoc,
    @AuthDatabase() db: Database,
  ): Promise<IResponse<UsersDoc>> {
    return this.mfaService.verifyMfaAuthenticator({
      type,
      otp,
      user,
      session,
      db,
    })
  }

  @Post('recovery-codes', {
    summary: 'Create MFA recovery codes',
    model: Models.MFA_RECOVERY_CODES,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'createMfaRecoveryCodes',
      descMd: '/docs/references/account/create-mfa-recovery-codes.md',
    },
  })
  async createMfaRecoveryCodes(
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ): Promise<
    IResponse<
      Doc<{
        recoveryCodes: string[]
      }>
    >
  > {
    return this.mfaService.createMfaRecoveryCodes({ user, db })
  }

  @Patch('recovery-codes', {
    summary: 'Update MFA recovery codes (regenerate)',
    model: Models.MFA_RECOVERY_CODES,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'updateMfaRecoveryCodes',
      descMd: '/docs/references/account/update-mfa-recovery-codes.md',
    },
  })
  async updateMfaRecoveryCodes(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
  ): Promise<
    IResponse<
      Doc<{
        recoveryCodes: string[]
      }>
    >
  > {
    return this.mfaService.updateMfaRecoveryCodes({ db, user })
  }

  @Get('recovery-codes', {
    summary: 'List MFA recovery codes',
    model: Models.MFA_RECOVERY_CODES,
    sdk: {
      name: 'getMfaRecoveryCodes',
      descMd: '/docs/references/account/get-mfa-recovery-codes.md',
    },
  })
  async getMfaRecoveryCodes(@User() user: UsersDoc): Promise<
    IResponse<{
      recoveryCodes: string[]
    }>
  > {
    const mfaRecoveryCodes = user.get('mfaRecoveryCodes', [])

    if (!mfaRecoveryCodes || mfaRecoveryCodes.length === 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND)
    }

    return {
      recoveryCodes: mfaRecoveryCodes,
    }
  }

  @Delete('authenticators/:type', {
    summary: 'Delete authenticator',
    model: Models.NONE,
    audit: {
      key: 'user.update',
      resource: 'user/{res.$id}',
      userId: '{res.$id}',
    },
    sdk: {
      name: 'deleteMfaAuthenticator',
      descMd: '/docs/references/account/delete-mfa-authenticator.md',
    },
  })
  async deleteMfaAuthenticator(
    @Param() { type }: MfaAuthenticatorTypeParamDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
  ): Promise<void> {
    return this.mfaService.deleteMfaAuthenticator({
      type,
      user,
      db,
    })
  }

  @Post('challenge', {
    summary: 'Create MFA challenge',
    model: Models.MFA_CHALLENGE,
    throttle: {
      limit: 10,
      key: 'ip:{ip},userId:{userId}',
    },
    audit: {
      key: 'challenge.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'createMfaChallenge',
      descMd: '/docs/references/account/create-mfa-challenge.md',
    },
  })
  async createMfaChallenge(
    @Body() { factor }: CreateMfaChallengeDTO,
    @Req() request: NuvixRequest,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Project() project: ProjectsDoc,
    @Locale() locale: LocaleTranslator,
  ): Promise<IResponse<ChallengesDoc>> {
    return this.mfaService.createMfaChallenge({
      factor,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      user,
      db,
      project,
      locale,
    })
  }

  @Put('challenge', {
    summary: 'Update MFA challenge (confirmation)',
    model: Models.SESSION,
    throttle: {
      limit: 10,
      key: 'challengeId:{param-challengeId}',
    },
    audit: {
      key: 'challenge.update',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
  })
  async updateMfaChallenge(
    @Body() input: VerifyMfaChallengeDTO,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Session() session: SessionsDoc,
  ): Promise<IResponse<SessionsDoc>> {
    return this.mfaService.updateMfaChallenge({
      ...input,
      user,
      db,
      session,
    })
  }
}
