import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { JwtService } from '@nestjs/jwt';

import { Queue } from 'bullmq';
import { CountryResponse, Reader } from 'maxmind';
import * as Template from 'handlebars';
import * as fs from 'fs/promises';
import path from 'path';

import {
  Document,
  Database,
  Query,
  ID,
  Permission,
  Role,
  Authorization,
  DuplicateException,
} from '@nuvix/database';

// Nuvix core
import { Exception } from '@nuvix/core/extend/exception';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { LocaleTranslator } from '@nuvix/core/helper/locale.helper';
import { Models } from '@nuvix/core/helper/response.helper';
import { Detector } from '@nuvix/core/helper/detector.helper';
import { PersonalDataValidator } from '@nuvix/core/validators/personal-data.validator';
import { URLValidator } from '@nuvix/core/validators/url.validator';
import {
  MfaType,
  PasswordHistoryValidator,
  TOTP,
} from '@nuvix/core/validators';
import { MailQueueOptions } from '@nuvix/core/resolvers/queues/mail.queue';
import { getOAuth2Class, OAuth2 } from '@nuvix/core/OAuth2';
import { OAuthProviders } from '@nuvix/core/config/authProviders';

// Nuvix utils
import {
  APP_EMAIL_TEAM,
  APP_LIMIT_COUNT,
  APP_LIMIT_USERS,
  APP_NAME,
  APP_SMTP_HOST,
  APP_SYSTEM_EMAIL_ADDRESS,
  APP_SYSTEM_EMAIL_NAME,
  ASSETS,
  CONSOLE_CONFIG,
  EVENT_SESSION_CREATE,
  EVENT_SESSIONS_DELETE,
  EVENT_USER_CREATE,
  GEO_DB,
  MESSAGE_TYPE_PUSH,
  SEND_TYPE_EMAIL,
} from '@nuvix/utils/constants';
import { PhraseGenerator } from '@nuvix/utils/auth/pharse';
import { TOTP as TOTPChallenge } from '@nuvix/utils/auth/mfa/challenge/totp';
import { Email as EmailChallenge } from '@nuvix/utils/auth/mfa/challenge/email';
import { Phone as PhoneChallenge } from '@nuvix/utils/auth/mfa/challenge/phone';

// Local DTOs
import { UpdateEmailDTO } from './DTO/account.dto';
import { CreateRecoveryDTO, UpdateRecoveryDTO } from './DTO/recovery.dto';
import { CreateMfaChallengeDTO, VerifyMfaChallengeDTO } from './DTO/mfa.dto';
import { CreatePushTargetDTO, UpdatePushTargetDTO } from './DTO/target.dto';
import {
  CreateEmailSessionDTO,
  CreateOAuth2SessionDTO,
  CreateSessionDTO,
  OAuth2CallbackDTO,
} from './DTO/session.dto';
import {
  CreateEmailTokenDTO,
  CreateMagicURLTokenDTO,
  CreateOAuth2TokenDTO,
  CreatePhoneTokenDTO,
} from './DTO/token.dto';

@Injectable()
export class AccountService {
  constructor(
    @Inject(GEO_DB) private readonly geodb: Reader<CountryResponse>,
    @InjectQueue('mails') private readonly mailQueue: Queue<MailQueueOptions>,
    private eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
  ) {}

  private readonly oauthDefaultSuccess = '/auth/oauth2/success';
  private readonly oauthDefaultFailure = '/auth/oauth2/failure';

  /**
   * Create a new account
   */
  async createAccount(
    db: Database,
    userId: string,
    email: string,
    password: string,
    name: string,
    user: Document,
    project: Document,
  ): Promise<Document> {
    email = email.toLowerCase();

    const auths = project.getAttribute('auths', {});
    const limit = auths.limit ?? 0;

    if (limit !== 0) {
      const total = await db.count('users', [], APP_LIMIT_USERS);

      if (total >= limit) {
        throw new Exception(Exception.USER_COUNT_EXCEEDED);
      }
    }

    // Makes sure this email is not already used in another identity
    const identityWithMatchingEmail = await db.findOne('identities', [
      Query.equal('providerEmail', [email]),
    ]);

    if (identityWithMatchingEmail && !identityWithMatchingEmail.isEmpty()) {
      throw new Exception(Exception.GENERAL_BAD_REQUEST); // Return a generic bad request to prevent exposing existing accounts
    }

    if (auths['personalDataCheck'] ?? false) {
      const personalDataValidator = new PersonalDataValidator(
        userId,
        email,
        name,
        null,
      );
      if (!personalDataValidator.isValid(password)) {
        throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA);
      }
    }

    // hooks.trigger('passwordValidator', [db, project, password, user, true]);

    const passwordHistory = auths['passwordHistory'] ?? 0;
    const hashedPassword = await Auth.passwordHash(
      password,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    );

    try {
      userId = userId === 'unique()' ? ID.unique() : userId;
      user.setAttributes({
        $id: userId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
        email: email,
        emailVerification: false,
        status: true,
        password: hashedPassword,
        passwordHistory: passwordHistory > 0 ? [hashedPassword] : [],
        passwordUpdate: new Date(),
        hash: Auth.DEFAULT_ALGO,
        hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
        registration: new Date(),
        reset: false,
        name: name,
        mfa: false,
        prefs: {},
        sessions: null,
        tokens: null,
        memberships: null,
        authenticators: null,
        search: `${userId} ${email} ${name}`,
        accessedAt: new Date(),
      });
      user.removeAttribute('$internalId');
      user = await Authorization.skip(
        async () => await db.createDocument('users', user),
      );

      try {
        const target = await Authorization.skip(
          async () =>
            await db.createDocument(
              'targets',
              new Document({
                $permissions: [
                  Permission.read(Role.user(user.getId())),
                  Permission.update(Role.user(user.getId())),
                  Permission.delete(Role.user(user.getId())),
                ],
                userId: user.getId(),
                userInternalId: user.getInternalId(),
                providerType: 'email',
                identifier: email,
              }),
            ),
        );
        user.setAttribute('targets', [
          ...user.getAttribute('targets', []),
          target,
        ]);
      } catch (error) {
        if (error instanceof DuplicateException) {
          const existingTarget = await db.findOne('targets', [
            Query.equal('identifier', [email]),
          ]);
          if (existingTarget) {
            user.setAttribute(
              'targets',
              existingTarget,
              Document.SET_TYPE_APPEND,
            );
          }
        } else {
          throw error;
        }
      }

      await db.purgeCachedDocument('users', user.getId());
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_ALREADY_EXISTS);
      }
      throw error;
    }

    Authorization.unsetRole(Role.guests().toString());
    Authorization.setRole(Role.user(user.getId()).toString());
    Authorization.setRole(Role.users().toString());

    return user;
  }

  async updatePrefs(
    db: Database,
    user: Document,
    prefs: { [key: string]: any },
  ) {
    user.setAttribute('prefs', prefs);

    user = await db.updateDocument('users', user.getId(), user);

    return user.getAttribute('prefs', {});
  }

  async deleteAccount(db: Database, user: Document) {
    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    if (user.getAttribute('status') === false) {
      throw new Exception(Exception.USER_BLOCKED);
    }

    await db.deleteDocument('users', user.getId());
    return user;
  }

  /**
   * Get User's Sessions
   */
  async getSessions(user: Document, locale: LocaleTranslator) {
    const sessions = user.getAttribute('sessions', []);
    const current = Auth.sessionVerify(sessions, Auth.secret);

    const updatedSessions = sessions.map((session: Document) => {
      const countryName = locale.getText(
        'countries' + session.getAttribute('countryCode', '').toLowerCase(),
        locale.getText('locale.country.unknown'),
      );

      session.setAttribute('countryName', countryName);
      session.setAttribute('current', current === session.getId());
      session.setAttribute('secret', session.getAttribute('secret', ''));

      return session;
    });

    return {
      sessions: updatedSessions,
      total: updatedSessions.length,
    };
  }

  /**
   * Delete User's Session
   */
  async deleteSessions(
    db: Database,
    user: Document,
    locale: LocaleTranslator,
    request: NuvixRequest,
    response: NuvixRes,
  ) {
    const protocol = request.protocol;
    const sessions = user.getAttribute('sessions', []);

    for (const session of sessions) {
      await db.deleteDocument('sessions', session.getId());

      if (!CONSOLE_CONFIG.domainVerification) {
        response.header('X-Fallback-Cookies', JSON.stringify([]));
      }

      session.setAttribute('current', false);
      session.setAttribute(
        'countryName',
        locale.getText(
          'countries' + session.getAttribute('countryCode', '').toLowerCase(),
          locale.getText('locale.country.unknown'),
        ),
      );

      if (session.getAttribute('secret') === Auth.hash(Auth.secret)) {
        session.setAttribute('current', true);

        // If current session, delete the cookies too
        response.cookie(Auth.cookieName, '', {
          expires: new Date(0),
          path: '/',
          domain: Auth.cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: Auth.cookieSamesite,
        });

        // queueForDeletes.setType(DELETE_TYPE_SESSION_TARGETS).setDocument(session).trigger();
      }
    }

    await db.purgeCachedDocument('users', user.getId());

    await this.eventEmitter.emitAsync(EVENT_SESSIONS_DELETE, {
      userId: user.getId(),
    });

    return {};
  }

  /**
   * Get a Session
   */
  async getSession(
    user: Document,
    sessionId: string,
    locale: LocaleTranslator,
  ) {
    const sessions = user.getAttribute('sessions', []);
    sessionId =
      sessionId === 'current'
        ? (Auth.sessionVerify(
            user.getAttribute('sessions'),
            Auth.secret,
          ) as string)
        : sessionId;

    for (const session of sessions) {
      if (sessionId === session.getId()) {
        const countryName = locale.getText(
          'countries' + session.getAttribute('countryCode', '').toLowerCase(),
          locale.getText('locale.country.unknown'),
        );

        session
          .setAttribute(
            'current',
            session.getAttribute('secret') === Auth.hash(Auth.secret),
          )
          .setAttribute('countryName', countryName)
          .setAttribute('secret', session.getAttribute('secret', ''));

        return session;
      }
    }

    throw new Exception(Exception.USER_SESSION_NOT_FOUND);
  }

  /**
   * Delete a Session
   */
  async deleteSession(
    db: Database,
    user: Document,
    sessionId: string,
    request: NuvixRequest,
    response: NuvixRes,
    locale: LocaleTranslator,
  ) {
    const protocol = request.protocol;
    const sessions = user.getAttribute('sessions', []);

    for (const session of sessions) {
      if (sessionId !== session.getId()) {
        continue;
      }

      await db.deleteDocument('sessions', session.getId());

      session.setAttribute('current', false);

      if (session.getAttribute('secret') === Auth.hash(Auth.secret)) {
        session.setAttribute('current', true);
        session.setAttribute(
          'countryName',
          locale.getText(
            'countries' + session.getAttribute('countryCode', '').toLowerCase(),
            locale.getText('locale.country.unknown'),
          ),
        );

        response.cookie(Auth.cookieName, '', {
          expires: new Date(0),
          path: '/',
          domain: Auth.cookieDomain,
          secure: protocol === 'https',
          httpOnly: true,
          sameSite: Auth.cookieSamesite,
        });

        response.header('X-Fallback-Cookies', JSON.stringify({}));
      }

      await db.purgeCachedDocument('users', user.getId());

      // TODO: Handle Queues
      // await this.eventEmitter.emitAsync(EVENT_SESSION_DELETE, {
      //   userId: user.getId(),
      //   sessionId: session.getId(),
      //   payload: {
      //     data: session,
      //     type: Models.SESSION,
      //   },
      // });

      // queueForDeletes.setType(DELETE_TYPE_SESSION_TARGETS).setDocument(session).trigger();

      return {};
    }

    throw new Exception(Exception.USER_SESSION_NOT_FOUND);
  }

  /**
   * Update a Session
   */
  async updateSession(
    db: Database,
    user: Document,
    sessionId: string,
    project: Document,
  ) {
    sessionId =
      sessionId === 'current'
        ? (Auth.sessionVerify(
            user.getAttribute('sessions'),
            Auth.secret,
          ) as string)
        : sessionId;

    const sessions = user.getAttribute('sessions', []);
    let session: Document | null = null;

    for (const value of sessions) {
      if (sessionId === value.getId()) {
        session = value;
        break;
      }
    }

    if (session === null) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND);
    }

    const auths = project.getAttribute('auths', {});

    const authDuration = auths.duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    session.setAttribute('expire', new Date(Date.now() + authDuration * 1000));

    const provider: string = session.getAttribute('provider', '');
    const refreshToken = session.getAttribute('providerRefreshToken', '');

    const authClass = await import(
      /* webpackChunkName: "OAuth2" */
      /* webpackInclude: /\.js$/ */
      `@nuvix/core/OAuth2/${provider.toLowerCase()}`
    );
    const className = `${provider.charAt(0).toUpperCase() + provider.slice(1)}OAuth2`;

    if (provider && className in authClass) {
      const providers = project.getAttribute('oAuthProviders', []);
      const providerInfo = providers.map((p: any) => p.key === provider);

      const appId = providerInfo['appId'];
      const appSecret = providerInfo['secret'];

      const oauth2: OAuth2 = new authClass[className](
        appId,
        appSecret,
        '',
        [],
        [],
      );
      await oauth2.refreshTokens(refreshToken);
      const accessToken = await oauth2.getAccessToken('');

      session
        .setAttribute('providerAccessToken', accessToken)
        .setAttribute('providerRefreshToken', accessToken)
        .setAttribute(
          'providerAccessTokenExpiry',
          new Date(Date.now() + (await oauth2.getAccessTokenExpiry('')) * 1000),
        );
    }

    await db.updateDocument('sessions', sessionId, session);
    await db.purgeCachedDocument('users', user.getId());

    // TODO: Handle Events
    // await this.eventEmitter.emitAsync(EVENT_SESSION_UPDATE, {
    //   userId: user.getId(),
    //   sessionId: session.getId(),
    //   payload: {
    //     data: session,
    //     type: Models.SESSION,
    //   },
    // });

    return session;
  }

  /**
   * Update User's Email
   */
  async updateEmail(db: Database, user: Document, input: UpdateEmailDTO) {
    const passwordUpdate = user.getAttribute('passwordUpdate');

    if (
      passwordUpdate &&
      !(await Auth.passwordVerify(
        input.password,
        user.getAttribute('password'),
        user.getAttribute('hash'),
        user.getAttribute('hashOptions'),
      ))
    ) {
      throw new Exception(Exception.USER_INVALID_CREDENTIALS);
    }

    const oldEmail = user.getAttribute('email');
    const email = input.email.toLowerCase();

    const identityWithMatchingEmail = await db.findOne('identities', [
      Query.equal('providerEmail', [email]),
      Query.notEqual('userInternalId', user.getInternalId()),
    ]);

    if (identityWithMatchingEmail && !identityWithMatchingEmail.isEmpty()) {
      throw new Exception(Exception.GENERAL_BAD_REQUEST);
    }

    user.setAttribute('email', email).setAttribute('emailVerification', false);

    if (!passwordUpdate) {
      const hashedPassword = await Auth.passwordHash(
        input.password,
        Auth.DEFAULT_ALGO,
        Auth.DEFAULT_ALGO_OPTIONS,
      );
      user
        .setAttribute('password', hashedPassword)
        .setAttribute('hash', Auth.DEFAULT_ALGO)
        .setAttribute('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
        .setAttribute('passwordUpdate', new Date());
    }

    const target = await Authorization.skip(
      async () =>
        await db.findOne('targets', [Query.equal('identifier', [email])]),
    );

    if (target && !target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
    }

    try {
      user = await db.updateDocument('users', user.getId(), user);
      const oldTarget = user.find<any>('identifier', oldEmail, 'targets');

      if (oldTarget && !oldTarget.isEmpty()) {
        await Authorization.skip(
          async () =>
            await db.updateDocument(
              'targets',
              oldTarget.getId(),
              oldTarget.setAttribute('identifier', email),
            ),
        );
      }
      await db.purgeCachedDocument('users', user.getId());
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.GENERAL_BAD_REQUEST);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create a new session for the user using Email & Password
   */
  async createEmailSession(
    db: Database,
    user: Document,
    input: CreateEmailSessionDTO,
    request: NuvixRequest,
    response: NuvixRes,
    locale: LocaleTranslator,
    project: Document,
  ) {
    const email = input.email.toLowerCase();
    const protocol = request.protocol;

    const profile = await db.findOne('users', [Query.equal('email', [email])]);

    if (
      !profile ||
      !profile.getAttribute('passwordUpdate') ||
      !(await Auth.passwordVerify(
        input.password,
        profile.getAttribute('password'),
        profile.getAttribute('hash'),
        profile.getAttribute('hashOptions'),
      ))
    ) {
      throw new Exception(Exception.USER_INVALID_CREDENTIALS);
    }

    if (profile.getAttribute('status') === false) {
      throw new Exception(Exception.USER_BLOCKED);
    }

    user.setAttributes(profile.toObject());

    const auths = project.getAttribute('auths', {});
    const duration = auths.duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN');
    const record = this.geodb.get(request.ip);
    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION);

    const session = new Document<any>({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      provider: Auth.SESSION_PROVIDER_EMAIL,
      providerUid: email,
      secret: Auth.hash(secret),
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
      factors: ['password'],
      countryCode: record ? record.country.iso_code.toLowerCase() : '',
      expire: new Date(Date.now() + duration * 1000),
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    });

    Authorization.setRole(Role.user(user.getId()).toString());

    if (user.getAttribute('hash') !== Auth.DEFAULT_ALGO) {
      user
        .setAttribute(
          'password',
          await Auth.passwordHash(
            input.password,
            Auth.DEFAULT_ALGO,
            Auth.DEFAULT_ALGO_OPTIONS,
          ),
        )
        .setAttribute('hash', Auth.DEFAULT_ALGO)
        .setAttribute('hashOptions', Auth.DEFAULT_ALGO_OPTIONS);
      await db.updateDocument('users', user.getId(), user);
    }

    await db.purgeCachedDocument('users', user.getId());

    const createdSession = await db.createDocument(
      'sessions',
      session.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    if (!CONSOLE_CONFIG.domainVerification) {
      response.header(
        'X-Fallback-Cookies',
        JSON.stringify({
          [Auth.cookieName]: Auth.encodeSession(user.getId(), secret),
        }),
      );
    }

    const expire = new Date(Date.now() + duration * 1000);

    response
      .cookie(Auth.cookieName, Auth.encodeSession(user.getId(), secret), {
        expires: expire,
        path: '/',
        secure: protocol === 'https',
        domain: Auth.cookieDomain,
        sameSite: Auth.cookieSamesite,
        httpOnly: true,
      })
      .status(201);

    const countryName = locale.getText(
      'countries' + session.getAttribute('countryCode', '').toLowerCase(),
      locale.getText('locale.country.unknown'),
    );

    createdSession
      .setAttribute('current', true)
      .setAttribute('countryName', countryName)
      .setAttribute('secret', Auth.encodeSession(user.getId(), secret));

    // TODO: Handle Events
    // await this.eventEmitter.emitAsync(EVENT_SESSION_CREATE, {
    //   userId: user.getId(),
    //   sessionId: createdSession.getId(),
    //   payload: {
    //     data: createdSession,
    //     type: Models.SESSION,
    //   },
    // });

    if (project.getAttribute('auths', {}).sessionAlerts ?? false) {
      const sessionCount = await db.count('sessions', [
        Query.equal('userId', [user.getId()]),
      ]);

      if (sessionCount !== 1) {
        await this.sendSessionAlert(locale, user, project, createdSession);
      }
    }

    return createdSession;
  }

  async createAnonymousSession({
    request,
    response,
    locale,
    user,
    project,
    db,
  }: {
    request: NuvixRequest;
    response: NuvixRes;
    locale: LocaleTranslator;
    user: Document;
    project: Document;
    db: Database;
  }) {
    const protocol = request.protocol;
    const limit = project.getAttribute('auths', {})['limit'] ?? 0;

    if (limit !== 0) {
      const total = await db.count('users', [], APP_LIMIT_USERS);

      if (total >= limit) {
        throw new Exception(Exception.USER_COUNT_EXCEEDED);
      }
    }

    const userId = ID.unique();
    user.setAttributes({
      $id: userId,
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
      email: null,
      emailVerification: false,
      status: true,
      password: null,
      hash: Auth.DEFAULT_ALGO,
      hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
      passwordUpdate: null,
      registration: new Date(),
      reset: false,
      name: null,
      mfa: false,
      prefs: {},
      sessions: null,
      tokens: null,
      memberships: null,
      authenticators: null,
      search: userId,
      accessedAt: new Date(),
    });
    user.removeAttribute('$internalId');
    await Authorization.skip(
      async () => await db.createDocument('users', user),
    );

    // Create session token
    const duration =
      project.getAttribute('auths', {})['duration'] ??
      Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN');
    const record = this.geodb.get(request.ip);
    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION);

    const session = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      provider: Auth.SESSION_PROVIDER_ANONYMOUS,
      secret: Auth.hash(secret),
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
      factors: ['anonymous'],
      countryCode: record ? record.country.iso_code.toLowerCase() : '--',
      expire: new Date(Date.now() + duration * 1000),
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    });

    Authorization.setRole(Role.user(user.getId()).toString());

    const createdSession = await db.createDocument(
      'sessions',
      session.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await db.purgeCachedDocument('users', user.getId());

    await this.eventEmitter.emitAsync(EVENT_USER_CREATE, {
      userId: user.getId(),
      sessionId: createdSession.getId(),
    });

    if (!CONSOLE_CONFIG.domainVerification) {
      response.header(
        'X-Fallback-Cookies',
        JSON.stringify({
          [Auth.cookieName]: Auth.encodeSession(user.getId(), secret),
        }),
      );
    }

    const expire = new Date(Date.now() + duration * 1000);

    response
      .cookie(Auth.cookieName, Auth.encodeSession(user.getId(), secret), {
        expires: expire,
        path: '/',
        domain: Auth.cookieDomain,
        secure: protocol === 'https',
        httpOnly: true,
        sameSite: Auth.cookieSamesite,
      })
      .status(201);

    const countryName = locale.getText(
      'countries.' +
        createdSession.getAttribute('countryCode', '').toLowerCase(),
      locale.getText('locale.country.unknown'),
    );

    createdSession
      .setAttribute('current', true)
      .setAttribute('countryName', countryName)
      .setAttribute('secret', Auth.encodeSession(user.getId(), secret));

    return createdSession;
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
    input: CreateOAuth2SessionDTO;
    request: NuvixRequest;
    response: NuvixRes;
    project: Document;
    provider: OAuthProviders;
  }) {
    // TODO: Handle Error Response in HTML format.
    const protocol = request.protocol;
    const success = input.success || '';
    const failure = input.failure || '';
    const scopes = input.scopes || [];

    const callback = `${protocol}://${request.hostname}/v1/account/sessions/oauth2/callback/${provider}/${project.getId()}`;
    const oAuthProviders = project.getAttribute('oAuthProviders', {});
    const providerEnabled = oAuthProviders[provider]?.enabled ?? false;

    if (!providerEnabled) {
      throw new Exception(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please enable the provider from your ${APP_NAME} console to continue.`,
      );
    }

    const appId = oAuthProviders[provider]?.appId ?? '';
    let appSecret = oAuthProviders[provider]?.secret ?? '{}';

    if (appSecret && typeof appSecret === 'object' && appSecret.version) {
      // TODO: Handle encrypted app secret
    }

    if (!appId || !appSecret) {
      throw new Exception(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please configure the provider app ID and app secret key from your ${APP_NAME} console to continue.`,
      );
    }

    const AuthClass = await getOAuth2Class(provider);
    const consoleDomain =
      request.hostname.split('.').length === 3
        ? `console.${request.hostname.split('.', 2)[1]}`
        : request.hostname;
    const finalSuccess =
      success || `${protocol}://${consoleDomain}${this.oauthDefaultSuccess}`;
    const finalFailure =
      failure || `${protocol}://${consoleDomain}${this.oauthDefaultFailure}`;

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
    );

    response
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(oauth2.getLoginURL());
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
    db: Database;
    user: Document;
    input: OAuth2CallbackDTO;
    provider: string;
    request: NuvixRequest;
    response: NuvixRes;
    project: Document;
  }) {
    const protocol = request.protocol;
    const callback = `${protocol}://${request.hostname}/v1/account/sessions/oauth2/callback/${provider}/${project.getId()}`;
    const defaultState = {
      success: project.getAttribute('url', ''),
      failure: '',
    };
    const validateURL = new URLValidator();
    const oAuthProviders = project.getAttribute('oAuthProviders', {});
    const appId = oAuthProviders[provider]?.appId ?? '';
    let appSecret = oAuthProviders[provider]?.secret ?? '{}';
    const providerEnabled = oAuthProviders[provider]?.enabled ?? false;

    const AuthClass = await getOAuth2Class(provider);
    const oauth2 = new AuthClass(appId, appSecret, callback);

    let state = defaultState;
    if (input.state) {
      try {
        state = { ...defaultState, ...oauth2.parseState(input.state) };
      } catch (error) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Failed to parse login state params as passed from OAuth2 provider',
        );
      }
    }

    if (!validateURL.isValid(state['success'])) {
      throw new Exception(Exception.PROJECT_INVALID_SUCCESS_URL);
    }

    if (state['failure'] && !validateURL.isValid(state['failure'])) {
      throw new Exception(Exception.PROJECT_INVALID_FAILURE_URL);
    }

    const failureRedirect = (type: string, message?: string, code?: number) => {
      const exception = new Exception(type, message, code);
      if (state.failure) {
        // Handle failure redirect with error params
        const failureUrl = new URL(state.failure);
        failureUrl.searchParams.set(
          'error',
          JSON.stringify({
            message: exception.message,
            type: exception.getType(),
            code: code ?? exception.getStatus(),
          }),
        );
        response.redirect(failureUrl.toString());
        return;
      }
      throw exception;
    };

    if (!providerEnabled) {
      failureRedirect(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please enable the provider from your ${APP_NAME} console to continue.`,
      );
    }

    if (input.error) {
      let message = `The ${provider} OAuth2 provider returned an error: ${input.error}`;
      if (input.error_description) {
        message += `: ${input.error_description}`;
      }
      failureRedirect(Exception.USER_OAUTH2_PROVIDER_ERROR, message);
    }

    if (!input.code) {
      failureRedirect(
        Exception.USER_OAUTH2_PROVIDER_ERROR,
        'Missing OAuth2 code. Please contact the team for additional support.',
      );
    }

    if (appSecret && typeof appSecret === 'object' && appSecret.version) {
      // TODO: Handle encrypted app secret decryption
    }

    let accessToken = '';
    let refreshToken = '';
    let accessTokenExpiry = 0;

    try {
      accessToken = await oauth2.getAccessToken(input.code);
      refreshToken = await oauth2.getRefreshToken(input.code);
      accessTokenExpiry = await oauth2.getAccessTokenExpiry(input.code);
    } catch (error) {
      failureRedirect(
        Exception.USER_OAUTH2_PROVIDER_ERROR,
        `Failed to obtain access token. The ${provider} OAuth2 provider returned an error: ${error.message}`,
        error.code,
      );
    }

    const oauth2ID = await oauth2.getUserID(accessToken);
    if (!oauth2ID) {
      failureRedirect(Exception.USER_MISSING_ID);
    }

    let name = '';
    const nameOAuth = await oauth2.getUserName(accessToken);
    const userParam = JSON.parse((request.query['user'] as string) || '{}');
    if (nameOAuth) {
      name = nameOAuth;
    } else if (Array.isArray(userParam) || typeof userParam === 'object') {
      const nameParam = userParam['name'];
      if (
        typeof nameParam === 'object' &&
        nameParam['firstName'] &&
        nameParam['lastName']
      ) {
        name = nameParam['firstName'] + ' ' + nameParam['lastName'];
      }
    }

    const email = await oauth2.getUserEmail(accessToken);

    // Check if this identity is connected to a different user
    let sessionUpgrade = false;
    if (!user.isEmpty()) {
      const userId = user.getId();

      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', user.getInternalId()),
      ]);
      if (!identityWithMatchingEmail.isEmpty()) {
        failureRedirect(Exception.USER_ALREADY_EXISTS);
      }

      const userWithMatchingEmail = await db.find('users', [
        Query.equal('email', [email]),
        Query.notEqual('$id', [userId]),
      ]);
      if (userWithMatchingEmail.length > 0) {
        failureRedirect(Exception.USER_ALREADY_EXISTS);
      }

      sessionUpgrade = true;
    }

    const sessions = user.getAttribute('sessions', []);
    const current = Auth.sessionVerify(sessions, Auth.secret);

    if (current) {
      const currentDocument = await db.getDocument('sessions', current);
      if (!currentDocument.isEmpty()) {
        await db.deleteDocument('sessions', currentDocument.getId());
        await db.purgeCachedDocument('users', user.getId());
      }
    }

    if (user.isEmpty()) {
      const session = await db.findOne('sessions', [
        Query.equal('provider', [provider]),
        Query.equal('providerUid', [oauth2ID]),
      ]);
      if (!session.isEmpty()) {
        const foundUser = await db.getDocument(
          'users',
          session.getAttribute('userId'),
        );
        user.setAttributes(foundUser.toObject());
      }
    }

    if (user.isEmpty()) {
      if (!email) {
        failureRedirect(
          Exception.USER_UNAUTHORIZED,
          'OAuth provider failed to return email.',
        );
      }

      const userWithEmail = await db.findOne('users', [
        Query.equal('email', [email]),
      ]);
      if (!userWithEmail.isEmpty()) {
        user.setAttributes(userWithEmail.toObject());
      }

      if (user.isEmpty()) {
        const identity = await db.findOne('identities', [
          Query.equal('provider', [provider]),
          Query.equal('providerUid', [oauth2ID]),
        ]);

        if (!identity.isEmpty()) {
          const foundUser = await db.getDocument(
            'users',
            identity.getAttribute('userId'),
          );
          user.setAttributes(foundUser.toObject());
        }
      }

      if (user.isEmpty()) {
        const limit = project.getAttribute('auths', {})['limit'] ?? 0;

        if (limit !== 0) {
          const total = await db.count('users', [], APP_LIMIT_USERS);
          if (total >= limit) {
            failureRedirect(Exception.USER_COUNT_EXCEEDED);
          }
        }

        const identityWithMatchingEmail = await db.findOne('identities', [
          Query.equal('providerEmail', [email]),
        ]);
        if (!identityWithMatchingEmail.isEmpty()) {
          failureRedirect(Exception.GENERAL_BAD_REQUEST);
        }

        try {
          const userId = ID.unique();
          user.setAttributes({
            $id: userId,
            $permissions: [
              Permission.read(Role.any()),
              Permission.update(Role.user(userId)),
              Permission.delete(Role.user(userId)),
            ],
            email: email,
            emailVerification: true,
            status: true,
            password: null,
            hash: Auth.DEFAULT_ALGO,
            hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
            passwordUpdate: null,
            registration: new Date(),
            reset: false,
            name: name,
            mfa: false,
            prefs: {},
            sessions: null,
            tokens: null,
            memberships: null,
            authenticators: null,
            search: `${userId} ${email} ${name}`,
            accessedAt: new Date(),
          });
          user.removeAttribute('$internalId');

          const userDoc = await Authorization.skip(
            async () => await db.createDocument('users', user),
          );

          await db.createDocument(
            'targets',
            new Document({
              $permissions: [
                Permission.read(Role.user(user.getId())),
                Permission.update(Role.user(user.getId())),
                Permission.delete(Role.user(user.getId())),
              ],
              userId: userDoc.getId(),
              userInternalId: userDoc.getInternalId(),
              providerType: 'email',
              identifier: email,
            }),
          );
        } catch (error) {
          if (error instanceof DuplicateException) {
            failureRedirect(Exception.USER_ALREADY_EXISTS);
          }
          throw error;
        }
      }
    }

    Authorization.setRole(Role.user(user.getId()).toString());
    Authorization.setRole(Role.users().toString());

    if (user.getAttribute('status') === false) {
      failureRedirect(Exception.USER_BLOCKED);
    }

    let identity = await db.findOne('identities', [
      Query.equal('userInternalId', [user.getInternalId()]),
      Query.equal('provider', [provider]),
      Query.equal('providerUid', [oauth2ID]),
    ]);

    if (identity.isEmpty()) {
      const identitiesWithMatchingEmail = await db.find('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', [user.getInternalId()]),
      ]);
      if (identitiesWithMatchingEmail.length > 0) {
        failureRedirect(Exception.GENERAL_BAD_REQUEST);
      }

      identity = (await db.createDocument(
        'identities',
        new Document({
          $id: ID.unique(),
          $permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(user.getId())),
            Permission.delete(Role.user(user.getId())),
          ],
          userInternalId: user.getInternalId(),
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
      )) as any;
    } else {
      identity
        .setAttribute('providerAccessToken', accessToken)
        .setAttribute('providerRefreshToken', refreshToken)
        .setAttribute(
          'providerAccessTokenExpiry',
          new Date(Date.now() + accessTokenExpiry * 1000),
        );
      await db.updateDocument('identities', identity.getId(), identity);
    }

    if (!user.getAttribute('email')) {
      user.setAttribute('email', email);
    }

    if (!user.getAttribute('name')) {
      user.setAttribute('name', name);
    }

    user.setAttribute('status', true);
    await db.updateDocument('users', user.getId(), user);

    const duration =
      project.getAttribute('auths', {})['duration'] ??
      Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    const expire = new Date(Date.now() + duration * 1000);

    const parsedState = new URL(state.success);
    const query = new URLSearchParams(parsedState.search);

    // If token param is set, return token in query string
    if ((state as any).token) {
      const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_OAUTH2);
      const token = new Document({
        $id: ID.unique(),
        userId: user.getId(),
        userInternalId: user.getInternalId(),
        type: Auth.TOKEN_TYPE_OAUTH2,
        secret: Auth.hash(secret),
        expire: expire,
        userAgent: request.headers['user-agent'] || 'UNKNOWN',
        ip: request.ip,
      });

      const createdToken = await db.createDocument(
        'tokens',
        token.setAttribute('$permissions', [
          Permission.read(Role.user(user.getId())),
          Permission.update(Role.user(user.getId())),
          Permission.delete(Role.user(user.getId())),
        ]),
      );

      query.set('secret', secret);
      query.set('userId', user.getId());
    } else {
      // Create session
      const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN');
      const record = this.geodb.get(request.ip);
      const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION);

      const session = new Document({
        $id: ID.unique(),
        userId: user.getId(),
        userInternalId: user.getInternalId(),
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
        countryCode: record ? record.country.iso_code.toLowerCase() : '--',
        expire: expire,
        ...detector.getOS(),
        ...detector.getClient(),
        ...detector.getDevice(),
      });

      const createdSession = await db.createDocument(
        'sessions',
        session.setAttribute('$permissions', [
          Permission.read(Role.user(user.getId())),
          Permission.update(Role.user(user.getId())),
          Permission.delete(Role.user(user.getId())),
        ]),
      );

      if (!CONSOLE_CONFIG.domainVerification) {
        response.header(
          'X-Fallback-Cookies',
          JSON.stringify({
            [Auth.cookieName]: Auth.encodeSession(user.getId(), secret),
          }),
        );
      }

      if (parsedState.pathname === this.oauthDefaultSuccess) {
        query.set('project', project.getId());
        query.set('domain', Auth.cookieDomain);
        query.set('key', Auth.cookieName);
        query.set('secret', Auth.encodeSession(user.getId(), secret));
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
      );

      if (sessionUpgrade) {
        const targets = user.getAttribute('targets', []);
        for (const target of targets) {
          if (target.getAttribute('providerType') !== 'push') {
            continue;
          }
          target
            .setAttribute('sessionId', createdSession.getId())
            .setAttribute('sessionInternalId', createdSession.getInternalId());
          await db.updateDocument('targets', target.getId(), target);
        }
      }

      await this.eventEmitter.emitAsync(EVENT_SESSION_CREATE, {
        userId: user.getId(),
        sessionId: createdSession.getId(),
        payload: {
          data: createdSession,
          type: Models.SESSION,
        },
      });
    }

    await db.purgeCachedDocument('users', user.getId());

    parsedState.search = query.toString();
    const finalSuccessUrl = parsedState.toString();

    response
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(finalSuccessUrl);
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
    input: CreateOAuth2TokenDTO;
    request: NuvixRequest;
    response: NuvixRes;
    provider: OAuthProviders;
    project: Document;
  }) {
    const protocol = request.protocol;
    const success = input.success || '';
    const failure = input.failure || '';
    const scopes = input.scopes || [];

    const callback = `${protocol}://${request.hostname}/v1/account/sessions/oauth2/callback/${provider}/${project.getId()}`;
    const oAuthProviders = project.getAttribute('oAuthProviders', {});
    const providerEnabled = oAuthProviders[provider]?.enabled ?? false;

    if (!providerEnabled) {
      throw new Exception(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please enable the provider from your ${APP_NAME} console to continue.`,
      );
    }

    const appId = oAuthProviders[provider]?.appId ?? '';
    let appSecret = oAuthProviders[provider]?.secret ?? '{}';

    if (appSecret && typeof appSecret === 'object' && appSecret.version) {
      // TODO: Handle encrypted app secret decryption
    }

    if (!appId || !appSecret) {
      throw new Exception(
        Exception.PROJECT_PROVIDER_DISABLED,
        `This provider is disabled. Please configure the provider app ID and app secret key from your ${APP_NAME} console to continue.`,
      );
    }

    const AuthClass = await getOAuth2Class(provider);
    if (!AuthClass) {
      throw new Exception(Exception.PROJECT_PROVIDER_UNSUPPORTED);
    }

    const consoleDomain =
      request.hostname.split('.').length === 3
        ? `console.${request.hostname.split('.', 2)[1]}`
        : request.hostname;
    const finalSuccess =
      success || `${protocol}://${consoleDomain}${this.oauthDefaultSuccess}`;
    const finalFailure =
      failure || `${protocol}://${consoleDomain}${this.oauthDefaultFailure}`;

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
    );

    response
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      .header('Pragma', 'no-cache')
      .redirect(oauth2.getLoginURL());
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
    db: Database;
    user: Document;
    input: CreateMagicURLTokenDTO;
    request: NuvixRequest;
    response: NuvixRes;
    locale: LocaleTranslator;
    project: Document;
  }) {
    if (!APP_SMTP_HOST) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled');
    }

    const {
      userId,
      email,
      url: inputUrl = '',
      phrase: inputPhrase = false,
    } = input;
    let url = inputUrl;
    let phrase: string;

    if (inputPhrase === true) {
      phrase = PhraseGenerator.generate();
    }

    const result = await db.findOne('users', [Query.equal('email', [email])]);
    if (!result.isEmpty()) {
      user.setAttributes(result.toObject());
    } else {
      const limit = project.getAttribute('auths', {})['limit'] ?? 0;

      if (limit !== 0) {
        const total = await db.count('users', [], APP_LIMIT_USERS);

        if (total >= limit) {
          throw new Exception(Exception.USER_COUNT_EXCEEDED);
        }
      }

      // Makes sure this email is not already used in another identity
      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ]);
      if (!identityWithMatchingEmail.isEmpty()) {
        throw new Exception(Exception.USER_EMAIL_ALREADY_EXISTS);
      }

      const finalUserId = userId === 'unique()' ? ID.unique() : userId;

      user.setAttributes({
        $id: finalUserId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(finalUserId)),
          Permission.delete(Role.user(finalUserId)),
        ],
        email: email,
        emailVerification: false,
        status: true,
        password: null,
        hash: Auth.DEFAULT_ALGO,
        hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
        passwordUpdate: null,
        registration: new Date(),
        reset: false,
        mfa: false,
        prefs: {},
        sessions: null,
        tokens: null,
        memberships: null,
        authenticators: null,
        search: [finalUserId, email].join(' '),
        accessedAt: new Date(),
      });

      user.removeAttribute('$internalId');
      await Authorization.skip(
        async () => await db.createDocument('users', user),
      );
    }

    const tokenSecret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_MAGIC_URL);
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000);

    const token = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      type: Auth.TOKEN_TYPE_MAGIC_URL,
      secret: Auth.hash(tokenSecret), // One way hash encryption to protect DB leak
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    });

    Authorization.setRole(Role.user(user.getId()).toString());

    const createdToken = await db.createDocument(
      'tokens',
      token.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await db.purgeCachedDocument('users', user.getId());

    if (!url) {
      url = `${request.protocol}://${request.hostname}/console/auth/magic-url`;
    }

    // Parse and merge URL query parameters
    const urlObj = new URL(url);
    urlObj.searchParams.set('userId', user.getId());
    urlObj.searchParams.set('secret', tokenSecret);
    urlObj.searchParams.set('expire', expire.toISOString());
    urlObj.searchParams.set('project', project.getId());
    url = urlObj.toString();

    let subject = locale.getText('emails.magicSession.subject');
    const customTemplate =
      project.getAttribute('templates', {})[
        `email.magicSession-${locale.default}`
      ] ?? {};

    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN');
    const agentOs = detector.getOS();
    const agentClient = detector.getClient();
    const agentDevice = detector.getDevice();

    const templatePath = path.join(ASSETS.TEMPLATES, 'email-magic-url.tpl');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Template.compile(templateSource);

    const emailData = {
      hello: locale.getText('emails.magicSession.hello'),
      optionButton: locale.getText('emails.magicSession.optionButton'),
      buttonText: locale.getText('emails.magicSession.buttonText'),
      optionUrl: locale.getText('emails.magicSession.optionUrl'),
      clientInfo: locale.getText('emails.magicSession.clientInfo'),
      thanks: locale.getText('emails.magicSession.thanks'),
      signature: locale.getText('emails.magicSession.signature'),
      securityPhrase: phrase
        ? locale.getText('emails.magicSession.securityPhrase')
        : '',
    };

    let body = template(emailData);

    const smtp = project.getAttribute('smtp', {});
    const smtpEnabled = smtp['enabled'] ?? false;

    let senderEmail = APP_SYSTEM_EMAIL_ADDRESS || APP_EMAIL_TEAM;
    let senderName = APP_SYSTEM_EMAIL_NAME || APP_NAME + ' Server';
    let replyTo = '';

    const smtpServer: any = {};

    if (smtpEnabled) {
      if (smtp['senderEmail']) senderEmail = smtp['senderEmail'];
      if (smtp['senderName']) senderName = smtp['senderName'];
      if (smtp['replyTo']) replyTo = smtp['replyTo'];

      smtpServer['host'] = smtp['host'] || '';
      smtpServer['port'] = smtp['port'] || '';
      smtpServer['username'] = smtp['username'] || '';
      smtpServer['password'] = smtp['password'] || '';
      smtpServer['secure'] = smtp['secure'] ?? false;

      if (customTemplate) {
        if (customTemplate['senderEmail'])
          senderEmail = customTemplate['senderEmail'];
        if (customTemplate['senderName'])
          senderName = customTemplate['senderName'];
        if (customTemplate['replyTo']) replyTo = customTemplate['replyTo'];

        body = customTemplate['message'] || body;
        subject = customTemplate['subject'] || subject;
      }

      smtpServer['replyTo'] = replyTo;
      smtpServer['senderEmail'] = senderEmail;
      smtpServer['senderName'] = senderName;
    }

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.getAttribute('name'),
      project: project.getAttribute('name'),
      redirect: url,
      agentDevice: agentDevice['deviceBrand'] || 'UNKNOWN',
      agentClient: agentClient['clientName'] || 'UNKNOWN',
      agentOs: agentOs['osName'] || 'UNKNOWN',
      phrase: phrase || '',
    };

    await this.mailQueue.add(SEND_TYPE_EMAIL, {
      email,
      subject,
      body,
      server: smtpServer,
      variables: emailVariables,
    });

    createdToken.setAttribute('secret', tokenSecret);

    if (phrase) {
      createdToken.setAttribute('phrase', phrase);
    }

    response.status(201);
    return createdToken;
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
    db: Database;
    user: Document;
    input: CreateEmailTokenDTO;
    request: NuvixRequest;
    response: NuvixRes;
    locale: LocaleTranslator;
    project: Document;
  }) {
    if (!APP_SMTP_HOST) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled');
    }

    const { userId, email, phrase: inputPhrase = false } = input;
    let phrase: string;

    if (inputPhrase === true) {
      phrase = PhraseGenerator.generate();
    }

    const result = await db.findOne('users', [Query.equal('email', [email])]);
    if (!result.isEmpty()) {
      user.setAttributes(result.toObject());
    } else {
      const limit = project.getAttribute('auths', {})['limit'] ?? 0;

      if (limit !== 0) {
        const total = await db.count('users', [], APP_LIMIT_USERS);

        if (total >= limit) {
          throw new Exception(Exception.USER_COUNT_EXCEEDED);
        }
      }

      // Makes sure this email is not already used in another identity
      const identityWithMatchingEmail = await db.findOne('identities', [
        Query.equal('providerEmail', [email]),
      ]);
      if (!identityWithMatchingEmail.isEmpty()) {
        throw new Exception(Exception.GENERAL_BAD_REQUEST); // Return a generic bad request to prevent exposing existing accounts
      }

      const finalUserId = userId === 'unique()' ? ID.unique() : userId;

      user.setAttributes({
        $id: finalUserId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(finalUserId)),
          Permission.delete(Role.user(finalUserId)),
        ],
        email: email,
        emailVerification: false,
        status: true,
        password: null,
        hash: Auth.DEFAULT_ALGO,
        hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
        passwordUpdate: null,
        registration: new Date(),
        reset: false,
        prefs: {},
        sessions: null,
        tokens: null,
        memberships: null,
        search: [finalUserId, email].join(' '),
        accessedAt: new Date(),
      });

      user.removeAttribute('$internalId');
      await Authorization.skip(
        async () => await db.createDocument('users', user),
      );
    }

    const tokenSecret = Auth.codeGenerator(6);
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_OTP * 1000);

    const token = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      type: Auth.TOKEN_TYPE_EMAIL,
      secret: Auth.hash(tokenSecret), // One way hash encryption to protect DB leak
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    });

    Authorization.setRole(Role.user(user.getId()).toString());

    const createdToken = await db.createDocument(
      'tokens',
      token.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await db.purgeCachedDocument('users', user.getId());

    let subject = locale.getText('emails.otpSession.subject');
    const customTemplate =
      project.getAttribute('templates', {})[
        `email.otpSession-${locale.default}`
      ] ?? {};

    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN');
    const agentOs = detector.getOS();
    const agentClient = detector.getClient();
    const agentDevice = detector.getDevice();

    const templatePath = path.join(ASSETS.TEMPLATES, 'email-otp.tpl');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Template.compile(templateSource);

    const emailData = {
      hello: locale.getText('emails.otpSession.hello'),
      description: locale.getText('emails.otpSession.description'),
      clientInfo: locale.getText('emails.otpSession.clientInfo'),
      thanks: locale.getText('emails.otpSession.thanks'),
      signature: locale.getText('emails.otpSession.signature'),
      securityPhrase: phrase
        ? locale.getText('emails.otpSession.securityPhrase')
        : '',
    };

    let body = template(emailData);

    const smtp = project.getAttribute('smtp', {});
    const smtpEnabled = smtp['enabled'] ?? false;

    let senderEmail = APP_SYSTEM_EMAIL_ADDRESS || APP_EMAIL_TEAM;
    let senderName = APP_SYSTEM_EMAIL_NAME || APP_NAME + ' Server';
    let replyTo = '';

    const smtpServer: any = {};

    if (smtpEnabled) {
      if (smtp['senderEmail']) senderEmail = smtp['senderEmail'];
      if (smtp['senderName']) senderName = smtp['senderName'];
      if (smtp['replyTo']) replyTo = smtp['replyTo'];

      smtpServer['host'] = smtp['host'] || '';
      smtpServer['port'] = smtp['port'] || '';
      smtpServer['username'] = smtp['username'] || '';
      smtpServer['password'] = smtp['password'] || '';
      smtpServer['secure'] = smtp['secure'] ?? false;

      if (customTemplate) {
        if (customTemplate['senderEmail'])
          senderEmail = customTemplate['senderEmail'];
        if (customTemplate['senderName'])
          senderName = customTemplate['senderName'];
        if (customTemplate['replyTo']) replyTo = customTemplate['replyTo'];

        body = customTemplate['message'] || body;
        subject = customTemplate['subject'] || subject;
      }

      smtpServer['replyTo'] = replyTo;
      smtpServer['senderEmail'] = senderEmail;
      smtpServer['senderName'] = senderName;
    }

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.getAttribute('name'),
      project: project.getAttribute('name'),
      otp: tokenSecret,
      agentDevice: agentDevice['deviceBrand'] || 'UNKNOWN',
      agentClient: agentClient['clientName'] || 'UNKNOWN',
      agentOs: agentOs['osName'] || 'UNKNOWN',
      phrase: phrase || '',
    };

    await this.mailQueue.add(SEND_TYPE_EMAIL, {
      email,
      subject,
      body,
      server: smtpServer,
      variables: emailVariables,
    });

    createdToken.setAttribute('secret', tokenSecret);

    if (phrase) {
      createdToken.setAttribute('phrase', phrase);
    }

    response.status(201);
    return createdToken;
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
    db: Database;
    user: Document;
    input: CreatePhoneTokenDTO;
    request: NuvixRequest;
    response: NuvixRes;
    locale: LocaleTranslator;
    project: Document;
  }) {
    // Check if SMS provider is configured
    // TODO: import from constants
    if (!process.env._APP_SMS_PROVIDER) {
      throw new Exception(
        Exception.GENERAL_PHONE_DISABLED,
        'Phone provider not configured',
      );
    }

    const { userId, phone } = input;

    const result = await db.findOne('users', [Query.equal('phone', [phone])]);
    if (!result.isEmpty()) {
      user.setAttributes(result.toObject());
    } else {
      const limit = project.getAttribute('auths', {})['limit'] ?? 0;

      if (limit !== 0) {
        const total = await db.count('users', [], APP_LIMIT_USERS);

        if (total >= limit) {
          throw new Exception(Exception.USER_COUNT_EXCEEDED);
        }
      }

      const finalUserId = userId === 'unique()' ? ID.unique() : userId;
      user.setAttributes({
        $id: finalUserId,
        $permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(finalUserId)),
          Permission.delete(Role.user(finalUserId)),
        ],
        email: null,
        phone: phone,
        emailVerification: false,
        phoneVerification: false,
        status: true,
        password: null,
        passwordUpdate: null,
        registration: new Date(),
        reset: false,
        prefs: {},
        sessions: null,
        tokens: null,
        memberships: null,
        search: [finalUserId, phone].join(' '),
        accessedAt: new Date(),
      });

      user.removeAttribute('$internalId');
      await Authorization.skip(
        async () => await db.createDocument('users', user),
      );

      try {
        const target = await Authorization.skip(
          async () =>
            await db.createDocument(
              'targets',
              new Document({
                $permissions: [
                  Permission.read(Role.user(user.getId())),
                  Permission.update(Role.user(user.getId())),
                  Permission.delete(Role.user(user.getId())),
                ],
                userId: user.getId(),
                userInternalId: user.getInternalId(),
                providerType: 'sms',
                identifier: phone,
              }),
            ),
        );
        user.setAttribute('targets', [
          ...user.getAttribute('targets', []),
          target,
        ]);
      } catch (error) {
        if (error instanceof DuplicateException) {
          const existingTarget = await db.findOne('targets', [
            Query.equal('identifier', [phone]),
          ]);
          if (existingTarget && !existingTarget.isEmpty()) {
            user.setAttribute('targets', [
              ...user.getAttribute('targets', []),
              existingTarget,
            ]);
          }
        }
      }
      await db.purgeCachedDocument('users', user.getId());
    }

    let secret: string | null = null;
    let sendSMS = true;
    const mockNumbers = project.getAttribute('auths', {})['mockNumbers'] ?? [];

    for (const mockNumber of mockNumbers) {
      if (mockNumber['phone'] === phone) {
        secret = mockNumber['otp'];
        sendSMS = false;
        break;
      }
    }

    secret = secret ?? Auth.codeGenerator(6);
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_OTP * 1000);

    const token = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      type: Auth.TOKEN_TYPE_PHONE,
      secret: Auth.hash(secret),
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    });

    Authorization.setRole(Role.user(user.getId()).toString());

    const createdToken = await db.createDocument(
      'tokens',
      token.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await db.purgeCachedDocument('users', user.getId());

    if (sendSMS) {
      const customTemplate =
        project.getAttribute('templates', {})[`sms.login-${locale.default}`] ??
        {};

      let message = locale.getText('sms.verification.body');
      if (customTemplate && customTemplate['message']) {
        message = customTemplate['message'];
      }

      const messageContent = message
        .replace('{{project}}', project.getAttribute('name'))
        .replace('{{secret}}', secret);

      // TODO: Implement SMS queue functionality
      console.log(`SMS to ${phone}: ${messageContent}`);
    }

    // createdToken.setAttribute('secret', secret);
    createdToken.setAttribute(
      'secret',
      Auth.encodeSession(user.getId(), secret),
    );

    response.status(201);
    return createdToken;
  }

  /**
   * Send Session Alert.
   */
  async sendSessionAlert(
    locale: LocaleTranslator,
    user: Document,
    project: Document,
    session: Document,
  ) {
    let subject: string = locale.getText('emails.sessionAlert.subject');
    const customTemplate =
      project.getAttribute('templates', {})?.[
        'email.sessionAlert-' + locale.default
      ] ?? {};
    const templatePath = path.join(ASSETS.TEMPLATES, 'email-session-alert.tpl');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Template.compile(templateSource);

    const emailData = {
      hello: locale.getText('emails.sessionAlert.hello'),
      body: locale.getText('emails.sessionAlert.body'),
      listDevice: locale.getText('emails.sessionAlert.listDevice'),
      listIpAddress: locale.getText('emails.sessionAlert.listIpAddress'),
      listCountry: locale.getText('emails.sessionAlert.listCountry'),
      footer: locale.getText('emails.sessionAlert.footer'),
      thanks: locale.getText('emails.sessionAlert.thanks'),
      signature: locale.getText('emails.sessionAlert.signature'),
    };

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      date: new Date().toLocaleDateString(locale.default, {
        month: 'long',
        day: 'numeric',
      }),
      year: new Date().getFullYear(),
      time: new Date().toLocaleTimeString(locale.default),
      user: user.getAttribute('name'),
      project: project.getAttribute('name'),
      device: session.getAttribute('clientName'),
      ipAddress: session.getAttribute('ip'),
      country: locale.getText(
        'countries.' + session.getAttribute('countryCode'),
        locale.getText('locale.country.unknown'),
      ),
    };

    const smtpServer: object = {};

    let body = template(emailData);

    const smtp = project.getAttribute('smtp', {});
    const smtpEnabled = smtp['enabled'] ?? false;

    let senderEmail = APP_SYSTEM_EMAIL_ADDRESS || APP_EMAIL_TEAM;
    let senderName = APP_SYSTEM_EMAIL_NAME || APP_NAME + ' Server';
    let replyTo = '';

    if (smtpEnabled) {
      if (smtp['senderEmail']) senderEmail = smtp['senderEmail'];
      if (smtp['senderName']) senderName = smtp['senderName'];
      if (smtp['replyTo']) replyTo = smtp['replyTo'];

      smtpServer['host'] = smtp['host'] || null;
      smtpServer['port'] = smtp['port'] || null;
      smtpServer['username'] = smtp['username'] || null;
      smtpServer['password'] = smtp['password'] || null;
      smtpServer['secure'] = smtp['secure'] ?? false;

      if (customTemplate) {
        if (customTemplate['senderEmail'])
          senderEmail = customTemplate['senderEmail'];
        if (customTemplate['senderName'])
          senderName = customTemplate['senderName'];
        if (customTemplate['replyTo']) replyTo = customTemplate['replyTo'];

        body = customTemplate['message'] || body;
        subject = customTemplate['subject'] || subject;
      }

      smtpServer['replyTo'] = replyTo;
      smtpServer['senderEmail'] = senderEmail;
      smtpServer['senderName'] = senderName;
    }

    const email = user.getAttribute('email');

    await this.mailQueue.add(SEND_TYPE_EMAIL, {
      email,
      subject,
      body,
      server: smtpServer,
      variables: emailVariables,
    });
  }

  /**
   * Create JWT
   */
  async createJWT(user: Document, response: NuvixRes) {
    const sessions = user.getAttribute('sessions', []);
    let current = new Document();

    for (const session of sessions) {
      if (session.getAttribute('secret') === Auth.hash(Auth.secret)) {
        current = session;
        break;
      }
    }

    if (current.isEmpty()) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND);
    }

    const payload = {
      userId: user.getId(),
      sessionId: current.getId(),
    };

    const jwt = this.jwtService.sign(payload, {
      expiresIn: '15m', // 900 seconds
    });

    response.status(201);
    return new Document({ jwt });
  }

  /**
   * Update User Name.
   */
  async updateName(db: Database, name: string, user: Document) {
    user.setAttribute('name', name);

    user = await db.updateDocument('users', user.getId(), user);

    // TODO: Trigger Event

    return user;
  }

  /**
   * Update user password.
   */
  async updatePassword({
    password,
    oldPassword,
    user,
    project,
    db,
  }: {
    password: string;
    oldPassword: string;
    user: Document;
    project: Document;
    db: Database;
  }) {
    // Check old password only if its an existing user.
    if (
      user.getAttribute('passwordUpdate') &&
      !(await Auth.passwordVerify(
        oldPassword,
        user.getAttribute('password'),
        user.getAttribute('hash'),
        user.getAttribute('hashOptions'),
      ))
    ) {
      throw new Exception(Exception.USER_INVALID_CREDENTIALS);
    }

    const newPassword = await Auth.passwordHash(
      password,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    );
    const historyLimit =
      project.getAttribute('auths', {})['passwordHistory'] ?? 0;
    const history = user.getAttribute('passwordHistory', []);

    if (historyLimit > 0) {
      const validator = new PasswordHistoryValidator(
        history,
        user.getAttribute('hash'),
        user.getAttribute('hashOptions'),
      );
      if (!validator.isValid(password)) {
        throw new Exception(Exception.USER_PASSWORD_RECENTLY_USED);
      }

      history.push(newPassword);
      history.splice(0, Math.max(0, history.length - historyLimit));
    }

    if (project.getAttribute('auths', {})['personalDataCheck'] ?? false) {
      const personalDataValidator = new PersonalDataValidator(
        user.getId(),
        user.getAttribute('email'),
        user.getAttribute('name'),
        user.getAttribute('phone'),
      );
      if (!personalDataValidator.isValid(password)) {
        throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA);
      }
    }

    // hooks.trigger('passwordValidator', [db, project, password, user, true]);

    user
      .setAttribute('password', newPassword)
      .setAttribute('passwordHistory', history)
      .setAttribute('passwordUpdate', new Date())
      .setAttribute('hash', Auth.DEFAULT_ALGO)
      .setAttribute('hashOptions', Auth.DEFAULT_ALGO_OPTIONS);

    user = await db.updateDocument('users', user.getId(), user);

    // TODO: Handle Events
    // queueForEvents.setParam('userId', user.getId());

    return user;
  }

  /**
   * Update User's Phone.
   */
  async updatePhone({
    password,
    phone,
    user,
    project,
    db,
  }: {
    password: string;
    phone: string;
    user: Document;
    project: Document;
    db: Database;
  }) {
    // passwordUpdate will be empty if the user has never set a password
    const passwordUpdate = user.getAttribute('passwordUpdate');

    if (
      passwordUpdate &&
      !(await Auth.passwordVerify(
        password,
        user.getAttribute('password'),
        user.getAttribute('hash'),
        user.getAttribute('hashOptions'),
      ))
    ) {
      // Double check user password
      throw new Exception(Exception.USER_INVALID_CREDENTIALS);
    }

    // hooks.trigger('passwordValidator', [db, project, password, user, false]);

    const target = await Authorization.skip(
      async () =>
        await db.findOne('targets', [Query.equal('identifier', [phone])]),
    );

    if (!target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
    }

    const oldPhone = user.getAttribute('phone');

    user.setAttribute('phone', phone).setAttribute('phoneVerification', false); // After this user needs to confirm phone number again

    if (!passwordUpdate) {
      const hashedPassword = await Auth.passwordHash(
        password,
        Auth.DEFAULT_ALGO,
        Auth.DEFAULT_ALGO_OPTIONS,
      );
      user
        .setAttribute('password', hashedPassword)
        .setAttribute('hash', Auth.DEFAULT_ALGO)
        .setAttribute('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
        .setAttribute('passwordUpdate', new Date());
    }

    try {
      user = await db.updateDocument('users', user.getId(), user);
      const oldTarget = user.find<any>('identifier', oldPhone, 'targets');

      if (oldTarget && !oldTarget.isEmpty()) {
        await Authorization.skip(
          async () =>
            await db.updateDocument(
              'targets',
              oldTarget.getId(),
              oldTarget.setAttribute('identifier', phone),
            ),
        );
      }
      await db.purgeCachedDocument('users', user.getId());
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_PHONE_ALREADY_EXISTS);
      }
      throw error;
    }

    // TODO: Handle Events
    // queueForEvents.setParam('userId', user.getId());

    return user;
  }

  /**
   * Update Status
   */
  async updateStatus({
    db,
    user,
    request,
    response,
  }: {
    db: Database;
    user: Document;
    request: NuvixRequest;
    response: NuvixRes;
  }) {
    user.setAttribute('status', false);

    user = await db.updateDocument('users', user.getId(), user);

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setPayload(response.output(user, Response.MODEL_ACCOUNT));

    if (!CONSOLE_CONFIG.domainVerification) {
      response.header('X-Fallback-Cookies', JSON.stringify([]));
    }

    const protocol = request.protocol;
    response.cookie(Auth.cookieName, '', {
      expires: new Date(Date.now() - 3600000),
      path: '/',
      domain: Auth.cookieDomain,
      secure: protocol === 'https',
      httpOnly: true,
      sameSite: Auth.cookieSamesite,
    });

    return user;
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
    authDatabase,
  }: {
    user: Document;
    input: CreateSessionDTO;
    request: NuvixRequest;
    response: NuvixRes;
    locale: LocaleTranslator;
    project: Document;
    authDatabase: Database;
  }) {
    const userFromRequest = await Authorization.skip(
      async () => await authDatabase.getDocument('users', input.userId),
    );

    if (userFromRequest.isEmpty()) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    const verifiedToken = Auth.tokenVerify(
      userFromRequest.getAttribute('tokens', []),
      null,
      input.secret,
    );

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    user.setAttributes(userFromRequest.toObject());

    const duration =
      project.getAttribute('auths', {})['duration'] ??
      Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN');
    const record = this.geodb.get(request.ip);
    const sessionSecret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION);

    const tokenType = verifiedToken.getAttribute('type');
    let factor: string;

    switch (tokenType) {
      case Auth.TOKEN_TYPE_MAGIC_URL:
      case Auth.TOKEN_TYPE_OAUTH2:
      case Auth.TOKEN_TYPE_EMAIL:
        factor = 'email';
        break;
      case Auth.TOKEN_TYPE_PHONE:
        factor = 'phone';
        break;
      case Auth.TOKEN_TYPE_GENERIC:
        factor = 'token';
        break;
      default:
        throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    const session = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      provider: Auth.getSessionProviderByTokenType(
        verifiedToken.getAttribute('type'),
      ),
      secret: Auth.hash(sessionSecret),
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
      factors: [factor],
      countryCode: record ? record.country.iso_code.toLowerCase() : '--',
      expire: new Date(Date.now() + duration * 1000),
      ...detector.getOS(),
      ...detector.getClient(),
      ...detector.getDevice(),
    });

    Authorization.setRole(Role.user(user.getId()).toString());

    const createdSession = await authDatabase.createDocument(
      'sessions',
      session.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await Authorization.skip(
      async () =>
        await authDatabase.deleteDocument('tokens', verifiedToken.getId()),
    );
    await authDatabase.purgeCachedDocument('users', user.getId());

    // Magic URL + Email OTP
    if (
      tokenType === Auth.TOKEN_TYPE_MAGIC_URL ||
      tokenType === Auth.TOKEN_TYPE_EMAIL
    ) {
      user.setAttribute('emailVerification', true);
    }

    if (tokenType === Auth.TOKEN_TYPE_PHONE) {
      user.setAttribute('phoneVerification', true);
    }

    try {
      await authDatabase.updateDocument('users', user.getId(), user);
    } catch (error) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed saving user to DB',
      );
    }

    const isAllowedTokenType =
      tokenType !== Auth.TOKEN_TYPE_MAGIC_URL &&
      tokenType !== Auth.TOKEN_TYPE_EMAIL;
    const hasUserEmail = user.getAttribute('email', false) !== false;
    const isSessionAlertsEnabled =
      project.getAttribute('auths', {})['sessionAlerts'] ?? false;

    const sessionCount = await authDatabase.count('sessions', [
      Query.equal('userId', [user.getId()]),
    ]);
    const isNotFirstSession = sessionCount !== 1;

    if (
      isAllowedTokenType &&
      hasUserEmail &&
      isSessionAlertsEnabled &&
      isNotFirstSession
    ) {
      await this.sendSessionAlert(locale, user, project, createdSession);
    }

    await this.eventEmitter.emitAsync(EVENT_SESSION_CREATE, {
      userId: user.getId(),
      sessionId: createdSession.getId(),
      payload: {
        data: createdSession,
        type: Models.SESSION,
      },
    });

    if (!CONSOLE_CONFIG.domainVerification) {
      response.header(
        'X-Fallback-Cookies',
        JSON.stringify({
          [Auth.cookieName]: Auth.encodeSession(user.getId(), sessionSecret),
        }),
      );
    }

    const expire = new Date(Date.now() + duration * 1000);
    const protocol = request.protocol;

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
      .status(201);

    const countryName = locale.getText(
      'countries.' +
        createdSession.getAttribute('countryCode', '').toLowerCase(),
      locale.getText('locale.country.unknown'),
    );

    createdSession
      .setAttribute('current', true)
      .setAttribute('countryName', countryName)
      .setAttribute('expire', expire.toISOString())
      .setAttribute('secret', Auth.encodeSession(user.getId(), sessionSecret));

    return createdSession;
  }

  /**
   * Create Recovery
   */
  async createRecovery({
    db,
    request,
    response,
    user,
    project,
    locale,
    input,
  }: WithDB<
    WithReqRes<WithUser<WithProject<WithLocale<{ input: CreateRecoveryDTO }>>>>
  >) {
    if (!APP_SMTP_HOST) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled');
    }

    const email = input.email.toLowerCase();
    let url = input.url;

    const profile = await db.findOne('users', [Query.equal('email', [email])]);

    if (profile.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    user.setAttributes(profile.toObject());

    if (profile.getAttribute('status') === false) {
      throw new Exception(Exception.USER_BLOCKED);
    }

    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_RECOVERY * 1000);
    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_RECOVERY);

    const recovery = new Document({
      $id: ID.unique(),
      userId: profile.getId(),
      userInternalId: profile.getInternalId(),
      type: Auth.TOKEN_TYPE_RECOVERY,
      secret: Auth.hash(secret), // One way hash encryption to protect DB leak
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    });

    Authorization.setRole(Role.user(profile.getId()).toString());

    const createdRecovery = await db.createDocument(
      'tokens',
      recovery.setAttribute('$permissions', [
        Permission.read(Role.user(profile.getId())),
        Permission.update(Role.user(profile.getId())),
        Permission.delete(Role.user(profile.getId())),
      ]),
    );

    await db.purgeCachedDocument('users', profile.getId());

    // Parse and merge URL query parameters
    const urlObj = new URL(url);
    urlObj.searchParams.set('userId', profile.getId());
    urlObj.searchParams.set('secret', secret);
    urlObj.searchParams.set('expire', expire.toISOString());
    url = urlObj.toString();

    const projectName = project.isEmpty()
      ? 'Console'
      : project.getAttribute('name', '[APP-NAME]');
    let body = locale.getText('emails.recovery.body');
    let subject = locale.getText('emails.recovery.subject');
    const customTemplate =
      project.getAttribute('templates', {})[
        `email.recovery-${locale.default}`
      ] ?? {};

    const templatePath = path.join(ASSETS.TEMPLATES, 'email-inner-base.tpl');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Template.compile(templateSource);

    const emailData = {
      body: body,
      hello: locale.getText('emails.recovery.hello'),
      footer: locale.getText('emails.recovery.footer'),
      thanks: locale.getText('emails.recovery.thanks'),
      signature: locale.getText('emails.recovery.signature'),
    };

    body = template(emailData);

    const smtp = project.getAttribute('smtp', {});
    const smtpEnabled = smtp['enabled'] ?? false;

    let senderEmail = APP_SYSTEM_EMAIL_ADDRESS || APP_EMAIL_TEAM;
    let senderName = APP_SYSTEM_EMAIL_NAME || APP_NAME + ' Server';
    let replyTo = '';

    const smtpServer: any = {};

    if (smtpEnabled) {
      if (smtp['senderEmail']) senderEmail = smtp['senderEmail'];
      if (smtp['senderName']) senderName = smtp['senderName'];
      if (smtp['replyTo']) replyTo = smtp['replyTo'];

      smtpServer['host'] = smtp['host'] || '';
      smtpServer['port'] = smtp['port'] || '';
      smtpServer['username'] = smtp['username'] || '';
      smtpServer['password'] = smtp['password'] || '';
      smtpServer['secure'] = smtp['secure'] ?? false;

      if (customTemplate) {
        if (customTemplate['senderEmail'])
          senderEmail = customTemplate['senderEmail'];
        if (customTemplate['senderName'])
          senderName = customTemplate['senderName'];
        if (customTemplate['replyTo']) replyTo = customTemplate['replyTo'];

        body = customTemplate['message'] || body;
        subject = customTemplate['subject'] || subject;
      }

      smtpServer['replyTo'] = replyTo;
      smtpServer['senderEmail'] = senderEmail;
      smtpServer['senderName'] = senderName;
    }

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: profile.getAttribute('name'),
      redirect: url,
      project: projectName,
      team: '',
    };

    await this.mailQueue.add(SEND_TYPE_EMAIL, {
      email: profile.getAttribute('email', ''),
      subject,
      body,
      server: smtpServer,
      variables: emailVariables,
    });

    createdRecovery.setAttribute('secret', secret);

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', profile.getId())
    //   .setParam('tokenId', createdRecovery.getId())
    //   .setUser(profile)
    //   .setPayload(Response.showSensitive(() => response.output(createdRecovery, Response.MODEL_TOKEN)), { sensitive: ['secret'] });

    response.status(201);
    return createdRecovery;
  }

  /**
   * Update password recovery (confirmation)
   */
  async updateRecovery({
    db,
    project,
    user,
    response,
    input,
  }: WithDB<
    WithProject<WithUser<{ response: NuvixRes; input: UpdateRecoveryDTO }>>
  >) {
    const profile = await db.getDocument('users', input.userId);

    if (profile.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const tokens = profile.getAttribute('tokens', []);
    const verifiedToken = Auth.tokenVerify(
      tokens,
      Auth.TOKEN_TYPE_RECOVERY,
      input.secret,
    );

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    Authorization.setRole(Role.user(profile.getId()).toString());

    const newPassword = await Auth.passwordHash(
      input.password,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    );

    const historyLimit =
      project.getAttribute('auths', {})['passwordHistory'] ?? 0;
    let history = profile.getAttribute('passwordHistory', []);

    if (historyLimit > 0) {
      const validator = new PasswordHistoryValidator(
        history,
        profile.getAttribute('hash'),
        profile.getAttribute('hashOptions'),
      );
      if (!validator.isValid(input.password)) {
        throw new Exception(Exception.USER_PASSWORD_RECENTLY_USED);
      }

      history.push(newPassword);
      history = history.slice(Math.max(0, history.length - historyLimit));
    }

    // hooks.trigger('passwordValidator', [db, project, input.password, user, true]);

    const updatedProfile = await db.updateDocument(
      'users',
      profile.getId(),
      profile
        .setAttribute('password', newPassword)
        .setAttribute('passwordHistory', history)
        .setAttribute('passwordUpdate', new Date())
        .setAttribute('hash', Auth.DEFAULT_ALGO)
        .setAttribute('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
        .setAttribute('emailVerification', true),
    );

    user.setAttributes(updatedProfile.toObject());

    const recoveryDocument = await db.getDocument(
      'tokens',
      verifiedToken.getId(),
    );

    /**
     * We act like we're updating and validating
     * the recovery token but actually we don't need it anymore.
     */
    await db.deleteDocument('tokens', verifiedToken.getId());
    await db.purgeCachedDocument('users', profile.getId());

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', profile.getId())
    //   .setParam('tokenId', recoveryDocument.getId())
    //   .setPayload(Response.showSensitive(() => response.output(recoveryDocument, Response.MODEL_TOKEN)), { sensitive: ['secret'] });

    response.status(200);
    return recoveryDocument;
  }

  /**
   * Create email verification token
   */
  async createEmailVerification({
    db,
    user,
    request,
    response,
    locale,
    project,
    url,
  }: WithDB<WithReqRes<WithUser<WithProject<WithLocale<{ url: string }>>>>>) {
    if (!APP_SMTP_HOST) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP Disabled');
    }

    if (user.getAttribute('emailVerification')) {
      throw new Exception(Exception.USER_EMAIL_ALREADY_VERIFIED);
    }

    const verificationSecret = Auth.tokenGenerator(
      Auth.TOKEN_LENGTH_VERIFICATION,
    );
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000);

    const verification = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      type: Auth.TOKEN_TYPE_VERIFICATION,
      secret: Auth.hash(verificationSecret), // One way hash encryption to protect DB leak
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    });

    Authorization.setRole(Role.user(user.getId()).toString());

    const createdVerification = await db.createDocument(
      'tokens',
      verification.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await db.purgeCachedDocument('users', user.getId());

    // Parse and merge URL query parameters
    const urlObj = new URL(url);
    urlObj.searchParams.set('userId', user.getId());
    urlObj.searchParams.set('secret', verificationSecret);
    urlObj.searchParams.set('expire', expire.toISOString());
    const finalUrl = urlObj.toString();

    const projectName = project.isEmpty()
      ? 'Console'
      : project.getAttribute('name', '[APP-NAME]');
    let body = locale.getText('emails.verification.body');
    let subject = locale.getText('emails.verification.subject');
    const customTemplate =
      project.getAttribute('templates', {})[
        `email.verification-${locale.default}`
      ] ?? {};

    const templatePath = path.join(ASSETS.TEMPLATES, 'email-inner-base.tpl');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Template.compile(templateSource);

    const emailData = {
      body: body,
      hello: locale.getText('emails.verification.hello'),
      footer: locale.getText('emails.verification.footer'),
      thanks: locale.getText('emails.verification.thanks'),
      signature: locale.getText('emails.verification.signature'),
    };

    body = template(emailData);

    const smtp = project.getAttribute('smtp', {});
    const smtpEnabled = smtp['enabled'] ?? false;

    let senderEmail = APP_SYSTEM_EMAIL_ADDRESS || APP_EMAIL_TEAM;
    let senderName = APP_SYSTEM_EMAIL_NAME || APP_NAME + ' Server';
    let replyTo = '';

    const smtpServer: any = {};

    if (smtpEnabled) {
      if (smtp['senderEmail']) senderEmail = smtp['senderEmail'];
      if (smtp['senderName']) senderName = smtp['senderName'];
      if (smtp['replyTo']) replyTo = smtp['replyTo'];

      smtpServer['host'] = smtp['host'] || '';
      smtpServer['port'] = smtp['port'] || '';
      smtpServer['username'] = smtp['username'] || '';
      smtpServer['password'] = smtp['password'] || '';
      smtpServer['secure'] = smtp['secure'] ?? false;

      if (customTemplate) {
        if (customTemplate['senderEmail'])
          senderEmail = customTemplate['senderEmail'];
        if (customTemplate['senderName'])
          senderName = customTemplate['senderName'];
        if (customTemplate['replyTo']) replyTo = customTemplate['replyTo'];

        body = customTemplate['message'] || body;
        subject = customTemplate['subject'] || subject;
      }

      smtpServer['replyTo'] = replyTo;
      smtpServer['senderEmail'] = senderEmail;
      smtpServer['senderName'] = senderName;
    }

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.getAttribute('name'),
      redirect: finalUrl,
      project: projectName,
      team: '',
    };

    await this.mailQueue.add(SEND_TYPE_EMAIL, {
      email: user.getAttribute('email'),
      subject,
      body,
      server: smtpServer,
      variables: emailVariables,
    });

    createdVerification.setAttribute('secret', verificationSecret);

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setParam('tokenId', createdVerification.getId())
    //   .setPayload(Response.showSensitive(() => response.output(createdVerification, Response.MODEL_TOKEN)), { sensitive: ['secret'] });

    response.status(201);
    return createdVerification;
  }

  /**
   * Verify email
   */
  async updateEmailVerification({
    db,
    user,
    response,
    userId,
    secret,
  }: WithDB<WithUser<{ response: NuvixRes; userId: string; secret: string }>>) {
    const profile = await Authorization.skip(
      async () => await db.getDocument('users', userId),
    );

    if (profile.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const tokens = profile.getAttribute('tokens', []);
    const verifiedToken = Auth.tokenVerify(
      tokens,
      Auth.TOKEN_TYPE_VERIFICATION,
      secret,
    );

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    Authorization.setRole(Role.user(profile.getId()).toString());

    const updatedProfile = await db.updateDocument(
      'users',
      profile.getId(),
      profile.setAttribute('emailVerification', true),
    );

    user.setAttributes(updatedProfile.toObject());

    const verification = await db.getDocument('tokens', verifiedToken.getId());

    /**
     * We act like we're updating and validating
     * the verification token but actually we don't need it anymore.
     */
    await db.deleteDocument('tokens', verifiedToken.getId());
    await db.purgeCachedDocument('users', profile.getId());

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', userId)
    //   .setParam('tokenId', verification.getId())
    //   .setPayload(Response.showSensitive(() => response.output(verification, Response.MODEL_TOKEN)), { sensitive: ['secret'] });

    return verification;
  }

  /**
   * Create phone verification token
   */
  async createPhoneVerification({
    db,
    user,
    request,
    response,
    locale,
    project,
  }: WithDB<WithReqRes<WithUser<WithProject<WithLocale<{}>>>>>) {
    // Check if SMS provider is configured
    if (!process.env._APP_SMS_PROVIDER) {
      throw new Exception(
        Exception.GENERAL_PHONE_DISABLED,
        'Phone provider not configured',
      );
    }

    const phone = user.getAttribute('phone');
    if (!phone) {
      throw new Exception(Exception.USER_PHONE_NOT_FOUND);
    }

    if (user.getAttribute('phoneVerification')) {
      throw new Exception(Exception.USER_PHONE_ALREADY_VERIFIED);
    }

    let secret: string | null = null;
    let sendSMS = true;
    const mockNumbers = project.getAttribute('auths', {})['mockNumbers'] ?? [];

    for (const mockNumber of mockNumbers) {
      if (mockNumber['phone'] === phone) {
        secret = mockNumber['otp'];
        sendSMS = false;
        break;
      }
    }

    secret = secret ?? Auth.codeGenerator(6);
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000);

    const verification = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      type: Auth.TOKEN_TYPE_PHONE,
      secret: Auth.hash(secret),
      expire: expire,
      userAgent: request.headers['user-agent'] || 'UNKNOWN',
      ip: request.ip,
    });

    Authorization.setRole(Role.user(user.getId()).toString());

    const createdVerification = await db.createDocument(
      'tokens',
      verification.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await db.purgeCachedDocument('users', user.getId());

    if (sendSMS) {
      const customTemplate =
        project.getAttribute('templates', {})[
          `sms.verification-${locale.default}`
        ] ?? {};

      let message = locale.getText('sms.verification.body');
      if (customTemplate && customTemplate['message']) {
        message = customTemplate['message'];
      }

      const messageContent = message
        .replace('{{project}}', project.getAttribute('name'))
        .replace('{{secret}}', secret);

      // TODO: Implement SMS queue functionality
      console.log(`SMS to ${phone}: ${messageContent}`);

      // TODO: Handle stats and abuse tracking if needed
      // Similar to the PHP implementation with metrics tracking
    }

    createdVerification.setAttribute('secret', secret);

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setParam('tokenId', createdVerification.getId())
    //   .setPayload(Response.showSensitive(() => response.output(createdVerification, Response.MODEL_TOKEN)), { sensitive: ['secret'] });

    response.status(201);
    return createdVerification;
  }

  /**
   * Verify phone number
   */
  async updatePhoneVerification({
    db,
    user,
    userId,
    secret,
  }: WithDB<WithUser<{ userId: string; secret: string }>>) {
    const profile = await Authorization.skip(
      async () => await db.getDocument('users', userId),
    );

    if (profile.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    const tokens = user.getAttribute('tokens', []);
    const verifiedToken = Auth.tokenVerify(
      tokens,
      Auth.TOKEN_TYPE_PHONE,
      secret,
    );

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    Authorization.setRole(Role.user(profile.getId()).toString());

    const updatedProfile = await db.updateDocument(
      'users',
      profile.getId(),
      profile.setAttribute('phoneVerification', true),
    );

    user.setAttributes(updatedProfile.toObject());

    const verificationDocument = await db.getDocument(
      'tokens',
      verifiedToken.getId(),
    );

    /**
     * We act like we're updating and validating the verification token but actually we don't need it anymore.
     */
    await db.deleteDocument('tokens', verifiedToken.getId());
    await db.purgeCachedDocument('users', profile.getId());

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setParam('tokenId', verificationDocument.getId())
    //   .setPayload(Response.showSensitive(() => response.output(verificationDocument, Response.MODEL_TOKEN)), { sensitive: ['secret'] });

    return verificationDocument;
  }

  /**
   * Update MFA
   */
  async updateMfa({
    db,
    user,
    mfa,
    session,
  }: WithDB<WithUser<{ mfa: boolean; session?: Document }>>) {
    user.setAttribute('mfa', mfa);

    user = await db.updateDocument('users', user.getId(), user);

    if (mfa && session) {
      let factors = session.getAttribute('factors', []);

      const totp = TOTP.getAuthenticatorFromUser(user);
      if (totp && totp.getAttribute('verified', false)) {
        factors.push('totp');
      }

      if (
        user.getAttribute('email', false) &&
        user.getAttribute('emailVerification', false)
      ) {
        factors.push('email');
      }

      if (
        user.getAttribute('phone', false) &&
        user.getAttribute('phoneVerification', false)
      ) {
        factors.push('phone');
      }

      factors = [...new Set(factors)]; // Ensure unique factors

      session.setAttribute('factors', factors);
      await db.updateDocument('sessions', session.getId(), session);
    }

    // TODO: Handle Events
    // queueForEvents.setParam('userId', user.getId());

    return user;
  }

  /**
   * Get Mfa factors
   */
  async getMfaFactors(user: Document) {
    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);
    const recoveryCodeEnabled =
      Array.isArray(mfaRecoveryCodes) && mfaRecoveryCodes.length > 0;

    const totp = TOTP.getAuthenticatorFromUser(user);

    const factors = new Document({
      totp: totp !== null && totp.getAttribute('verified', false),
      email:
        user.getAttribute('email', false) &&
        user.getAttribute('emailVerification', false),
      phone:
        user.getAttribute('phone', false) &&
        user.getAttribute('phoneVerification', false),
      recoveryCode: recoveryCodeEnabled,
    });

    return factors;
  }

  /**
   * Create authenticator
   */
  async createMfaAuthenticator({
    db,
    user,
    type,
    project,
  }: WithDB<WithUser<WithProject<{ type: string }>>>) {
    let otp: TOTP;

    switch (type) {
      case 'totp':
        otp = new TOTP();
        break;
      default:
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'Unknown type.',
        );
    }

    otp.setLabel(user.getAttribute('email'));
    otp.setIssuer(project.getAttribute('name'));

    const authenticator = TOTP.getAuthenticatorFromUser(user);

    if (authenticator) {
      if (authenticator.getAttribute('verified')) {
        throw new Exception(Exception.USER_AUTHENTICATOR_ALREADY_VERIFIED);
      }
      await db.deleteDocument('authenticators', authenticator.getId());
    }

    const newAuthenticator = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      type: 'totp',
      verified: false,
      data: {
        secret: otp.getSecret(),
      },
      $permissions: [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ],
    });

    const model = new Document({
      secret: otp.getSecret(),
      uri: otp.getProvisioningUri(),
    });

    await db.createDocument('authenticators', newAuthenticator);
    await db.purgeCachedDocument('users', user.getId());

    // TODO: Handle Events
    // queueForEvents.setParam('userId', user.getId());

    return model;
  }

  /**
   * Update authenticator (confirmation)
   */
  async verifyMfaAuthenticator({
    type,
    otp,
    user,
    session,
    db,
  }: WithDB<WithUser<{ session: Document; otp: string; type: string }>>) {
    let authenticator: Document | null = null;

    switch (type) {
      case MfaType.TOTP:
        authenticator = TOTP.getAuthenticatorFromUser(user);
        break;
      default:
        authenticator = null;
    }

    if (!authenticator) {
      throw new Exception(Exception.USER_AUTHENTICATOR_NOT_FOUND);
    }

    if (authenticator.getAttribute('verified')) {
      throw new Exception(Exception.USER_AUTHENTICATOR_ALREADY_VERIFIED);
    }

    let success = false;
    switch (type) {
      case MfaType.TOTP:
        success = TOTPChallenge.verify(user, otp);
        break;
      default:
        success = false;
    }

    if (!success) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    authenticator.setAttribute('verified', true);

    await db.updateDocument(
      'authenticators',
      authenticator.getId(),
      authenticator,
    );
    await db.purgeCachedDocument('users', user.getId());

    const factors = session.getAttribute('factors', []);
    factors.push(type);
    const uniqueFactors = [...new Set(factors)];

    session.setAttribute('factors', uniqueFactors);
    await db.updateDocument('sessions', session.getId(), session);

    // TODO: Handle Events
    // queueForEvents.setParam('userId', user.getId());

    return user;
  }

  /**
   * Create MFA recovery codes
   */
  async createMfaRecoveryCodes({ user, db }: WithDB<WithUser>) {
    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);

    if (mfaRecoveryCodes.length > 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_ALREADY_EXISTS);
    }

    const newRecoveryCodes = TOTP.generateBackupCodes();
    user.setAttribute('mfaRecoveryCodes', newRecoveryCodes);
    await db.updateDocument('users', user.getId(), user);

    // TODO: Handle Events
    // queueForEvents.setParam('userId', user.getId());

    const document = new Document({
      recoveryCodes: newRecoveryCodes,
    });

    return document;
  }

  /**
   * Update MFA recovery codes (regenerate)
   */
  async updateMfaRecoveryCodes({ user, db }: WithDB<WithUser>) {
    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);

    if (mfaRecoveryCodes.length === 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND);
    }

    const newMfaRecoveryCodes = TOTP.generateBackupCodes();
    user.setAttribute('mfaRecoveryCodes', newMfaRecoveryCodes);
    await db.updateDocument('users', user.getId(), user);

    // TODO: Handle Events
    // queueForEvents.setParam('userId', user.getId());

    const document = new Document({
      recoveryCodes: newMfaRecoveryCodes,
    });

    return document;
  }

  /**
   * Delete Authenticator
   */
  async deleteMfaAuthenticator({
    user,
    db,
    type,
  }: WithDB<WithUser<{ type: string }>>) {
    const authenticator = (() => {
      switch (type) {
        case MfaType.TOTP:
          return TOTP.getAuthenticatorFromUser(user);
        default:
          return null;
      }
    })();

    if (!authenticator) {
      throw new Exception(Exception.USER_AUTHENTICATOR_NOT_FOUND);
    }

    await db.deleteDocument('authenticators', authenticator.getId());
    await db.purgeCachedDocument('users', user.getId());

    // TODO: Handle Events
    // queueForEvents.setParam('userId', user.getId());

    return {};
  }

  /**
   * Create MFA Challenge
   */
  async createMfaChallenge({
    db,
    user,
    request,
    response,
    locale,
    project,
    userId,
    factor,
  }: WithDB<
    WithUser<WithProject<WithReqRes<WithLocale<CreateMfaChallengeDTO>>>>
  >) {
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_CONFIRM * 1000);
    const code = Auth.codeGenerator(6);

    const challenge = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      type: factor,
      token: Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION),
      code: code,
      expire: expire,
      $permissions: [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ],
    });

    const createdChallenge = await db.createDocument('challenges', challenge);

    switch (factor) {
      case TOTP.PHONE:
        if (!process.env._APP_SMS_PROVIDER) {
          throw new Exception(
            Exception.GENERAL_PHONE_DISABLED,
            'Phone provider not configured',
          );
        }
        if (!user.getAttribute('phone')) {
          throw new Exception(Exception.USER_PHONE_NOT_FOUND);
        }
        if (!user.getAttribute('phoneVerification')) {
          throw new Exception(Exception.USER_PHONE_NOT_VERIFIED);
        }

        const customSmsTemplate =
          project.getAttribute('templates', {})[
            `sms.mfaChallenge-${locale.default}`
          ] ?? {};

        let smsMessage = locale.getText('sms.verification.body');
        if (customSmsTemplate && customSmsTemplate['message']) {
          smsMessage = customSmsTemplate['message'];
        }

        const smsContent = smsMessage
          .replace('{{project}}', project.getAttribute('name'))
          .replace('{{secret}}', code);

        const phone = user.getAttribute('phone');

        // TODO: Implement SMS queue functionality
        console.log(`SMS MFA Challenge to ${phone}: ${smsContent}`);

        // TODO: Implement usage metrics and abuse tracking
        break;

      case TOTP.EMAIL:
        if (!APP_SMTP_HOST) {
          throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled');
        }
        if (!user.getAttribute('email')) {
          throw new Exception(Exception.USER_EMAIL_NOT_FOUND);
        }
        if (!user.getAttribute('emailVerification')) {
          throw new Exception(Exception.USER_EMAIL_NOT_VERIFIED);
        }

        let subject = locale.getText('emails.mfaChallenge.subject');
        const customEmailTemplate =
          project.getAttribute('templates', {})[
            `email.mfaChallenge-${locale.default}`
          ] ?? {};

        const detector = new Detector(
          request.headers['user-agent'] || 'UNKNOWN',
        );
        const agentOs = detector.getOS();
        const agentClient = detector.getClient();
        const agentDevice = detector.getDevice();

        const templatePath = path.join(
          ASSETS.TEMPLATES,
          'email-mfa-challenge.tpl',
        );
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const template = Template.compile(templateSource);

        const emailData = {
          hello: locale.getText('emails.mfaChallenge.hello'),
          description: locale.getText('emails.mfaChallenge.description'),
          clientInfo: locale.getText('emails.mfaChallenge.clientInfo'),
          thanks: locale.getText('emails.mfaChallenge.thanks'),
          signature: locale.getText('emails.mfaChallenge.signature'),
        };

        let body = template(emailData);

        const smtp = project.getAttribute('smtp', {});
        const smtpEnabled = smtp['enabled'] ?? false;

        let senderEmail = APP_SYSTEM_EMAIL_ADDRESS || APP_EMAIL_TEAM;
        let senderName = APP_SYSTEM_EMAIL_NAME || APP_NAME + ' Server';
        let replyTo = '';

        const smtpServer: any = {};

        if (smtpEnabled) {
          if (smtp['senderEmail']) senderEmail = smtp['senderEmail'];
          if (smtp['senderName']) senderName = smtp['senderName'];
          if (smtp['replyTo']) replyTo = smtp['replyTo'];

          smtpServer['host'] = smtp['host'] || '';
          smtpServer['port'] = smtp['port'] || '';
          smtpServer['username'] = smtp['username'] || '';
          smtpServer['password'] = smtp['password'] || '';
          smtpServer['secure'] = smtp['secure'] ?? false;

          if (customEmailTemplate) {
            if (customEmailTemplate['senderEmail'])
              senderEmail = customEmailTemplate['senderEmail'];
            if (customEmailTemplate['senderName'])
              senderName = customEmailTemplate['senderName'];
            if (customEmailTemplate['replyTo'])
              replyTo = customEmailTemplate['replyTo'];

            body = customEmailTemplate['message'] || body;
            subject = customEmailTemplate['subject'] || subject;
          }

          smtpServer['replyTo'] = replyTo;
          smtpServer['senderEmail'] = senderEmail;
          smtpServer['senderName'] = senderName;
        }

        const emailVariables = {
          direction: locale.getText('settings.direction'),
          user: user.getAttribute('name'),
          project: project.getAttribute('name'),
          otp: code,
          agentDevice: agentDevice['deviceBrand'] || 'UNKNOWN',
          agentClient: agentClient['clientName'] || 'UNKNOWN',
          agentOs: agentOs['osName'] || 'UNKNOWN',
        };

        await this.mailQueue.add(SEND_TYPE_EMAIL, {
          email: user.getAttribute('email'),
          subject,
          body,
          server: smtpServer,
          variables: emailVariables,
        });
        break;
    }

    // TODO: Handle Events
    // await this.eventEmitter.emitAsync(EVENT_MFA_CHALLENGE_CREATE, {
    //   userId: user.getId(),
    //   challengeId: createdChallenge.getId(),
    // });

    response.status(201);
    return createdChallenge;
  }

  /**
   * Update MFA Challenge
   */
  async updateMfaChallenge({
    db,
    user,
    session,
    otp,
    challengeId,
  }: WithDB<WithUser<VerifyMfaChallengeDTO & { session: Document }>>) {
    const challenge = await db.getDocument('challenges', challengeId);

    if (challenge.isEmpty()) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    const type = challenge.getAttribute('type');

    const recoveryCodeChallenge = async (
      challenge: Document,
      user: Document,
      otp: string,
    ): Promise<boolean> => {
      if (
        challenge.isSet('type') &&
        challenge.getAttribute('type') === MfaType.RECOVERY_CODE.toLowerCase()
      ) {
        let mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);
        if (mfaRecoveryCodes.includes(otp)) {
          mfaRecoveryCodes = mfaRecoveryCodes.filter(
            (code: string) => code !== otp,
          );
          user.setAttribute('mfaRecoveryCodes', mfaRecoveryCodes);
          await db.updateDocument('users', user.getId(), user);
          return true;
        }
        return false;
      }
      return false;
    };

    let success = false;
    switch (type) {
      case MfaType.TOTP:
        success = TOTPChallenge.challenge(challenge, user, otp);
        break;
      case MfaType.PHONE:
        success = PhoneChallenge.challenge(challenge, user, otp);
        success =
          challenge.getAttribute('code') === otp &&
          new Date() < challenge.getAttribute('expire');
        break;
      case MfaType.EMAIL:
        success = EmailChallenge.challenge(challenge, user, otp);
        success =
          challenge.getAttribute('code') === otp &&
          new Date() < challenge.getAttribute('expire');
        break;
      case MfaType.RECOVERY_CODE.toLowerCase():
        success = await recoveryCodeChallenge(challenge, user, otp);
        break;
      default:
        success = false;
    }

    if (!success) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    await db.deleteDocument('challenges', challengeId);
    await db.purgeCachedDocument('users', user.getId());

    let factors = session.getAttribute('factors', []);
    factors.push(type);
    factors = [...new Set(factors)]; // Remove duplicates

    session
      .setAttribute('factors', factors)
      .setAttribute('mfaUpdatedAt', new Date());

    await db.updateDocument('sessions', session.getId(), session);

    // TODO: Handle Events
    // await this.eventEmitter.emitAsync(EVENT_MFA_CHALLENGE_VERIFY, {
    //   userId: user.getId(),
    //   sessionId: session.getId(),
    // });

    return session;
  }

  /**
   * Create Push Target
   */
  async createPushTarget({
    db,
    user,
    request,
    targetId,
    providerId,
    identifier,
  }: WithDB<WithUser<CreatePushTargetDTO & { request: NuvixRequest }>>) {
    const finalTargetId = targetId === 'unique()' ? ID.unique() : targetId;

    const provider = await Authorization.skip(
      async () => await db.getDocument('providers', providerId),
    );

    const target = await Authorization.skip(
      async () => await db.getDocument('targets', finalTargetId),
    );

    if (!target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
    }

    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN');
    const device = detector.getDevice();

    const sessionId = Auth.sessionVerify(
      user.getAttribute('sessions', []),
      Auth.secret,
    );
    const session = await db.getDocument('sessions', sessionId.toString());

    try {
      const createdTarget = await db.createDocument(
        'targets',
        new Document({
          $id: finalTargetId,
          $permissions: [
            Permission.read(Role.user(user.getId())),
            Permission.update(Role.user(user.getId())),
            Permission.delete(Role.user(user.getId())),
          ],
          providerId: providerId || null,
          providerInternalId: providerId ? provider.getInternalId() : null,
          providerType: MESSAGE_TYPE_PUSH,
          userId: user.getId(),
          userInternalId: user.getInternalId(),
          sessionId: session.getId(),
          sessionInternalId: session.getInternalId(),
          identifier: identifier,
          name: `${device['deviceBrand']} ${device['deviceModel']}`,
        }),
      );

      await db.purgeCachedDocument('users', user.getId());

      // TODO: Handle Events
      // queueForEvents
      //   .setParam('userId', user.getId())
      //   .setParam('targetId', createdTarget.getId());

      return createdTarget;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Update Push Target
   */
  async updatePushTarget({
    db,
    user,
    request,
    targetId,
    identifier,
  }: WithDB<
    WithUser<UpdatePushTargetDTO & { request: NuvixRequest; targetId: string }>
  >) {
    const target = await Authorization.skip(
      async () => await db.getDocument('targets', targetId),
    );

    if (target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (user.getId() !== target.getAttribute('userId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (identifier) {
      target
        .setAttribute('identifier', identifier)
        .setAttribute('expired', false);
    }

    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN');
    const device = detector.getDevice();

    target.setAttribute(
      'name',
      `${device['deviceBrand']} ${device['deviceModel']}`,
    );

    const updatedTarget = await db.updateDocument(
      'targets',
      target.getId(),
      target,
    );

    await db.purgeCachedDocument('users', user.getId());

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setParam('targetId', updatedTarget.getId());

    return updatedTarget;
  }

  /**
   * Delete Push Target
   */
  async deletePushTarget({
    db,
    user,
    targetId,
  }: WithDB<WithUser<{ targetId: string }>>) {
    const target = await Authorization.skip(
      async () => await db.getDocument('targets', targetId),
    );

    if (target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (user.getInternalId() !== target.getAttribute('userInternalId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    await db.deleteDocument('targets', target.getId());

    await db.purgeCachedDocument('users', user.getId());

    // TODO: Handle Delete Queue
    // queueForDeletes
    //   .setType(DELETE_TYPE_TARGET)
    //   .setDocument(target);

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', user.getId())
    //   .setParam('targetId', target.getId())
    //   .setPayload(response.output(target, Response.MODEL_TARGET));

    return {};
  }

  /**
   * Get Identities
   */
  async getIdentities({
    db,
    user,
    queries,
  }: WithDB<WithUser<{ queries: Query[] }>>) {
    queries.push(Query.equal('userInternalId', [user.getInternalId()]));

    /**
     * Get cursor document if there was a cursor query, we use array_filter and reset for reference cursor to queries
     */
    const cursor = queries.find(query =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      // TODO: cursor validator
      const identityId = cursor.getValue();
      const cursorDocument = await db.getDocument('identities', identityId);

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Identity '${identityId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const filterQueries = Query.groupByType(queries)['filters'];
    try {
      const results = await db.find('identities', queries);
      const total = await db.count(
        'identities',
        filterQueries,
        APP_LIMIT_COUNT,
      );

      return new Document({
        identities: results,
        total: total,
      });
    } catch (error) {
      if (error.name === 'OrderException') {
        throw new Exception(
          Exception.DATABASE_QUERY_ORDER_NULL,
          `The order attribute '${error.getAttribute()}' had a null value. Cursor pagination requires all documents order attribute values are non-null.`,
        );
      }
      throw error;
    }
  }

  /**
   * Delete Identity
   */
  async deleteIdentity({ db, identityId }: WithDB<{ identityId: string }>) {
    const identity = await db.getDocument('identities', identityId);

    if (identity.isEmpty()) {
      throw new Exception(Exception.USER_IDENTITY_NOT_FOUND);
    }

    await db.deleteDocument('identities', identityId);

    // TODO: Handle Events
    // queueForEvents
    //   .setParam('userId', identity.getAttribute('userId'))
    //   .setParam('identityId', identity.getId())
    //   .setPayload(response.output(identity, Response.MODEL_IDENTITY));

    return {};
  }
}

type WithDB<T = unknown> = { db: Database } & T;
type WithReqRes<T = unknown> = {
  request: NuvixRequest;
  response: NuvixRes;
} & T;
type WithUser<T = unknown> = { user: Document } & T;
type WithProject<T = unknown> = { project: Document } & T;
type WithLocale<T = unknown> = { locale: LocaleTranslator } & T;
