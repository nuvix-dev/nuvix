import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Document,
  Database,
  Query,
  ID,
  Permission,
  Role,
  Authorization,
} from '@nuvix/database';
import { DuplicateException } from '@nuvix/database';

import { Exception } from '@nuvix/core/extend/exception';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { LocaleTranslator } from '@nuvix/core/helper/locale.helper';
import { Models } from '@nuvix/core/helper/response.helper';
import { PersonalDataValidator } from '@nuvix/core/validators/personal-data.validator';
import {
  APP_EMAIL_TEAM,
  APP_LIMIT_USERS,
  APP_NAME,
  APP_SYSTEM_EMAIL_ADDRESS,
  APP_SYSTEM_EMAIL_NAME,
  ASSETS,
  CONSOLE_CONFIG,
  EVENT_SESSION_CREATE,
  EVENT_SESSION_DELETE,
  EVENT_SESSION_UPDATE,
  EVENT_SESSIONS_DELETE,
  EVENT_USER_CREATE,
  EVENT_USER_DELETE,
  GEO_DB,
  PROJECT_ROOT,
  SEND_TYPE_EMAIL,
} from '@nuvix/utils/constants';
import { UpdateEmailDTO } from './DTO/account.dto';
import {
  CreateEmailSessionDTO,
  CreateOAuth2SessionDTO,
  CreateSessionDTO,
  OAuth2CallbackDTO,
} from './DTO/session.dto';
import { Detector } from '@nuvix/core/helper/detector.helper';
import { CountryResponse, Reader } from 'maxmind';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as Template from 'handlebars';
import * as fs from 'fs/promises';
import { MailQueueOptions } from '@nuvix/core/resolvers/queues/mail.queue';
import { getOAuth2Class, OAuth2 } from '@nuvix/core/OAuth2';
import path from 'path';
import { URLValidator } from '@nuvix/core/validators/url.validator';

@Injectable()
export class AccountService {
  constructor(
    @Inject(GEO_DB) private readonly geodb: Reader<CountryResponse>,
    @InjectQueue('mails') private readonly mailQueue: Queue<MailQueueOptions>,
    private eventEmitter: EventEmitter2,
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
    project,
  }: {
    input: CreateOAuth2SessionDTO;
    request: NuvixRequest;
    response: NuvixRes;
    project: Document;
  }) {
    // TODO: Handle Error Response in HTML format.
    const protocol = request.protocol;
    const provider = input.provider;
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
}
