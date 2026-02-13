import * as fs from 'node:fs/promises'
import path from 'node:path'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService, CoreService } from '@nuvix/core'
import type { SmtpConfig } from '@nuvix/core/config'
import { type OAuthProviders, type OAuthProviderType } from '@nuvix/core/config'
import { Exception } from '@nuvix/core/extend/exception'
import { Auth, Detector, LocaleTranslator, Models } from '@nuvix/core/helpers'
import { getOAuth2Class, OAuth2 } from '@nuvix/core/OAuth2'
import {
  DeletesJobData,
  MailJob,
  MailQueueOptions,
  MessagingJob,
  MessagingJobInternalData,
} from '@nuvix/core/resolvers'
import { URLValidator } from '@nuvix/core/validators'
import {
  Authorization,
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix/db'
import {
  AppEvents,
  AuthFactor,
  configuration,
  DeleteType,
  type HashAlgorithm,
  MessageType,
  QueueFor,
  SessionProvider,
  TokenType,
} from '@nuvix/utils'
import { PhraseGenerator } from '@nuvix/utils/auth'
import type {
  ProjectsDoc,
  Sessions,
  SessionsDoc,
  TargetsDoc,
  Tokens,
  UsersDoc,
} from '@nuvix/utils/types'
import { Queue } from 'bullmq'
import * as Template from 'handlebars'
import { CountryResponse, Reader } from 'maxmind'
import {
  CreateEmailSessionDTO,
  CreateOAuth2SessionDTO,
  CreateSessionDTO,
  OAuth2CallbackDTO,
} from './DTO/session.dto'
import {
  CreateEmailTokenDTO,
  CreateMagicURLTokenDTO,
  CreateOAuth2TokenDTO,
  CreatePhoneTokenDTO,
} from './DTO/token.dto'

@Injectable()
export class SessionService {
  private readonly geodb: Reader<CountryResponse>

  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
    private eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
    @InjectQueue(QueueFor.MAILS)
    private readonly mailsQueue: Queue<MailQueueOptions>,
    @InjectQueue(QueueFor.DELETES)
    private readonly deletesQueue: Queue<DeletesJobData, unknown, DeleteType>,
    @InjectQueue(QueueFor.MESSAGING)
    private readonly messagingQueue: Queue<
      MessagingJobInternalData,
      unknown,
      MessagingJob
    >,
  ) {
    this.geodb = this.coreService.getGeoDb()
  }

  private static readonly oauthDefaultSuccess = '/auth/oauth2/success'
  private static readonly oauthDefaultFailure = '/auth/oauth2/failure'

  /**
   * Get User's Sessions
   */
  async getSessions(user: UsersDoc, locale: LocaleTranslator) {
    const sessions = user.get('sessions', []) as SessionsDoc[]
    const current = Auth.sessionVerify(sessions, Auth.secret)

    const updatedSessions = sessions.map(session => {
      const countryName = locale.getText(
        `countries${session.get('countryCode', '')?.toLowerCase()}`,
        locale.getText('locale.country.unknown'),
      )

      session.set('countryName', countryName)
      session.set('current', current === session.getId())
      session.set('secret', session.get('secret', ''))

      return session
    })

    return {
      data: updatedSessions,
      total: updatedSessions.length,
    }
  }

  /**
   * Delete User's Session
   */
  async deleteSessions(
    db: Database,
    user: UsersDoc,
    project: ProjectsDoc,
    locale: LocaleTranslator,
    request: NuvixRequest,
    response: NuvixRes,
  ) {
    const protocol = request.protocol
    const sessions = user.get('sessions', []) as SessionsDoc[]

    for (const session of sessions) {
      await db.deleteDocument('sessions', session.getId())

      if (!request.domainVerification) {
        response.header('X-Fallback-Cookies', JSON.stringify([]))
      }

      session.set('current', false)
      session.set(
        'countryName',
        locale.getText(
          `countries${session.get('countryCode', '')?.toLowerCase()}`,
          locale.getText('locale.country.unknown'),
        ),
      )

      if (session.get('secret') === Auth.hash(Auth.secret)) {
        session.set('current', true)

        // If current session, delete the cookies too
        response.cookie(Auth.cookieName, '', {
          expires: new Date(0),
          path: '/',
          domain: Auth.cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: Auth.cookieSamesite,
        })
      }
    }

    await this.deletesQueue.addBulk(
      [...sessions].map(s => ({
        name: DeleteType.SESSION_TARGETS,
        data: {
          project,
          document: s,
        },
      })),
    )

    await db.purgeCachedDocument('users', user.getId())

    this.eventEmitter.emit(AppEvents.SESSION_DELETE, {
      userId: user.getId(),
    })

    return
  }

  /**
   * Get a Session
   */
  async getSession(
    user: UsersDoc,
    sessionId: string,
    locale: LocaleTranslator,
  ) {
    const sessions = user.get('sessions', []) as SessionsDoc[]
    sessionId =
      sessionId === 'current'
        ? (Auth.sessionVerify(user.get('sessions'), Auth.secret) as string)
        : sessionId

    for (const session of sessions) {
      if (sessionId === session.getId()) {
        const countryName = locale.getText(
          `countries${session.get('countryCode', '')?.toLowerCase()}`,
          locale.getText('locale.country.unknown'),
        )

        session
          .set('current', session.get('secret') === Auth.hash(Auth.secret))
          .set('countryName', countryName)
          .set('secret', session.get('secret', ''))

        return session
      }
    }

    throw new Exception(Exception.USER_SESSION_NOT_FOUND)
  }

  /**
   * Delete a Session
   */
  async deleteSession(
    db: Database,
    user: UsersDoc,
    project: ProjectsDoc,
    sessionId: string,
    request: NuvixRequest,
    response: NuvixRes,
    locale: LocaleTranslator,
  ) {
    const protocol = request.protocol
    const sessions = user.get('sessions', []) as SessionsDoc[]

    for (const session of sessions) {
      if (sessionId !== session.getId()) {
        continue
      }

      await db.deleteDocument('sessions', session.getId())

      session.set('current', false)

      if (session.get('secret') === Auth.hash(Auth.secret)) {
        session.set('current', true)
        session.set(
          'countryName',
          locale.getText(
            `countries${session.get('countryCode', '')?.toLowerCase()}`,
            locale.getText('locale.country.unknown'),
          ),
        )

        response.cookie(Auth.cookieName, '', {
          expires: new Date(0),
          path: '/',
          domain: Auth.cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: Auth.cookieSamesite,
        })

        response.header('X-Fallback-Cookies', JSON.stringify({}))
      }

      await db.purgeCachedDocument('users', user.getId())

      this.eventEmitter.emit(AppEvents.SESSIONS_DELETE, {
        userId: user.getId(),
        sessionId: session.getId(),
        payload: {
          data: session,
          type: Models.SESSION,
        },
      })

      await this.deletesQueue.add(DeleteType.SESSION_TARGETS, {
        project,
        document: session,
      })

      return
    }

    throw new Exception(Exception.USER_SESSION_NOT_FOUND)
  }

  /**
   * Update a Session
   */
  async updateSession(
    db: Database,
    user: UsersDoc,
    sessionId: string,
    project: ProjectsDoc,
  ) {
    sessionId =
      sessionId === 'current'
        ? (Auth.sessionVerify(user.get('sessions'), Auth.secret) as string)
        : sessionId

    const sessions = user.get('sessions', []) as SessionsDoc[]
    let session: SessionsDoc | null = null

    for (const value of sessions) {
      if (sessionId === value.getId()) {
        session = value
        break
      }
    }

    if (session === null) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND)
    }

    const auths = project.get('auths', {})

    const authDuration = auths.duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
    session.set('expire', new Date(Date.now() + authDuration * 1000))

    const provider: string = session.get('provider', '')
    const refreshToken = session.get('providerRefreshToken', '')

    const OAuth2Class = await getOAuth2Class(provider)
    if (provider) {
      const providerInfo = this.getProviderConfig(project, provider)
      const appId = providerInfo.appId
      const appSecret = providerInfo.secret

      const oauth2: OAuth2 = new OAuth2Class(appId, appSecret, '', [], [])
      await oauth2.refreshTokens(refreshToken)
      const accessToken = await oauth2.getAccessToken('')

      session
        .set('providerAccessToken', accessToken)
        .set('providerRefreshToken', accessToken)
        .set(
          'providerAccessTokenExpiry',
          new Date(Date.now() + (await oauth2.getAccessTokenExpiry('')) * 1000),
        )
    }

    await db.updateDocument('sessions', sessionId, session)
    await db.purgeCachedDocument('users', user.getId())

    this.eventEmitter.emit(AppEvents.SESSION_UPDATE, {
      userId: user.getId(),
      sessionId: session.getId(),
      payload: {
        data: session,
        type: Models.SESSION,
      },
    })

    return session
  }

  /**
   * Create a new session for the user using Email & Password
   */
  async createEmailSession(
    db: Database,
    user: UsersDoc,
    input: CreateEmailSessionDTO,
    request: NuvixRequest,
    response: NuvixRes,
    locale: LocaleTranslator,
    project: ProjectsDoc,
  ) {
    const email = input.email.toLowerCase()
    const protocol = request.protocol

    const profile = await db.findOne('users', [Query.equal('email', [email])])

    if (
      !profile ||
      !profile.get('passwordUpdate') ||
      !(await Auth.passwordVerify(
        input.password,
        profile.get('password'),
        profile.get('hash') as HashAlgorithm,
        profile.get('hashOptions'),
      ))
    ) {
      throw new Exception(Exception.USER_INVALID_CREDENTIALS)
    }

    if (profile.get('status') === false) {
      throw new Exception(Exception.USER_BLOCKED)
    }

    user.setAll(profile.toObject())

    const auths = project.get('auths', {})
    const duration = auths.duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
    const record = this.geodb.get(request.ip)
    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)

    const session = new Doc<Sessions>({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      provider: SessionProvider.EMAIL,
      providerUid: email,
      secret: Auth.hash(secret),
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
      factors: ['password'],
      countryCode: record?.country?.iso_code.toLowerCase(),
      expire: new Date(Date.now() + duration * 1000),
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    })

    Authorization.setRole(Role.user(user.getId()).toString())

    if ((user.get('hash') as HashAlgorithm) !== Auth.DEFAULT_ALGO) {
      user
        .set(
          'password',
          await Auth.passwordHash(
            input.password,
            Auth.DEFAULT_ALGO,
            Auth.DEFAULT_ALGO_OPTIONS,
          ),
        )
        .set('hash', Auth.DEFAULT_ALGO)
        .set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
      await db.updateDocument('users', user.getId(), user)
    }

    await db.purgeCachedDocument('users', user.getId())

    session.set('$permissions', [
      Permission.read(Role.user(user.getId())),
      Permission.update(Role.user(user.getId())),
      Permission.delete(Role.user(user.getId())),
    ])
    const createdSession = await db.createDocument('sessions', session)

    if (!request.domainVerification) {
      response.header(
        'X-Fallback-Cookies',
        JSON.stringify({
          [Auth.cookieName]: Auth.encodeSession(user.getId(), secret),
        }),
      )
    }

    const expire = new Date(Date.now() + duration * 1000)
    response
      .cookie(Auth.cookieName, Auth.encodeSession(user.getId(), secret), {
        expires: expire,
        path: '/',
        secure: protocol === 'https',
        domain: Auth.cookieDomain,
        sameSite: Auth.cookieSamesite,
        httpOnly: true,
      })
      .status(201)

    const countryName = locale.getText(
      `countries${createdSession.get('countryCode', '')?.toLowerCase()}`,
      locale.getText('locale.country.unknown'),
    )

    createdSession
      .set('current', true)
      .set('countryName', countryName)
      .set('secret', Auth.encodeSession(user.getId(), secret))

    this.eventEmitter.emit(AppEvents.SESSION_CREATE, {
      userId: user.getId(),
      sessionId: createdSession.getId(),
      payload: {
        data: createdSession,
        type: Models.SESSION,
      },
    })

    if (project.get('auths', {}).sessionAlerts ?? false) {
      const sessionCount = await db.count('sessions', [
        Query.equal('userId', [user.getId()]),
      ])

      if (sessionCount !== 1) {
        await this.sendSessionAlert(locale, user, project, createdSession)
      }
    }

    return createdSession
  }

  async createAnonymousSession({
    request,
    response,
    locale,
    user,
    project,
    db,
  }: {
    request: NuvixRequest
    response: NuvixRes
    locale: LocaleTranslator
    user: UsersDoc
    project: ProjectsDoc
    db: Database
  }) {
    const protocol = request.protocol
    const limit = project.get('auths', {}).limit ?? 0
    const maxUsers = this.appConfig.appLimits.users

    if (limit !== 0) {
      const total = await db.count('users', [], maxUsers)

      if (total >= limit) {
        throw new Exception(Exception.USER_COUNT_EXCEEDED)
      }
    }

    const userId = ID.unique()
    user.setAll({
      $id: userId,
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      emailVerification: false,
      status: true,
      hash: Auth.DEFAULT_ALGO,
      hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
      registration: new Date(),
      reset: false,
      mfa: false,
      prefs: {},
      search: userId,
      accessedAt: new Date(),
    })
    user.delete('$sequence')
    await Authorization.skip(() => db.createDocument('users', user))

    // Create session token
    const duration =
      project.get('auths', {}).duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
    const record = this.geodb.get(request.ip)
    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)

    const session = new Doc({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      provider: SessionProvider.ANONYMOUS,
      secret: Auth.hash(secret),
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
      factors: ['anonymous'],
      countryCode: record?.country?.iso_code.toLowerCase(),
      expire: new Date(Date.now() + duration * 1000),
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    }) as SessionsDoc

    Authorization.setRole(Role.user(user.getId()).toString())

    session.set('$permissions', [
      Permission.read(Role.user(user.getId())),
      Permission.update(Role.user(user.getId())),
      Permission.delete(Role.user(user.getId())),
    ])
    const createdSession = await db.createDocument('sessions', session)

    await db.purgeCachedDocument('users', user.getId())

    this.eventEmitter.emit(AppEvents.USER_CREATE, {
      userId: user.getId(),
      sessionId: createdSession.getId(),
    })

    if (!request.domainVerification) {
      response.header(
        'X-Fallback-Cookies',
        JSON.stringify({
          [Auth.cookieName]: Auth.encodeSession(user.getId(), secret),
        }),
      )
    }

    const expire = new Date(Date.now() + duration * 1000)

    response
      .cookie(Auth.cookieName, Auth.encodeSession(user.getId(), secret), {
        expires: expire,
        path: '/',
        domain: Auth.cookieDomain,
        secure: protocol === 'https',
        httpOnly: true,
        sameSite: Auth.cookieSamesite,
      })
      .status(201)

    const countryName = locale.getText(
      `countries.${createdSession.get('countryCode', '')?.toLowerCase()}`,
      locale.getText('locale.country.unknown'),
    )

    createdSession
      .set('current', true)
      .set('countryName', countryName)
      .set('secret', Auth.encodeSession(user.getId(), secret))

    return createdSession
  }

  /**
   * Create OAuth2 Session.
   */
  async createOAuth2Session({
    input,
    request,
    response,
    provider,
    project,
  }: {
    input: CreateOAuth2SessionDTO
    request: NuvixRequest
    response: NuvixRes
    project: ProjectsDoc
    provider: OAuthProviders
  }) {
    // TODO: Handle Error Response in HTML format.
    const protocol = request.protocol
    const success = input.success || ''
    const failure = input.failure || ''
    const scopes = input.scopes || []

    const callback = `${protocol}://${request.host}/v1/account/sessions/oauth2/callback/${provider}/${project.getId()}`
    const providerInfo = this.getProviderConfig(project, provider)

    if (!providerInfo.enabled) {
      throw new Exception(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please enable the provider from your ${configuration.app.name} console to continue.`,
      )
    }

    const appId = providerInfo.appId ?? ''
    const appSecret = providerInfo.secret ?? ''

    // if (appSecret && typeof appSecret === 'object' && appSecret.version) {
    //   // TODO: Handle encrypted app secret
    // }

    if (!appId || !appSecret) {
      throw new Exception(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please configure the provider app ID and app secret key from your ${configuration.app.name} console to continue.`,
      )
    }

    const AuthClass = await getOAuth2Class(provider)
    const consoleDomain =
      request.host.split('.').length === 3
        ? `console.${request.host.split('.', 2)[1]}`
        : request.host
    const finalSuccess =
      success ||
      `${protocol}://${consoleDomain}${SessionService.oauthDefaultSuccess}`
    const finalFailure =
      failure ||
      `${protocol}://${consoleDomain}${SessionService.oauthDefaultFailure}`

    const oauth2 = new AuthClass(
      appId,
      appSecret,
      callback,
      {
        success: finalSuccess,
        failure: finalFailure,
        token: false,
      },
      scopes,
    )

    return oauth2.getLoginURL()
  }

  /**
   * Handle OAuth2 Redirect.
   */
  async oAuth2Redirect({
    db,
    user,
    input,
    provider,
    request,
    response,
    project,
  }: {
    db: Database
    user: UsersDoc
    input: OAuth2CallbackDTO
    provider: string
    request: NuvixRequest
    response: NuvixRes
    project: ProjectsDoc
  }) {
    const protocol = request.protocol
    const callback = `${protocol}://${request.host}/v1/account/sessions/oauth2/callback/${provider}/${project.getId()}`
    const defaultState = {
      success: project.get('url', ''),
      failure: '',
    }
    const validateURL = new URLValidator()
    const providerInfo = this.getProviderConfig(project, provider)
    const appId = providerInfo.appId ?? ''
    const appSecret = providerInfo.secret ?? ''
    const providerEnabled = providerInfo.enabled ?? false

    const AuthClass = await getOAuth2Class(provider)
    const oauth2 = new AuthClass(appId, appSecret, callback)

    let state = defaultState
    if (input.state) {
      try {
        state = { ...defaultState, ...oauth2.parseState(input.state) }
      } catch (_error) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Failed to parse login state params as passed from OAuth2 provider',
        )
      }
    }

    if (!validateURL.$valid(state.success)) {
      throw new Exception(Exception.PROJECT_INVALID_SUCCESS_URL)
    }

    if (state.failure && !validateURL.$valid(state.failure)) {
      throw new Exception(Exception.PROJECT_INVALID_FAILURE_URL)
    }

    const failureRedirect = (type: string, message?: string, code?: number) => {
      const exception = new Exception(type, message, code)
      if (state.failure) {
        // Handle failure redirect with error params
        const failureUrl = new URL(state.failure)
        failureUrl.searchParams.set(
          'error',
          JSON.stringify({
            message: exception.message,
            type: exception.getType(),
            code: code ?? exception.getStatus(),
          }),
        )
        response.status(302).redirect(failureUrl.toString())
        return
      }
      throw exception
    }

    if (!providerEnabled) {
      failureRedirect(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please enable the provider from your ${configuration.app.name} console to continue.`,
      )
    }

    if (input.error) {
      let message = `The ${provider} OAuth2 provider returned an error: ${input.error}`
      if (input.error_description) {
        message += `: ${input.error_description}`
      }
      failureRedirect(Exception.USER_OAUTH2_PROVIDER_ERROR, message)
    }

    if (!input.code) {
      failureRedirect(
        Exception.USER_OAUTH2_PROVIDER_ERROR,
        'Missing OAuth2 code. Please contact the team for additional support.',
      )
    }

    // if (appSecret && typeof appSecret === 'object' && appSecret.version) {
    //   // TODO: Handle encrypted app secret decryption
    // }

    let accessToken = ''
    let refreshToken = ''
    let accessTokenExpiry = 0

    try {
      accessToken = await oauth2.getAccessToken(input.code!)
      refreshToken = await oauth2.getRefreshToken(input.code!)
      accessTokenExpiry = await oauth2.getAccessTokenExpiry(input.code!)
    } catch (error: any) {
      failureRedirect(
        Exception.USER_OAUTH2_PROVIDER_ERROR,
        `Failed to obtain access token. The ${provider} OAuth2 provider returned an error: ${error.message}`,
        error.code,
      )
    }

    const oauth2ID = await oauth2.getUserID(accessToken)
    if (!oauth2ID) {
      failureRedirect(Exception.USER_MISSING_ID)
    }

    let name = ''
    const nameOAuth = await oauth2.getUserName(accessToken)
    const userParam = JSON.parse(
      (request.query as { user: string }).user || '{}',
    )
    if (nameOAuth) {
      name = nameOAuth
    } else if (Array.isArray(userParam) || typeof userParam === 'object') {
      const nameParam = userParam.name
      if (
        typeof nameParam === 'object' &&
        nameParam.firstName &&
        nameParam.lastName
      ) {
        name = `${nameParam.firstName} ${nameParam.lastName}`
      }
    }

    const email = await oauth2.getUserEmail(accessToken)

    // Check if this identity is connected to a different user
    let sessionUpgrade = false
    if (!user.empty()) {
      const userId = user.getId()

      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', user.getSequence()),
      ])
      if (!identityWithMatchingEmail.empty()) {
        failureRedirect(Exception.USER_ALREADY_EXISTS)
      }

      const userWithMatchingEmail = await db.find('users', [
        Query.equal('email', [email]),
        Query.notEqual('$id', userId),
      ])
      if (userWithMatchingEmail.length > 0) {
        failureRedirect(Exception.USER_ALREADY_EXISTS)
      }

      sessionUpgrade = true
    }

    const sessions = user.get('sessions', []) as SessionsDoc[]
    const current = Auth.sessionVerify(sessions, Auth.secret)

    if (current) {
      const currentDocument = await db.getDocument('sessions', current)
      if (!currentDocument.empty()) {
        await db.deleteDocument('sessions', currentDocument.getId())
        await db.purgeCachedDocument('users', user.getId())
      }
    }

    if (user.empty()) {
      const session = await db.findOne('sessions', [
        Query.equal('provider', [provider]),
        Query.equal('providerUid', [oauth2ID]),
      ])
      if (!session.empty()) {
        const foundUser = await db.getDocument('users', session.get('userId'))
        user.setAll(foundUser.toObject())
      }
    }

    if (user.empty()) {
      if (!email) {
        failureRedirect(
          Exception.USER_UNAUTHORIZED,
          'OAuth provider failed to return email.',
        )
      }

      const userWithEmail = await db.findOne('users', [
        Query.equal('email', [email]),
      ])
      if (!userWithEmail.empty()) {
        user.setAll(userWithEmail.toObject())
      }

      if (user.empty()) {
        const identity = await db.findOne('identities', [
          Query.equal('provider', [provider]),
          Query.equal('providerUid', [oauth2ID]),
        ])

        if (!identity.empty()) {
          const foundUser = await db.getDocument(
            'users',
            identity.get('userId'),
          )
          user.setAll(foundUser.toObject())
        }
      }

      if (user.empty()) {
        const limit = project.get('auths', {}).limit ?? 0
        const maxUsers = this.appConfig.appLimits.users

        if (limit !== 0) {
          const total = await db.count('users', [], maxUsers)
          if (total >= limit) {
            failureRedirect(Exception.USER_COUNT_EXCEEDED)
          }
        }

        const identityWithMatchingEmail = await db.findOne('identities', [
          Query.equal('providerEmail', [email]),
        ])
        if (!identityWithMatchingEmail.empty()) {
          failureRedirect(Exception.GENERAL_BAD_REQUEST)
        }

        try {
          const userId = ID.unique()
          user.setAll({
            $id: userId,
            $permissions: [
              Permission.read(Role.any()),
              Permission.update(Role.user(userId)),
              Permission.delete(Role.user(userId)),
            ],
            email: email,
            emailVerification: true,
            status: true,
            hash: Auth.DEFAULT_ALGO,
            hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
            registration: new Date(),
            reset: false,
            name: name,
            mfa: false,
            prefs: {},
            search: `${userId} ${email} ${name}`,
            accessedAt: new Date(),
          })
          user.delete('$sequence')

          const userDoc = await Authorization.skip(() =>
            db.createDocument('users', user),
          )

          await db.createDocument(
            'targets',
            new Doc({
              $permissions: [
                Permission.read(Role.user(user.getId())),
                Permission.update(Role.user(user.getId())),
                Permission.delete(Role.user(user.getId())),
              ],
              userId: userDoc.getId(),
              userInternalId: userDoc.getSequence(),
              providerType: MessageType.EMAIL,
              identifier: email,
            }),
          )
        } catch (error) {
          if (error instanceof DuplicateException) {
            failureRedirect(Exception.USER_ALREADY_EXISTS)
          }
          throw error
        }
      }
    }

    Authorization.setRole(Role.user(user.getId()).toString())
    Authorization.setRole(Role.users().toString())

    if (user.get('status') === false) {
      failureRedirect(Exception.USER_BLOCKED)
    }

    let identity = await db.findOne('identities', [
      Query.equal('userInternalId', [user.getSequence()]),
      Query.equal('provider', [provider]),
      Query.equal('providerUid', [oauth2ID]),
    ])

    if (identity.empty()) {
      const identitiesWithMatchingEmail = await db.find('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', user.getSequence()),
      ])
      if (identitiesWithMatchingEmail.length > 0) {
        failureRedirect(Exception.GENERAL_BAD_REQUEST)
      }

      identity = (await db.createDocument(
        'identities',
        new Doc({
          $id: ID.unique(),
          $permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(user.getId())),
            Permission.delete(Role.user(user.getId())),
          ],
          userInternalId: user.getSequence(),
          userId: user.getId(),
          provider: provider,
          providerUid: oauth2ID,
          providerEmail: email,
          providerAccessToken: accessToken,
          providerRefreshToken: refreshToken,
          providerAccessTokenExpiry: new Date(
            Date.now() + accessTokenExpiry * 1000,
          ),
        }),
      )) as any
    } else {
      identity
        .set('providerAccessToken', accessToken)
        .set('providerRefreshToken', refreshToken)
        .set(
          'providerAccessTokenExpiry',
          new Date(Date.now() + accessTokenExpiry * 1000),
        )
      await db.updateDocument('identities', identity.getId(), identity)
    }

    if (!user.get('email')) {
      user.set('email', email)
    }

    if (!user.get('name')) {
      user.set('name', name)
    }

    user.set('status', true)
    await db.updateDocument('users', user.getId(), user)

    const duration =
      project.get('auths', {}).duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
    const expire = new Date(Date.now() + duration * 1000)

    const parsedState = new URL(state.success)
    const query = new URLSearchParams(parsedState.search)

    // If token param is set, return token in query string
    if ((state as any).token) {
      const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_OAUTH2)
      const token = new Doc<Tokens>({
        $id: ID.unique(),
        userId: user.getId(),
        userInternalId: user.getSequence(),
        type: TokenType.OAUTH2,
        secret: Auth.hash(secret),
        expire: expire,
        userAgent: request.headers['user-agent'] || 'UNKNOWN',
        ip: request.ip,
      })

      await db.createDocument(
        'tokens',
        token.set('$permissions', [
          Permission.read(Role.user(user.getId())),
          Permission.update(Role.user(user.getId())),
          Permission.delete(Role.user(user.getId())),
        ]),
      )

      query.set('secret', secret)
      query.set('userId', user.getId())
    } else {
      // Create session
      const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
      const record = this.geodb.get(request.ip)
      const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)

      const session = new Doc<Sessions>({
        $id: ID.unique(),
        userId: user.getId(),
        userInternalId: user.getSequence(),
        provider: provider,
        providerUid: oauth2ID,
        providerAccessToken: accessToken,
        providerRefreshToken: refreshToken,
        providerAccessTokenExpiry: new Date(
          Date.now() + accessTokenExpiry * 1000,
        ),
        secret: Auth.hash(secret),
        userAgent: request.headers['user-agent'] || 'UNKNOWN',
        ip: request.ip,
        factors: ['email', 'oauth2'],
        countryCode: record?.country?.iso_code.toLowerCase(),
        expire: expire,
        ...detector.getOS(),
        ...detector.getClient(),
        ...detector.getDevice(),
      })

      const createdSession = await db.createDocument(
        'sessions',
        session.set('$permissions', [
          Permission.read(Role.user(user.getId())),
          Permission.update(Role.user(user.getId())),
          Permission.delete(Role.user(user.getId())),
        ]),
      )

      if (!request.domainVerification) {
        response.header(
          'X-Fallback-Cookies',
          JSON.stringify({
            [Auth.cookieName]: Auth.encodeSession(user.getId(), secret),
          }),
        )
      }

      if (parsedState.pathname === SessionService.oauthDefaultSuccess) {
        query.set('project', project.getId())
        query.set('domain', Auth.cookieDomain)
        query.set('key', Auth.cookieName)
        query.set('secret', Auth.encodeSession(user.getId(), secret))
      }

      response.cookie(
        Auth.cookieName,
        Auth.encodeSession(user.getId(), secret),
        {
          expires: expire,
          path: '/',
          domain: Auth.cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: Auth.cookieSamesite,
        },
      )

      if (sessionUpgrade) {
        const targets = user.get('targets', []) as TargetsDoc[]
        for (const target of targets) {
          if (target.get('providerType') !== 'push') {
            continue
          }
          target
            .set('sessionId', createdSession.getId())
            .set('sessionInternalId', createdSession.getSequence())
          await db.updateDocument('targets', target.getId(), target)
        }
      }

      this.eventEmitter.emit(AppEvents.SESSION_CREATE, {
        userId: user.getId(),
        sessionId: createdSession.getId(),
        payload: {
          data: createdSession,
          type: Models.SESSION,
        },
      })
    }

    await db.purgeCachedDocument('users', user.getId())

    parsedState.search = query.toString()
    const finalSuccessUrl = parsedState.toString()

    response
      .status(302)
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(finalSuccessUrl)
  }

  /**
   * Create oAuth2 Token.
   */
  async createOAuth2Token({
    input,
    request,
    response,
    provider,
    project,
  }: {
    input: CreateOAuth2TokenDTO
    request: NuvixRequest
    response: NuvixRes
    provider: OAuthProviders
    project: ProjectsDoc
  }) {
    const protocol = request.protocol
    const success = input.success || ''
    const failure = input.failure || ''
    const scopes = input.scopes || []

    const callback = `${protocol}://${request.host}/v1/account/sessions/oauth2/callback/${provider}/${project.getId()}`
    const providerInfo = this.getProviderConfig(project, provider)
    const providerEnabled = providerInfo.enabled ?? false

    if (!providerEnabled) {
      throw new Exception(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please enable the provider from your ${configuration.app.name} console to continue.`,
      )
    }

    const appId = providerInfo.appId ?? ''
    const appSecret = providerInfo.secret ?? ''

    // if (appSecret && typeof appSecret === 'object' && appSecret.version) {
    //   // TODO: Handle encrypted app secret decryption
    // }

    if (!appId || !appSecret) {
      throw new Exception(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please configure the provider app ID and app secret key from your ${configuration.app.name} console to continue.`,
      )
    }

    const AuthClass = await getOAuth2Class(provider)
    if (!AuthClass) {
      throw new Exception(Exception.PROJECT_PROVIDER_UNSUPPORTED)
    }

    const consoleDomain =
      request.host.split('.').length === 3
        ? `console.${request.host.split('.', 2)[1]}`
        : request.host
    const finalSuccess =
      success ||
      `${protocol}://${consoleDomain}${SessionService.oauthDefaultSuccess}`
    const finalFailure =
      failure ||
      `${protocol}://${consoleDomain}${SessionService.oauthDefaultFailure}`

    const oauth2 = new AuthClass(
      appId,
      appSecret,
      callback,
      {
        success: finalSuccess,
        failure: finalFailure,
        token: true,
      },
      scopes,
    )

    response
      .status(302)
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(oauth2.getLoginURL())
  }

  /**
   * Create Magic-URL Token.
   */
  async createMagicURLToken({
    db,
    user,
    input,
    request,
    response,
    locale,
    project,
  }: {
    db: Database
    user: UsersDoc
    input: CreateMagicURLTokenDTO
    request: NuvixRequest
    response: NuvixRes
    locale: LocaleTranslator
    project: ProjectsDoc
  }) {
    if (!this.appConfig.getSmtpConfig().host) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled')
    }

    const {
      userId,
      email,
      url: inputUrl = '',
      phrase: inputPhrase = false,
    } = input
    let url = inputUrl
    let phrase: string

    if (inputPhrase === true) {
      phrase = PhraseGenerator.generate()
    }

    const result = await db.findOne('users', [Query.equal('email', [email])])
    if (!result.empty()) {
      user.setAll(result.toObject())
    } else {
      const limit = project.get('auths', {}).limit ?? 0
      const maxUsers = this.appConfig.appLimits.users

      if (limit !== 0) {
        const total = await db.count('users', [], maxUsers)

        if (total >= limit) {
          throw new Exception(Exception.USER_COUNT_EXCEEDED)
        }
      }

      // Makes sure this email is not already used in another identity
      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ])
      if (!identityWithMatchingEmail.empty()) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS)
      }

      const finalUserId = userId === 'unique()' ? ID.unique() : userId

      user.setAll({
        $id: finalUserId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(finalUserId)),
          Permission.delete(Role.user(finalUserId)),
        ],
        email: email,
        emailVerification: false,
        status: true,
        hash: Auth.DEFAULT_ALGO,
        hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
        registration: new Date(),
        reset: false,
        mfa: false,
        prefs: {},
        search: [finalUserId, email].join(' '),
        accessedAt: new Date(),
      })

      user.delete('$sequence')
      await Authorization.skip(() => db.createDocument('users', user))
    }

    const tokenSecret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_MAGIC_URL)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000)

    const token = new Doc({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      type: TokenType.MAGIC_URL,
      secret: Auth.hash(tokenSecret), // One way hash encryption to protect DB leak
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    })

    Authorization.setRole(Role.user(user.getId()).toString())

    const createdToken = await db.createDocument(
      'tokens',
      token.set('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    )

    await db.purgeCachedDocument('users', user.getId())

    if (!url) {
      url = `${request.protocol}://${request.host}/console/auth/magic-url`
    }

    // Parse and merge URL query parameters
    const urlObj = new URL(url)
    urlObj.searchParams.set('userId', user.getId())
    urlObj.searchParams.set('secret', tokenSecret)
    urlObj.searchParams.set('expire', expire.toISOString())
    urlObj.searchParams.set('project', project.getId())
    url = urlObj.toString()

    let subject = locale.getText('emails.magicSession.subject')
    const customTemplate =
      project.get('templates', {})[`email.magicSession-${locale.default}`] ?? {}

    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
    const agentOs = detector.getOS()
    const agentClient = detector.getClient()
    const agentDevice = detector.getDevice()

    const templatePath = path.join(
      this.appConfig.assetConfig.templates,
      'email-magic-url.tpl',
    )
    const templateSource = await fs.readFile(templatePath, 'utf8')
    const template = Template.compile(templateSource)

    const emailData = {
      hello: locale.getText('emails.magicSession.hello'),
      optionButton: locale.getText('emails.magicSession.optionButton'),
      buttonText: locale.getText('emails.magicSession.buttonText'),
      optionUrl: locale.getText('emails.magicSession.optionUrl'),
      clientInfo: locale.getText('emails.magicSession.clientInfo'),
      thanks: locale.getText('emails.magicSession.thanks'),
      signature: locale.getText('emails.magicSession.signature'),
      securityPhrase: phrase!
        ? locale.getText('emails.magicSession.securityPhrase')
        : '',
    }

    let body = template(emailData)

    const smtp = project.get('smtp', {}) as SmtpConfig
    const smtpEnabled = smtp.enabled ?? false
    const systemConfig = this.appConfig.get('system')

    let senderEmail = systemConfig.emailAddress || configuration.app.emailTeam
    let senderName =
      systemConfig.emailName || `${configuration.app.name} Server`
    let replyTo = ''

    const smtpServer: SmtpConfig = {} as SmtpConfig
    if (smtpEnabled) {
      if (smtp.senderEmail) {
        senderEmail = smtp.senderEmail
      }
      if (smtp.senderName) {
        senderName = smtp.senderName
      }
      if (smtp.replyTo) {
        replyTo = smtp.replyTo
      }

      smtpServer.host = smtp.host || ''
      smtpServer.port = smtp.port
      smtpServer.username = smtp.username || ''
      smtpServer.password = smtp.password || ''
      smtpServer.secure = smtp.secure ?? false

      if (customTemplate) {
        if (customTemplate.senderEmail) {
          senderEmail = customTemplate.senderEmail
        }
        if (customTemplate.senderName) {
          senderName = customTemplate.senderName
        }
        if (customTemplate.replyTo) {
          replyTo = customTemplate.replyTo
        }

        body = customTemplate.message || body
        subject = customTemplate.subject || subject
      }

      smtpServer.replyTo = replyTo
      smtpServer.senderEmail = senderEmail
      smtpServer.senderName = senderName
    }

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.get('name'),
      project: project.get('name'),
      redirect: url,
      agentDevice: agentDevice.deviceBrand || 'UNKNOWN',
      agentClient: agentClient.clientName || 'UNKNOWN',
      agentOs: agentOs.osName || 'UNKNOWN',
      phrase: phrase! || '',
    }

    await this.mailsQueue.add(MailJob.SEND_EMAIL, {
      email,
      subject,
      body,
      server: smtpServer,
      variables: emailVariables,
    })

    createdToken.set('secret', tokenSecret)

    if (phrase!) {
      createdToken.set('phrase', phrase)
    }

    response.status(201)
    return createdToken
  }

  /**
   * Create Email Token.
   */
  async createEmailToken({
    db,
    user,
    input,
    request,
    response,
    locale,
    project,
  }: {
    db: Database
    user: UsersDoc
    input: CreateEmailTokenDTO
    request: NuvixRequest
    response: NuvixRes
    locale: LocaleTranslator
    project: ProjectsDoc
  }) {
    if (!this.appConfig.getSmtpConfig().host) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled')
    }

    const { userId, email, phrase: inputPhrase = false } = input
    let phrase: string

    if (inputPhrase === true) {
      phrase = PhraseGenerator.generate()
    }

    const result = await db.findOne('users', [Query.equal('email', [email])])
    if (!result.empty()) {
      user.setAll(result.toObject())
    } else {
      const limit = project.get('auths', {}).limit ?? 0
      const maxUsers = this.appConfig.appLimits.users

      if (limit !== 0) {
        const total = await db.count('users', [], maxUsers)

        if (total >= limit) {
          throw new Exception(Exception.USER_COUNT_EXCEEDED)
        }
      }

      // Makes sure this email is not already used in another identity
      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ])
      if (!identityWithMatchingEmail.empty()) {
        throw new Exception(Exception.GENERAL_BAD_REQUEST) // Return a generic bad request to prevent exposing existing accounts
      }

      const finalUserId = userId === 'unique()' ? ID.unique() : userId

      user.setAll({
        $id: finalUserId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(finalUserId)),
          Permission.delete(Role.user(finalUserId)),
        ],
        email: email,
        emailVerification: false,
        status: true,
        hash: Auth.DEFAULT_ALGO,
        hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
        registration: new Date(),
        reset: false,
        prefs: {},
        search: [finalUserId, email].join(' '),
        accessedAt: new Date(),
      })

      user.delete('$sequence')
      await Authorization.skip(() => db.createDocument('users', user))
    }

    const tokenSecret = Auth.codeGenerator(6)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_OTP * 1000)

    const token = new Doc({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      type: TokenType.EMAIL,
      secret: Auth.hash(tokenSecret), // One way hash encryption to protect DB leak
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    })

    Authorization.setRole(Role.user(user.getId()).toString())

    const createdToken = await db.createDocument(
      'tokens',
      token.set('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    )

    await db.purgeCachedDocument('users', user.getId())

    let subject = locale.getText('emails.otpSession.subject')
    const customTemplate =
      project.get('templates', {})[`email.otpSession-${locale.default}`] ?? {}

    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
    const agentOs = detector.getOS()
    const agentClient = detector.getClient()
    const agentDevice = detector.getDevice()

    const templatePath = path.join(
      this.appConfig.assetConfig.templates,
      'email-otp.tpl',
    )
    const templateSource = await fs.readFile(templatePath, 'utf8')
    const template = Template.compile(templateSource)

    const emailData = {
      hello: locale.getText('emails.otpSession.hello'),
      description: locale.getText('emails.otpSession.description'),
      clientInfo: locale.getText('emails.otpSession.clientInfo'),
      thanks: locale.getText('emails.otpSession.thanks'),
      signature: locale.getText('emails.otpSession.signature'),
      securityPhrase: phrase!
        ? locale.getText('emails.otpSession.securityPhrase')
        : '',
    }

    let body = template(emailData)

    const smtp = project.get('smtp', {}) as SmtpConfig
    const smtpEnabled = smtp.enabled ?? false
    const systemConfig = this.appConfig.get('system')

    let senderEmail = systemConfig.emailAddress || configuration.app.emailTeam
    let senderName =
      systemConfig.emailName || `${configuration.app.name} Server`
    let replyTo = ''

    const smtpServer: any = {}

    if (smtpEnabled) {
      if (smtp.senderEmail) {
        senderEmail = smtp.senderEmail
      }
      if (smtp.senderName) {
        senderName = smtp.senderName
      }
      if (smtp.replyTo) {
        replyTo = smtp.replyTo
      }

      smtpServer.host = smtp.host || ''
      smtpServer.port = smtp.port || ''
      smtpServer.username = smtp.username || ''
      smtpServer.password = smtp.password || ''
      smtpServer.secure = smtp.secure ?? false

      if (customTemplate) {
        if (customTemplate.senderEmail) {
          senderEmail = customTemplate.senderEmail
        }
        if (customTemplate.senderName) {
          senderName = customTemplate.senderName
        }
        if (customTemplate.replyTo) {
          replyTo = customTemplate.replyTo
        }

        body = customTemplate.message || body
        subject = customTemplate.subject || subject
      }

      smtpServer.replyTo = replyTo
      smtpServer.senderEmail = senderEmail
      smtpServer.senderName = senderName
    }

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.get('name'),
      project: project.get('name'),
      otp: tokenSecret,
      agentDevice: agentDevice.deviceBrand || 'UNKNOWN',
      agentClient: agentClient.clientName || 'UNKNOWN',
      agentOs: agentOs.osName || 'UNKNOWN',
      phrase: phrase! || '',
    }

    await this.mailsQueue.add(MailJob.SEND_EMAIL, {
      email,
      subject,
      body,
      server: smtpServer,
      variables: emailVariables,
    })

    createdToken.set('secret', tokenSecret)

    if (phrase!) {
      createdToken.set('phrase', phrase)
    }

    response.status(201)
    return createdToken
  }

  /**
   * Create Phone Token.
   */
  async createPhoneToken({
    db,
    user,
    input,
    request,
    response,
    locale,
    project,
  }: {
    db: Database
    user: UsersDoc
    input: CreatePhoneTokenDTO
    request: NuvixRequest
    response: NuvixRes
    locale: LocaleTranslator
    project: ProjectsDoc
  }) {
    // Check if SMS provider is configured
    if (!this.appConfig.get('sms').enabled) {
      throw new Exception(
        Exception.GENERAL_PHONE_DISABLED,
        'Phone provider not configured',
      )
    }

    const { userId, phone } = input
    const result = await db.findOne('users', [Query.equal('phone', [phone])])

    if (!result.empty()) {
      user.setAll(result.toObject())
    } else {
      const limit = project.get('auths', {}).limit ?? 0
      const maxUsers = this.appConfig.appLimits.users

      if (limit !== 0) {
        const total = await db.count('users', [], maxUsers)

        if (total >= limit) {
          throw new Exception(Exception.USER_COUNT_EXCEEDED)
        }
      }

      const finalUserId = userId === 'unique()' ? ID.unique() : userId
      user.setAll({
        $id: finalUserId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(finalUserId)),
          Permission.delete(Role.user(finalUserId)),
        ],
        phone: phone,
        emailVerification: false,
        phoneVerification: false,
        status: true,
        registration: new Date(),
        reset: false,
        prefs: {},
        search: [finalUserId, phone].join(' '),
        accessedAt: new Date(),
      })

      user.delete('$sequence')
      await Authorization.skip(() => db.createDocument('users', user))

      try {
        const target = await Authorization.skip(() =>
          db.createDocument(
            'targets',
            new Doc({
              $permissions: [
                Permission.read(Role.user(user.getId())),
                Permission.update(Role.user(user.getId())),
                Permission.delete(Role.user(user.getId())),
              ],
              userId: user.getId(),
              userInternalId: user.getSequence(),
              providerType: MessageType.SMS,
              identifier: phone,
            }),
          ),
        )
        user.set('targets', [...user.get('targets', []), target])
      } catch (error) {
        if (error instanceof DuplicateException) {
          const existingTarget = await db.findOne('targets', [
            Query.equal('identifier', [phone]),
          ])
          if (existingTarget && !existingTarget.empty()) {
            user.set('targets', [...user.get('targets', []), existingTarget])
          }
        }
      }
      await db.purgeCachedDocument('users', user.getId())
    }

    let secret: string | null = null
    let sendSMS = true
    const mockNumbers = project.get('auths', {}).mockNumbers ?? []

    for (const mockNumber of mockNumbers) {
      if (mockNumber.phone === phone) {
        secret = mockNumber.otp
        sendSMS = false
        break
      }
    }

    secret = secret ?? Auth.codeGenerator(6)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_OTP * 1000)

    const token = new Doc<Tokens>({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      type: TokenType.PHONE,
      secret: Auth.hash(secret),
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    })

    Authorization.setRole(Role.user(user.getId()).toString())

    const createdToken = await db.createDocument(
      'tokens',
      token.set('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    )
    await db.purgeCachedDocument('users', user.getId())

    if (sendSMS) {
      const customTemplate =
        project.get('templates', {})[`sms.login-${locale.default}`] ?? {}

      let message = locale.getText('sms.verification.body')
      if (customTemplate?.message) {
        message = customTemplate.message
      }

      const messageContent = message
        .replace('{{project}}', project.get('name'))
        .replace('{{secret}}', secret)

      await this.messagingQueue.add(MessagingJob.INTERNAL, {
        message: {
          to: [phone],
          data: {
            content: messageContent,
          },
        },
      })
    }

    createdToken.set('secret', Auth.encodeSession(user.getId(), secret))

    response.status(201)
    return createdToken
  }

  /**
   * Create JWT
   */
  async createJWT(user: UsersDoc, response: NuvixRes) {
    const sessions = user.get('sessions', []) as SessionsDoc[]
    let current = new Doc<Sessions>()

    for (const session of sessions) {
      if (session.get('secret') === Auth.hash(Auth.secret)) {
        current = session
        break
      }
    }

    if (current.empty()) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND)
    }

    const payload = {
      userId: user.getId(),
      sessionId: current.getId(),
    }

    const jwt = this.jwtService.sign(payload, {
      expiresIn: '15m', // 900 seconds
    })

    response.status(201)
    return new Doc({ jwt })
  }

  /**
   * Send Session Alert.
   */
  async sendSessionAlert(
    locale: LocaleTranslator,
    user: UsersDoc,
    project: ProjectsDoc,
    session: SessionsDoc,
  ) {
    let subject: string = locale.getText('emails.sessionAlert.subject')
    const customTemplate =
      project.get('templates', {})?.[`email.sessionAlert-${locale.default}`] ??
      {}
    const templatePath = path.join(
      this.appConfig.assetConfig.templates,
      'email-session-alert.tpl',
    )
    const templateSource = await fs.readFile(templatePath, 'utf8')
    const template = Template.compile(templateSource)

    const emailData = {
      hello: locale.getText('emails.sessionAlert.hello'),
      body: locale.getText('emails.sessionAlert.body'),
      listDevice: locale.getText('emails.sessionAlert.listDevice'),
      listIpAddress: locale.getText('emails.sessionAlert.listIpAddress'),
      listCountry: locale.getText('emails.sessionAlert.listCountry'),
      footer: locale.getText('emails.sessionAlert.footer'),
      thanks: locale.getText('emails.sessionAlert.thanks'),
      signature: locale.getText('emails.sessionAlert.signature'),
    }

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      date: new Date().toLocaleDateString(locale.default, {
        month: 'long',
        day: 'numeric',
      }),
      year: new Date().getFullYear(),
      time: new Date().toLocaleTimeString(locale.default),
      user: user.get('name'),
      project: project.get('name'),
      device: session.get('clientName'),
      ipAddress: session.get('ip'),
      country: locale.getText(
        `countries.${session.get('countryCode')}`,
        locale.getText('locale.country.unknown'),
      ),
    }

    const smtpServer: SmtpConfig = {} as SmtpConfig

    let body = template(emailData)

    const smtp = project.get('smtp', {}) as SmtpConfig
    const smtpEnabled = smtp.enabled ?? false
    const systemConfig = this.appConfig.get('system')

    let senderEmail = systemConfig.emailAddress || configuration.app.emailTeam
    let senderName =
      systemConfig.emailName || `${configuration.app.name} Server`
    let replyTo = ''

    if (smtpEnabled) {
      if (smtp.senderEmail) {
        senderEmail = smtp.senderEmail
      }
      if (smtp.senderName) {
        senderName = smtp.senderName
      }
      if (smtp.replyTo) {
        replyTo = smtp.replyTo
      }

      smtpServer.host = smtp.host
      smtpServer.port = smtp.port
      smtpServer.username = smtp.username
      smtpServer.password = smtp.password
      smtpServer.secure = smtp.secure ?? false

      if (customTemplate) {
        if (customTemplate.senderEmail) {
          senderEmail = customTemplate.senderEmail
        }
        if (customTemplate.senderName) {
          senderName = customTemplate.senderName
        }
        if (customTemplate.replyTo) {
          replyTo = customTemplate.replyTo
        }

        body = customTemplate.message || body
        subject = customTemplate.subject || subject
      }

      smtpServer.replyTo = replyTo
      smtpServer.senderEmail = senderEmail
      smtpServer.senderName = senderName
    }

    const email = user.get('email')

    await this.mailsQueue.add(MailJob.SEND_EMAIL, {
      email,
      subject,
      body,
      server: smtpServer,
      variables: emailVariables,
    })
  }

  /**
   * Create Session
   */
  async createSession({
    user,
    input,
    request,
    response,
    locale,
    project,
    db,
  }: {
    user: UsersDoc
    input: CreateSessionDTO
    request: NuvixRequest
    response: NuvixRes
    locale: LocaleTranslator
    project: ProjectsDoc
    db: Database
  }) {
    const userFromRequest = await Authorization.skip(() =>
      db.getDocument('users', input.userId),
    )

    if (userFromRequest.empty()) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    const verifiedToken = Auth.tokenVerify(
      userFromRequest.get('tokens', []),
      null,
      input.secret,
    )

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    user.setAll(userFromRequest.toObject())

    const duration =
      project.get('auths', {}).duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN')
    const record = this.geodb.get(request.ip)
    const sessionSecret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION)

    const tokenType = verifiedToken.get('type')
    let factor: string

    switch (tokenType) {
      case TokenType.MAGIC_URL:
      case TokenType.OAUTH2:
      case TokenType.EMAIL:
        factor = AuthFactor.EMAIL
        break
      case TokenType.PHONE:
        factor = AuthFactor.PHONE
        break
      case TokenType.GENERIC:
        factor = AuthFactor.TOKEN
        break
      default:
        throw new Exception(Exception.USER_INVALID_TOKEN)
    }

    const session = new Doc<Sessions>({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getSequence(),
      provider: Auth.getSessionProviderByTokenType(verifiedToken.get('type')),
      secret: Auth.hash(sessionSecret),
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
      factors: [factor],
      countryCode: record?.country?.iso_code.toLowerCase(),
      expire: new Date(Date.now() + duration * 1000),
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    })

    Authorization.setRole(Role.user(user.getId()).toString())

    session.set('$permissions', [
      Permission.read(Role.user(user.getId())),
      Permission.update(Role.user(user.getId())),
      Permission.delete(Role.user(user.getId())),
    ])
    const createdSession = await db.createDocument('sessions', session)

    await Authorization.skip(() =>
      db.deleteDocument('tokens', verifiedToken.getId()),
    )
    await db.purgeCachedDocument('users', user.getId())

    // Magic URL + Email OTP
    if (tokenType === TokenType.MAGIC_URL || tokenType === TokenType.EMAIL) {
      user.set('emailVerification', true)
    }

    if (tokenType === TokenType.PHONE) {
      user.set('phoneVerification', true)
    }

    try {
      await db.updateDocument('users', user.getId(), user)
    } catch (_error) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed saving user to DB',
      )
    }

    const isAllowedTokenType =
      tokenType !== TokenType.MAGIC_URL && tokenType !== TokenType.EMAIL
    const hasUserEmail = user.get('email', false) !== false
    const isSessionAlertsEnabled =
      project.get('auths', {}).sessionAlerts ?? false

    const sessionCount = await db.count('sessions', [
      Query.equal('userId', [user.getId()]),
    ])
    const isNotFirstSession = sessionCount !== 1

    if (
      isAllowedTokenType &&
      hasUserEmail &&
      isSessionAlertsEnabled &&
      isNotFirstSession
    ) {
      await this.sendSessionAlert(locale, user, project, createdSession)
    }

    await this.eventEmitter.emit(AppEvents.SESSION_CREATE, {
      userId: user.getId(),
      sessionId: createdSession.getId(),
      payload: {
        data: createdSession,
        type: Models.SESSION,
      },
    })

    if (!request.domainVerification) {
      response.header(
        'X-Fallback-Cookies',
        JSON.stringify({
          [Auth.cookieName]: Auth.encodeSession(user.getId(), sessionSecret),
        }),
      )
    }

    const expire = new Date(Date.now() + duration * 1000)
    const protocol = request.protocol

    response
      .cookie(
        Auth.cookieName,
        Auth.encodeSession(user.getId(), sessionSecret),
        {
          expires: expire,
          path: '/',
          domain: Auth.cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: Auth.cookieSamesite,
        },
      )
      .status(201)

    const countryName = locale.getText(
      `countries.${createdSession.get('countryCode', '')?.toLowerCase()}`,
      locale.getText('locale.country.unknown'),
    )

    createdSession
      .set('current', true)
      .set('countryName', countryName)
      .set('expire', expire.toISOString())
      .set('secret', Auth.encodeSession(user.getId(), sessionSecret))

    return createdSession
  }

  private getProviderConfig(project: ProjectsDoc, provider: string) {
    const providers = project.get('oAuthProviders', []) as OAuthProviderType[]
    const _provider = providers.find(p => p.key === provider)

    if (!_provider) {
      throw new Exception(Exception.PROVIDER_NOT_FOUND) // TODO: improve & clear error
    }

    return _provider
  }
}
