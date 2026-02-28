import { Body, Controller, Param, Req, UseInterceptors } from '@nestjs/common'
import { Delete, Get, Patch, Post, Put } from '@nuvix/core'
import {
  Auth,
  AuthType,
  Ctx,
  Namespace,
  Scope,
  User,
} from '@nuvix/core/decorators'
import { Exception } from '@nuvix/core/extend/exception'
import { Models, RequestContext } from '@nuvix/core/helpers'
import { ApiInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import { type Doc } from '@nuvix/db'
import type { IResponse } from '@nuvix/utils'
import type { ChallengesDoc, SessionsDoc, UsersDoc } from '@nuvix/utils/types'
import {
  CreateMfaChallengeDTO,
  MfaAuthenticatorTypeParamDTO,
  UpdateAccountMfaDTO,
  VerifyMfaAuthenticatorDTO,
  VerifyMfaChallengeDTO,
} from './DTO/mfa.dto'
import { MfaService } from './mfa.service'

@Controller({ version: ['1'], path: 'account/mfa' })
@Namespace('account')
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
    @Ctx() ctx: RequestContext,
  ): Promise<IResponse<UsersDoc>> {
    return this.mfaService.updateMfa({
      mfa,
      session: ctx.session,
      user,
    })
  }

  @Get('factors', {
    summary: 'List factors',
    model: Models.MFA_FACTORS,
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
    @User() user: UsersDoc,
    @Ctx() ctx: RequestContext,
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
      ctx,
      user,
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
    @Ctx() { getSession }: RequestContext,
  ): Promise<IResponse<UsersDoc>> {
    return this.mfaService.verifyMfaAuthenticator({
      type,
      otp,
      user,
      session: getSession(),
    })
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
  ): Promise<void> {
    return this.mfaService.deleteMfaAuthenticator({
      type,
      user,
    })
  }

  @Post('recovery-codes', {
    summary: 'Create MFA recovery codes',
    model: Models.MFA_RECOVERY_CODES,
    secretFields: ['recoveryCodes'],
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
  async createMfaRecoveryCodes(@User() user: UsersDoc): Promise<
    IResponse<
      Doc<{
        recoveryCodes: string[]
      }>
    >
  > {
    return this.mfaService.createMfaRecoveryCodes({ user })
  }

  @Patch('recovery-codes', {
    summary: 'Update MFA recovery codes (regenerate)',
    model: Models.MFA_RECOVERY_CODES,
    secretFields: ['recoveryCodes'],
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
  async updateMfaRecoveryCodes(@User() user: UsersDoc): Promise<
    IResponse<
      Doc<{
        recoveryCodes: string[]
      }>
    >
  > {
    return this.mfaService.updateMfaRecoveryCodes({ user })
  }

  @Get('recovery-codes', {
    summary: 'List MFA recovery codes',
    model: Models.MFA_RECOVERY_CODES,
    secretFields: ['recoveryCodes'],
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

  @Post('challenge', {
    summary: 'Create MFA challenge',
    model: Models.MFA_CHALLENGE,
    throttle: {
      limit: 10,
      key: 'url:{url},userId:{userId}',
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
  ): Promise<IResponse<ChallengesDoc>> {
    return this.mfaService.createMfaChallenge({
      factor,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      user,
      ctx: request.context,
    })
  }

  @Put('challenge', {
    summary: 'Update MFA challenge (confirmation)',
    model: Models.SESSION,
    throttle: {
      limit: 10,
      key: 'url:{url},challengeId:{body-challengeId}',
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
    @Ctx() { getSession }: RequestContext,
  ): Promise<IResponse<SessionsDoc>> {
    return this.mfaService.updateMfaChallenge({
      ...input,
      user,
      session: getSession(),
    })
  }
}
