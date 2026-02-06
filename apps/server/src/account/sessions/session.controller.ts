import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
  Session,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Delete, Get, Patch, Post, Put } from '@nuvix/core'
import {
  Auth,
  AuthDatabase,
  AuthType,
  Locale,
  Namespace,
  Project,
  User,
} from '@nuvix/core/decorators'
import { LocaleTranslator, Models } from '@nuvix/core/helpers'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import { Database, type Doc } from '@nuvix/db'
import type { IListResponse, IResponse } from '@nuvix/utils'
import type { ProjectsDoc, SessionsDoc, UsersDoc } from '@nuvix/utils/types'
import {
  CreateEmailSessionDTO,
  CreateOAuth2SessionDTO,
  CreateSessionDTO,
  OAuth2CallbackDTO,
  type OAuth2CallbackParamDTO,
  type ProviderParamDTO,
  type SessionsParamDTO,
} from './DTO/session.dto'
import {
  CreateEmailTokenDTO,
  CreateMagicURLTokenDTO,
  CreateOAuth2TokenDTO,
  CreatePhoneTokenDTO,
} from './DTO/token.dto'
import { SessionService } from './session.service'

@Namespace('account')
@UseGuards(ProjectGuard)
@Controller({ version: ['1'], path: 'account' })
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.SESSION, AuthType.JWT])
export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  @Get('sessions', {
    summary: 'List Sessions',
    scopes: 'account',
    model: { type: Models.SESSION, list: true },
    sdk: {
      name: 'listSessions',
      descMd: '/docs/references/account/list-sessions.md',
    },
  })
  async getSessions(
    @User() user: UsersDoc,
    @Locale() locale: LocaleTranslator,
  ): Promise<IListResponse<SessionsDoc>> {
    return this.sessionService.getSessions(user, locale)
  }

  @Delete('sessions', {
    summary: 'Delete sessions',
    scopes: 'account',
    model: Models.NONE,
    throttle: 100,
    audit: {
      key: 'sessions.delete',
      resource: 'user/{user.$id}',
    },
    sdk: {
      name: 'deleteSessions',
      descMd: '/docs/references/account/delete-sessions.md',
    },
  })
  async deleteSessions(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ): Promise<void> {
    return this.sessionService.deleteSessions(
      db,
      user,
      project,
      locale,
      request,
      response,
    )
  }

  @Get('sessions/:sessionId', {
    summary: 'Get session',
    scopes: 'account',
    model: Models.SESSION,
    sdk: {
      name: 'getSession',
      descMd: '/docs/references/account/get-session.md',
    },
  })
  async getSession(
    @User() user: UsersDoc,
    @Param() params: SessionsParamDTO,
    @Locale() locale: LocaleTranslator,
  ): Promise<IResponse<SessionsDoc>> {
    return this.sessionService.getSession(user, params.sessionId, locale)
  }

  @Delete('sessions/:sessionId', {
    summary: 'Delete session',
    scopes: 'account',
    model: Models.NONE,
    throttle: 100,
    audit: {
      key: 'session.delete',
      resource: 'user/{user.$id}',
    },
    sdk: {
      name: 'deleteSession',
      descMd: '/docs/references/account/delete-session.md',
    },
  })
  async deleteSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Param() params: SessionsParamDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
    @Session() session: SessionsDoc,
  ): Promise<void> {
    let sessionId = params.sessionId
    if (params.sessionId === 'current') {
      sessionId = session.getId()
    }
    return this.sessionService.deleteSession(
      db,
      user,
      project,
      sessionId,
      request,
      response,
      locale,
    )
  }

  @Patch('sessions/:sessionId', {
    summary: 'Update session',
    scopes: 'account',
    model: Models.SESSION,
    throttle: 10,
    audit: {
      key: 'session.update',
      resource: 'user/{res.userId}',
    },
    sdk: {
      name: 'updateSession',
      descMd: '/docs/references/account/update-session.md',
    },
  })
  async updateSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Param() params: SessionsParamDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<SessionsDoc>> {
    return this.sessionService.updateSession(
      db,
      user,
      params.sessionId,
      project,
    )
  }

  @Post(['sessions/email', 'sessions'], {
    summary: 'Create email password session',
    scopes: 'sessions.create',
    model: Models.SESSION,
    auth: [],
    throttle: {
      limit: 10,
      key: 'email:{param-email}',
      configKey: 'create_email_session',
    },
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'createEmailPasswordSession',
      descMd: '/docs/references/account/create-session-email-password.md',
    },
  })
  async createEmailSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateEmailSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<SessionsDoc>> {
    return this.sessionService.createEmailSession(
      db,
      user,
      input,
      request,
      response,
      locale,
      project,
    )
  }

  @Post('sessions/anonymous', {
    summary: 'Create anonymous session',
    scopes: 'sessions.create',
    model: Models.SESSION,
    auth: [],
    throttle: {
      limit: 50,
      key: 'ip:{ip}',
      configKey: 'create_anonymous_session',
    },
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'createAnonymousSession',
      descMd: '/docs/references/account/create-session-anonymous.md',
    },
  })
  async createAnonymousSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<SessionsDoc>> {
    return this.sessionService.createAnonymousSession({
      user,
      request,
      response,
      locale,
      project,
      db: db,
    })
  }

  @Post('sessions/token', {
    summary: 'Create session',
    scopes: 'sessions.create',
    model: Models.SESSION,
    auth: [],
    throttle: {
      limit: 10,
      key: 'ip:{ip},userId:{param-userId}',
      configKey: 'create_token_session',
    },
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'createSession',
      descMd: '/docs/references/account/create-session.md',
    },
  })
  async createSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<SessionsDoc>> {
    return this.sessionService.createSession({
      user,
      input,
      request,
      response,
      locale,
      project,
      db,
    })
  }

  @Get('sessions/oauth2/:provider', {
    summary: 'Create OAuth2 session',
    scopes: 'sessions.create',
    auth: [],
    throttle: {
      limit: 50,
      key: 'ip:{ip}',
      configKey: 'create_oauth2_session',
    },
    sdk: {
      name: 'createOAuth2Session',
      code: HttpStatus.FOUND,
      descMd: '/docs/references/account/create-session-oauth2.md',
    },
  })
  async createOAuth2Session(
    @Query() input: CreateOAuth2SessionDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { provider }: ProviderParamDTO,
    @Project() project: ProjectsDoc,
  ): Promise<void> {
    const url = await this.sessionService.createOAuth2Session({
      input,
      request,
      response,
      provider,
      project,
    })

    response
      .status(302)
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(url)
  }

  @Get('sessions/oauth2/callback/:provider/:projectId', {
    summary: 'Get OAuth2 callback',
    scopes: 'public',
    auth: [],
    docs: false,
  })
  async OAuth2Callback(
    @Query() input: OAuth2CallbackDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { projectId, provider }: OAuth2CallbackParamDTO,
  ): Promise<void> {
    const domain = request.host
    const protocol = request.protocol

    const params: Record<string, any> = { ...input }
    params.provider = provider
    params.project = projectId

    response
      .status(302)
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(
        `${protocol}://${domain}/v1/account/sessions/oauth2/${provider}/redirect?${new URLSearchParams(params).toString()}`,
      )
  }

  @Post('sessions/oauth2/callback/:provider/:projectId', {
    summary: 'Get OAuth2 callback',
    scopes: 'public',
    auth: [],
    docs: false,
  })
  async OAuth2CallbackWithProject(
    @Body() input: OAuth2CallbackDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { projectId, provider }: OAuth2CallbackParamDTO,
  ): Promise<void> {
    const domain = request.host
    const protocol = request.protocol

    const params: Record<string, any> = { ...input }
    params.provider = provider
    params.project = projectId

    response
      .status(302)
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(
        `${protocol}://${domain}/v1/account/sessions/oauth2/${provider}/redirect?${new URLSearchParams(params).toString()}`,
      )
  }

  @Get('sessions/oauth2/:provider/redirect', {
    summary: 'Get OAuth2 callback',
    scopes: 'public',
    auth: [],
    throttle: {
      limit: 50,
      key: 'ip:{ip}',
    },
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    docs: false,
  })
  async OAuth2Redirect(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Query() input: OAuth2CallbackDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Project() project: ProjectsDoc,
    @Param() { provider }: ProviderParamDTO,
  ): Promise<void> {
    return this.sessionService.oAuth2Redirect({
      db: db,
      user,
      input,
      provider,
      request,
      response,
      project,
    })
  }

  @Get('tokens/oauth2/:provider', {
    summary: 'Create OAuth2 token',
    scopes: 'sessions.create',
    auth: [],
    throttle: {
      limit: 50,
      key: 'ip:{ip}',
    },
    sdk: {
      name: 'createOAuth2Token',
      descMd: '/docs/references/account/create-token-oauth2.md',
      code: HttpStatus.FOUND,
    },
  })
  async createOAuth2Token(
    @Query() input: CreateOAuth2TokenDTO,
    @Req() request: NuvixRequest,
    @Res() response: NuvixRes,
    @Param() { provider }: ProviderParamDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.sessionService.createOAuth2Token({
      input,
      request,
      response,
      provider,
      project,
    })
  }

  @Post('tokens/magic-url', {
    summary: 'Create magic URL token',
    scopes: 'sessions.create',
    auth: [],
    model: Models.TOKEN,
    throttle: {
      limit: 60,
      key: ({ body, ip }) => [`email:${body.email}`, `ip:${ip}`],
    },
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'createMagicURLToken',
      descMd: '/docs/references/account/create-token-magic-url.md',
    },
  })
  async createMagicURLToken(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateMagicURLTokenDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.sessionService.createMagicURLToken({
      db: db,
      user,
      input,
      request,
      response,
      locale,
      project,
    })
  }

  @Post('tokens/email', {
    summary: 'Create email token(OTP)',
    scopes: 'sessions.create',
    auth: [],
    model: Models.TOKEN,
    throttle: {
      limit: 10,
      key: ({ body, ip }) => [`email:${body.email}`, `ip:${ip}`],
    },
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'createEmailToken',
      descMd: '/docs/references/account/create-token-email.md',
    },
  })
  async createEmailToken(
    @Body() input: CreateEmailTokenDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Project() project: ProjectsDoc,
    @User() user: UsersDoc,
    @AuthDatabase() db: Database,
    @Locale() locale: LocaleTranslator,
  ) {
    return this.sessionService.createEmailToken({
      input,
      request,
      response,
      project,
      user,
      db: db,
      locale,
    })
  }

  @Put('sessions/magic-url', {
    summary: 'Update magic URL session',
    scopes: 'sessions.update',
    auth: [],
    model: Models.SESSION,
    throttle: {
      limit: 10,
      key: 'ip:{ip},userId:{param-userId}',
    },
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'updateMagicURLSession',
      descMd: '/docs/references/account/create-session.md',
    },
  })
  async updateMagicURLSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.sessionService.createSession({
      user,
      input,
      request,
      response,
      locale,
      project,
      db,
    })
  }

  @Put('sessions/phone', {
    summary: 'Update phone session',
    scopes: 'sessions.update',
    auth: [],
    model: Models.SESSION,
    throttle: {
      limit: 10,
      key: 'ip:{ip},userId:{param-userId}',
    },
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'updatePhoneSession',
      descMd: '/docs/references/account/create-session.md',
    },
  })
  async updatePhoneSession(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreateSessionDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.sessionService.createSession({
      user,
      input,
      request,
      response,
      locale,
      project,
      db,
    })
  }

  @Post(['tokens/phone', 'sessions/phone'], {
    summary: 'Create phone token',
    scopes: 'sessions.create',
    auth: [],
    model: Models.SESSION,
    throttle: {
      limit: 10,
      key: ({ body, ip }) => [`phone:${body.phone}`, `ip:${ip}`],
    },
    audit: {
      key: 'session.create',
      resource: 'user/{res.userId}',
      userId: '{res.userId}',
    },
    sdk: {
      name: 'createPhoneToken',
      descMd: '/docs/references/account/create-token-phone.md',
    },
  })
  async createPhoneToken(
    @AuthDatabase() db: Database,
    @User() user: UsersDoc,
    @Body() input: CreatePhoneTokenDTO,
    @Req() request: NuvixRequest,
    @Res({ passthrough: true }) response: NuvixRes,
    @Locale() locale: LocaleTranslator,
    @Project() project: ProjectsDoc,
  ) {
    return this.sessionService.createPhoneToken({
      db: db,
      user,
      input,
      request,
      response,
      locale,
      project,
    })
  }

  @Post(['jwts', 'jwt'], {
    summary: 'Create JWT',
    scopes: 'account',
    auth: AuthType.JWT,
    model: Models.JWT,
    throttle: {
      limit: 100,
      key: 'userId:{userId}',
    },
    sdk: {
      name: 'createJWT',
      descMd: '/docs/references/account/create-jwt.md',
    },
  })
  async createJWT(
    @User() user: UsersDoc,
    @Res({ passthrough: true }) response: NuvixRes,
  ): Promise<Doc<{ jwt: string }>> {
    return this.sessionService.createJWT(user, response)
  }
}
