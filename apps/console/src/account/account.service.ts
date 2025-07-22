import { Inject, Injectable, UseInterceptors } from '@nestjs/common';
import {
  Authorization,
  Database,
  Document,
  DuplicateException,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix/database';

import { CountryResponse, Reader } from 'maxmind';
import { Exception } from '@nuvix/core/extend/exception';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { Detector } from '@nuvix/core/helper/detector.helper';
import { PersonalDataValidator } from '@nuvix/core/validators/personal-data.validator';
import {
  ASSETS,
  CONSOLE_CONFIG,
  DB_FOR_PLATFORM,
  GEO_DB,
  SEND_TYPE_EMAIL,
  QueueFor,
  Events,
  APP_NAME,
  APP_LIMIT_USERS,
  APP_SMTP_HOST,
  AUDITS_FOR_PLATFORM,
  MESSAGE_TYPE_PUSH,
  APP_LIMIT_COUNT,
} from '@nuvix/utils/constants';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import {
  UpdateEmailDTO,
  UpdatePasswordDTO,
  UpdatePhoneDTO,
} from './DTO/account.dto';
import { PasswordHistoryValidator } from '@nuvix/core/validators/password-history.validator';
import { MfaType, TOTP } from '@nuvix/core/validators/MFA.validator';
import { TOTP as TOTPChallenge } from '@nuvix/utils/auth/mfa/challenge/totp';
import { Email as EmailChallenge } from '@nuvix/utils/auth/mfa/challenge/email';
import { Phone as PhoneChallenge } from '@nuvix/utils/auth/mfa/challenge/phone';

import {
  CreateEmailSessionDTO,
  CreateOAuth2SessionDTO,
  CreateSessionDTO,
  OAuth2CallbackDTO,
} from './DTO/session.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as Template from 'handlebars';
import * as fs from 'fs/promises';
import {
  MailJobs,
  MailQueueOptions,
} from '@nuvix/core/resolvers/queues/mails.queue';
import path from 'path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { LocaleTranslator, Models } from '@nuvix/core/helper';
import { getOAuth2Class, OAuth2 } from '@nuvix/core/OAuth2';
import { OAuthProviders } from '@nuvix/core/config/authProviders';
import { URLValidator } from '@nuvix/core/validators/url.validator';
import {
  CreateEmailTokenDTO,
  CreateMagicURLTokenDTO,
  CreateOAuth2TokenDTO,
} from './DTO/token.dto';
import { PhraseGenerator } from '@nuvix/utils/auth/pharse';
import { CreateRecoveryDTO, UpdateRecoveryDTO } from './DTO/recovery.dto';
import { Audit } from '@nuvix/audit';
import { CreateMfaChallengeDTO, VerifyMfaChallengeDTO } from './DTO/mfa.dto';
import { CreatePushTargetDTO, UpdatePushTargetDTO } from './DTO/target.dto';

@Injectable()
@UseInterceptors(ResponseInterceptor)
export class AccountService {
  constructor(
    @Inject(GEO_DB) private readonly geodb: Reader<CountryResponse>,
    @Inject(DB_FOR_PLATFORM) private readonly db: Database,
    @Inject(AUDITS_FOR_PLATFORM) private readonly audit: Audit,
    @InjectQueue(QueueFor.MAILS)
    private readonly mailsQueue: Queue<MailQueueOptions, MailJobs>,
    private eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
  ) {}

  private readonly oauthDefaultSuccess = '/auth/oauth2/success';
  private readonly oauthDefaultFailure = '/auth/oauth2/failure';

  /**
   * Create a new account
   */
  async createAccount(
    userId: string,
    email: string,
    password: string,
    name: string,
    request: NuvixRequest,
    user: Document,
  ): Promise<Document> {
    email = email.toLowerCase();

    const whitelistEmails = CONSOLE_CONFIG.authWhitelistEmails;
    const whitelistIPs = CONSOLE_CONFIG.authWhitelistIPs ?? false;

    if (
      whitelistEmails &&
      !whitelistEmails.includes(email) &&
      !whitelistEmails.includes(email.toUpperCase())
    ) {
      throw new Exception(Exception.USER_EMAIL_NOT_WHITELISTED);
    }

    if (whitelistIPs && !whitelistIPs.includes(request.ip)) {
      throw new Exception(Exception.USER_IP_NOT_WHITELISTED);
    }

    const limit = CONSOLE_CONFIG.auths.limit ?? 0;

    if (limit !== 0) {
      const total = await this.db.count('users', []);

      if (total >= limit) {
        throw new Exception(Exception.USER_CONSOLE_COUNT_EXCEEDED);
      }
    }

    const identityWithMatchingEmail = await this.db.findOne('identities', [
      Query.equal('providerEmail', [email]),
    ]);

    if (identityWithMatchingEmail && !identityWithMatchingEmail.isEmpty()) {
      throw new Exception(Exception.GENERAL_BAD_REQUEST);
    }

    if (CONSOLE_CONFIG.auths.personalDataCheck ?? false) {
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

    const passwordHistory = CONSOLE_CONFIG.auths.passwordHistory ?? 0;
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
        async () => await this.db.createDocument('users', user),
      );

      try {
        const target = await Authorization.skip(
          async () =>
            await this.db.createDocument(
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
          const existingTarget = await this.db.findOne('targets', [
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

      await this.db.purgeCachedDocument('users', user.getId());
    } catch (error) {
      console.log(error);
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_ALREADY_EXISTS);
      } else {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Failed saving user to DB',
        );
      }
    }

    Authorization.unsetRole(Role.guests().toString());
    Authorization.setRole(Role.user(user.getId()).toString());
    Authorization.setRole(Role.users().toString());

    const templatePath = path.join(
      ASSETS.TEMPLATES,
      'email-account-create.tpl',
    );
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Template.compile(templateSource);

    const body = template({
      name: user.getAttribute('name', 'User'),
      verification_link: '#',
    });

    const vars = {
      date: new Date().toDateString(),
      year: new Date().getFullYear(),
    };

    await this.mailsQueue.add(SEND_TYPE_EMAIL, {
      subject: 'Account Created! Start Exploring Nuvix Now ⚡',
      email: user.getAttribute('email'),
      body: body,
      variables: vars,
    });

    // queueForEvents.setParam('userId', user.getId());

    return user;
  }

  /**
   * Update user's prefs
   */
  async updatePrefs(user: Document, prefs: { [key: string]: any }) {
    user.setAttribute('prefs', prefs);

    user = await this.db.updateDocument('users', user.getId(), user);

    return user.getAttribute('prefs', {});
  }

  /**
   * Delete User Account.
   */
  async deleteAccount(user: Document) {
    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    // Get all memberships and check if user can be deleted
    const memberships = user.getAttribute('memberships', []);
    for (const membership of memberships) {
      if (membership.getAttribute('confirm', false)) {
        throw new Exception(Exception.USER_DELETION_PROHIBITED);
      }
    }

    await Authorization.skip(
      async () => await this.db.deleteDocument('users', user.getId()),
    );

    await this.db.purgeCachedDocument('users', user.getId());

    return user;
  }

  async updateEmail(user: Document, input: UpdateEmailDTO) {
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

    const identityWithMatchingEmail = await this.db.findOne('identities', [
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
        await this.db.findOne('targets', [Query.equal('identifier', [email])]),
    );

    if (target && !target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
    }

    try {
      user = await this.db.updateDocument('users', user.getId(), user);
      const oldTarget = user.find<any>('identifier', oldEmail, 'targets');

      if (oldTarget && !oldTarget.isEmpty()) {
        await Authorization.skip(
          async () =>
            await this.db.updateDocument(
              'targets',
              oldTarget.getId(),
              oldTarget.setAttribute('identifier', email),
            ),
        );
      }
      await this.db.purgeCachedDocument('users', user.getId());
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.GENERAL_BAD_REQUEST);
      } else {
        throw error;
      }
    }
  }

  /**
   * Update User's Name
   */
  async updateName(user: Document, name: string) {
    user.setAttribute('name', name);

    user = await this.db.updateDocument('users', user.getId(), user);

    return user;
  }

  /**
   * Update User's Password
   */
  async updatePassword(user: Document, input: UpdatePasswordDTO) {
    const oldPassword = input.oldPassword;
    const newPassword = input.password;

    // Check old password only if it's an existing user.
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

    const hashedNewPassword = await Auth.passwordHash(
      newPassword,
      Auth.DEFAULT_ALGO,
      Auth.DEFAULT_ALGO_OPTIONS,
    );

    const historyLimit = CONSOLE_CONFIG.auths.passwordHistory ?? 0;
    let history = user.getAttribute('passwordHistory', []);
    if (historyLimit > 0) {
      const validator = new PasswordHistoryValidator(
        history,
        user.getAttribute('hash'),
        user.getAttribute('hashOptions'),
      );
      if (!validator.isValid(newPassword)) {
        throw new Exception(Exception.USER_PASSWORD_RECENTLY_USED);
      }

      history.push(hashedNewPassword);
      history = history.slice(-historyLimit);
    }

    if (CONSOLE_CONFIG.auths.personalDataCheck ?? false) {
      const personalDataValidator = new PersonalDataValidator(
        user.getId(),
        user.getAttribute('email'),
        user.getAttribute('name'),
        user.getAttribute('phone'),
      );
      if (!personalDataValidator.isValid(newPassword)) {
        throw new Exception(Exception.USER_PASSWORD_PERSONAL_DATA);
      }
    }

    user.setAttribute('password', hashedNewPassword);
    user.setAttribute('passwordHistory', history);
    user.setAttribute('passwordUpdate', new Date());
    user.setAttribute('hash', Auth.DEFAULT_ALGO);
    user.setAttribute('hashOptions', Auth.DEFAULT_ALGO_OPTIONS);

    // TODO: should update with request timestamp
    user = await this.db.updateDocument('users', user.getId(), user);

    return user;
  }

  /**
   * Update User's Phone
   */
  async updatePhone(user: Document, input: UpdatePhoneDTO) {
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

    const oldPhone = user.getAttribute('phone');
    const phone = input.phone;

    const target = await Authorization.skip(
      async () =>
        await this.db.findOne('targets', [Query.equal('identifier', [phone])]),
    );

    if (target && !target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_ALREADY_EXISTS);
    }

    user.setAttribute('phone', phone).setAttribute('phoneVerification', false);

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

    try {
      user = await this.db.updateDocument('users', user.getId(), user);
      const oldTarget = user.find<any>('identifier', oldPhone, 'targets');

      if (oldTarget && !oldTarget.isEmpty()) {
        await Authorization.skip(
          async () =>
            await this.db.updateDocument(
              'targets',
              oldTarget.getId(),
              oldTarget.setAttribute('identifier', phone),
            ),
        );
      }
      await this.db.purgeCachedDocument('users', user.getId());
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.USER_PHONE_ALREADY_EXISTS);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get Logs
   */
  async getLogs(user: Document, queries: Query[]) {
    const grouped = Query.groupByType(queries);
    const limit = grouped.limit ?? CONSOLE_CONFIG.auths.limit ?? 100;
    const offset = grouped.offset ?? 0;

    const logs = await this.audit.getLogsByUser(user.getInternalId(), [
      Query.limit(limit),
      Query.offset(offset),
    ]);
    const output = [];

    for (const log of logs) {
      log.setAttribute('userAgent', log.getAttribute('userAgent', 'UNKNOWN'));
      const detector = new Detector(log.getAttribute('userAgent'));

      const logDocument = new Document({
        ...log.toObject(),
        ...log.getAttribute('data'),
        ...detector.getOS(),
        ...detector.getClient(),
        ...detector.getDevice(),
      });

      const record = this.geodb.get(log.getAttribute('ip'));

      if (record) {
        logDocument.setAttribute(
          'countryCode',
          record.country.iso_code.toLowerCase(),
        );
        logDocument.setAttribute('countryName', record.country.names.en);
      } else {
        logDocument.setAttribute('countryCode', '--');
        logDocument.setAttribute('countryName', 'Unknown');
      }

      output.push(logDocument);
    }

    return {
      total: await this.audit.countLogsByUser(user.getInternalId()),
      logs: output,
    };
  }

  /**
   * Get User's Sessions
   */
  async getSessions(user: Document, locale: LocaleTranslator) {
    const roles = Authorization.getRoles();
    const isPrivilegedUser = Auth.isPrivilegedUser(roles);
    const isAppUser = Auth.isAppUser(roles);

    const sessions = user.getAttribute('sessions', []);
    const current = Auth.sessionVerify(sessions, Auth.secret);

    const updatedSessions = sessions.map((session: Document) => {
      const countryName = locale.getText(
        'countries' + session.getAttribute('countryCode', '').toLowerCase(),
        locale.getText('locale.country.unknown'),
      );

      session.setAttribute('countryName', countryName);
      session.setAttribute('current', current === session.getId());
      session.setAttribute(
        'secret',
        isPrivilegedUser || isAppUser ? session.getAttribute('secret', '') : '',
      );

      return session;
    });

    return {
      sessions: updatedSessions,
      total: updatedSessions.length,
    };
  }

  /**
   * Delete user's session
   */
  async deleteSessions(
    user: Document,
    locale: LocaleTranslator,
    request: NuvixRequest,
    response: NuvixRes,
  ) {
    const protocol = request.protocol;
    const sessions = user.getAttribute('sessions', []);

    for (const session of sessions) {
      await this.db.deleteDocument('sessions', session.getId());

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
        response
          .cookie(`${Auth.cookieName}_legacy`, '', {
            expires: new Date(0),
            path: '/',
            // domain: Auth.cookieDomain,
            secure: protocol === 'https',
            httpOnly: true,
          })
          .cookie(Auth.cookieName, '', {
            expires: new Date(0),
            path: '/',
            // domain: Auth.cookieDomain,
            secure: protocol === 'https',
            httpOnly: true,
            sameSite: Auth.cookieSamesite,
          });

        // queueForDeletes.setType(DELETE_TYPE_SESSION_TARGETS).setDocument(session).trigger();
      }
    }

    await this.db.purgeCachedDocument('users', user.getId());
    await this.eventEmitter.emitAsync(Events.SESSION_DELETE, {
      userId: user.getId(),
    });

    return;
  }

  /**
   * Get a Session
   */
  async getSession(
    user: Document,
    sessionId: string,
    locale: LocaleTranslator,
  ) {
    const roles = Authorization.getRoles();
    const isPrivilegedUser = Auth.isPrivilegedUser(roles);
    const isAppUser = Auth.isAppUser(roles);

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
          .setAttribute(
            'secret',
            isPrivilegedUser || isAppUser
              ? session.getAttribute('secret', '')
              : '',
          );

        return session;
      }
    }

    throw new Exception(Exception.USER_SESSION_NOT_FOUND);
  }

  /**
   * Delete a Session
   */
  async deleteSession(
    user: Document,
    sessionId: string,
    request: NuvixRequest,
    response: NuvixRes,
  ) {
    const protocol = request.protocol;
    const sessions = user.getAttribute('sessions', []);

    for (const session of sessions) {
      if (sessionId !== session.getId()) {
        continue;
      }

      await this.db.deleteDocument('sessions', session.getId());

      session.setAttribute('current', false);

      if (session.getAttribute('secret') === Auth.hash(Auth.secret)) {
        session.setAttribute('current', true);

        response
          .cookie(`${Auth.cookieName}_legacy`, '', {
            expires: new Date(0),
            path: '/',
            secure: protocol === 'https',
            httpOnly: true,
            sameSite: Auth.cookieSamesite,
          })
          .cookie(Auth.cookieName, '', {
            expires: new Date(0),
            path: '/',
            secure: protocol === 'https',
            httpOnly: true,
            sameSite: Auth.cookieSamesite,
          });

        response.header('X-Fallback-Cookies', JSON.stringify([]));
      }

      await this.db.purgeCachedDocument('users', user.getId());

      return;
    }

    throw new Exception(Exception.USER_SESSION_NOT_FOUND);
  }

  /**
   * Update a Session
   */
  async updateSession(user: Document, sessionId: string) {
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

    const auths = CONSOLE_CONFIG.auths;

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
      const providers = CONSOLE_CONFIG.oAuthProviders ?? [];
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

    await this.db.updateDocument('sessions', sessionId, session);
    await this.db.purgeCachedDocument('users', user.getId());

    return session;
  }

  /**
   * Create a new session for the user using Email & Password
   */
  async createEmailSession(
    user: Document,
    input: CreateEmailSessionDTO,
    locale: LocaleTranslator,
    request: NuvixRequest,
    response: NuvixRes,
  ) {
    const email = input.email.toLowerCase();
    const protocol = request.protocol;

    const profile = await this.db.findOne('users', [
      Query.equal('email', [email]),
    ]);

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

    const roles = Authorization.getRoles();
    const isPrivilegedUser = Auth.isPrivilegedUser(roles);
    const isAppUser = Auth.isAppUser(roles);

    user.setAttributes(profile.toObject());

    const duration =
      CONSOLE_CONFIG.auths.duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG;
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
      await this.db.updateDocument('users', user.getId(), user);
    }

    await this.db.purgeCachedDocument('users', user.getId());

    const createdSession = await this.db.createDocument(
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
      .setAttribute(
        'secret',
        isPrivilegedUser || isAppUser
          ? Auth.encodeSession(user.getId(), secret)
          : '',
      );

    if (CONSOLE_CONFIG.auths?.sessionAlerts ?? false) {
      const sessionCount = await this.db.count('sessions', [
        Query.equal('userId', [user.getId()]),
      ]);

      if (sessionCount !== 1) {
        await this.sendSessionAlert(locale, user, createdSession);
      }
    }

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
  }: {
    input: CreateOAuth2SessionDTO;
    request: NuvixRequest;
    response: NuvixRes;
    provider: OAuthProviders;
  }) {
    // TODO: Handle Error Response in HTML format.
    const protocol = request.protocol;
    const success = input.success || '';
    const failure = input.failure || '';
    const scopes = input.scopes || [];

    const callback = `${protocol}://${request.hostname}/account/sessions/oauth2/callback/${provider}/console`;
    const oAuthProviders = CONSOLE_CONFIG.oAuthProviders ?? {};
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
    user,
    input,
    provider,
    request,
    response,
  }: {
    user: Document;
    input: OAuth2CallbackDTO;
    provider: string;
    request: NuvixRequest;
    response: NuvixRes;
  }) {
    const protocol = request.protocol;
    const callback = `${protocol}://${request.hostname}/account/sessions/oauth2/callback/${provider}/console`;
    const defaultState = {
      success: '',
      failure: '',
    };
    const validateURL = new URLValidator();
    const oAuthProviders = CONSOLE_CONFIG.oAuthProviders ?? {};
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

      const identityWithMatchingEmail = await this.db.findOne('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', user.getInternalId()),
      ]);
      if (!identityWithMatchingEmail.isEmpty()) {
        failureRedirect(Exception.USER_ALREADY_EXISTS);
      }

      const userWithMatchingEmail = await this.db.find('users', [
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
      const currentDocument = await this.db.getDocument('sessions', current);
      if (!currentDocument.isEmpty()) {
        await this.db.deleteDocument('sessions', currentDocument.getId());
        await this.db.purgeCachedDocument('users', user.getId());
      }
    }

    if (user.isEmpty()) {
      const session = await this.db.findOne('sessions', [
        Query.equal('provider', [provider]),
        Query.equal('providerUid', [oauth2ID]),
      ]);
      if (!session.isEmpty()) {
        const foundUser = await this.db.getDocument(
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

      const userWithEmail = await this.db.findOne('users', [
        Query.equal('email', [email]),
      ]);
      if (!userWithEmail.isEmpty()) {
        user.setAttributes(userWithEmail.toObject());
      }

      if (user.isEmpty()) {
        const identity = await this.db.findOne('identities', [
          Query.equal('provider', [provider]),
          Query.equal('providerUid', [oauth2ID]),
        ]);

        if (!identity.isEmpty()) {
          const foundUser = await this.db.getDocument(
            'users',
            identity.getAttribute('userId'),
          );
          user.setAttributes(foundUser.toObject());
        }
      }

      if (user.isEmpty()) {
        const limit = CONSOLE_CONFIG.auths['limit'] ?? 0;

        if (limit !== 0) {
          const total = await this.db.count('users', [], APP_LIMIT_USERS);
          if (total >= limit) {
            failureRedirect(Exception.USER_COUNT_EXCEEDED);
          }
        }

        const identityWithMatchingEmail = await this.db.findOne('identities', [
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
            async () => await this.db.createDocument('users', user),
          );

          await this.db.createDocument(
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

    let identity = await this.db.findOne('identities', [
      Query.equal('userInternalId', [user.getInternalId()]),
      Query.equal('provider', [provider]),
      Query.equal('providerUid', [oauth2ID]),
    ]);

    if (identity.isEmpty()) {
      const identitiesWithMatchingEmail = await this.db.find('identities', [
        Query.equal('providerEmail', [email]),
        Query.notEqual('userInternalId', [user.getInternalId()]),
      ]);
      if (identitiesWithMatchingEmail.length > 0) {
        failureRedirect(Exception.GENERAL_BAD_REQUEST);
      }

      identity = (await this.db.createDocument(
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
      await this.db.updateDocument('identities', identity.getId(), identity);
    }

    if (!user.getAttribute('email')) {
      user.setAttribute('email', email);
    }

    if (!user.getAttribute('name')) {
      user.setAttribute('name', name);
    }

    user.setAttribute('status', true);
    await this.db.updateDocument('users', user.getId(), user);

    const duration =
      CONSOLE_CONFIG.auths['duration'] ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG;
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

      const createdToken = await this.db.createDocument(
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

      const createdSession = await this.db.createDocument(
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
          await this.db.updateDocument('targets', target.getId(), target);
        }
      }

      await this.eventEmitter.emitAsync(Events.SESSION_CREATE, {
        userId: user.getId(),
        sessionId: createdSession.getId(),
        payload: {
          data: createdSession,
          type: Models.SESSION,
        },
      });
    }

    await this.db.purgeCachedDocument('users', user.getId());

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
  }: {
    input: CreateOAuth2TokenDTO;
    request: NuvixRequest;
    response: NuvixRes;
    provider: OAuthProviders;
  }) {
    const protocol = request.protocol;
    const success = input.success || '';
    const failure = input.failure || '';
    const scopes = input.scopes || [];

    const callback = `${protocol}://${request.hostname}/account/sessions/oauth2/callback/${provider}/console`;
    const oAuthProviders = CONSOLE_CONFIG.oAuthProviders ?? {};
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
    user,
    input,
    request,
    response,
    locale,
  }: {
    user: Document;
    input: CreateMagicURLTokenDTO;
    request: NuvixRequest;
    response: NuvixRes;
    locale: LocaleTranslator;
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

    const result = await this.db.findOne('users', [
      Query.equal('email', [email]),
    ]);
    if (!result.isEmpty()) {
      user.setAttributes(result.toObject());
    } else {
      const limit = CONSOLE_CONFIG.auths['limit'] ?? 0;

      if (limit !== 0) {
        const total = await this.db.count('users', [], APP_LIMIT_USERS);

        if (total >= limit) {
          throw new Exception(Exception.USER_COUNT_EXCEEDED);
        }
      }

      // Makes sure this email is not already used in another identity
      const identityWithMatchingEmail = await this.db.findOne('identities', [
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
        async () => await this.db.createDocument('users', user),
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

    const createdToken = await this.db.createDocument(
      'tokens',
      token.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await this.db.purgeCachedDocument('users', user.getId());

    if (!url) {
      url = `${request.protocol}://${request.hostname}/console/auth/magic-url`;
    }

    // Parse and merge URL query parameters
    const urlObj = new URL(url);
    urlObj.searchParams.set('userId', user.getId());
    urlObj.searchParams.set('secret', tokenSecret);
    urlObj.searchParams.set('expire', expire.toISOString());
    url = urlObj.toString();

    let subject = locale.getText('emails.magicSession.subject');

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

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.getAttribute('name'),
      project: 'Console',
      redirect: url,
      agentDevice: agentDevice['deviceBrand'] || 'UNKNOWN',
      agentClient: agentClient['clientName'] || 'UNKNOWN',
      agentOs: agentOs['osName'] || 'UNKNOWN',
      phrase: phrase || '',
    };

    await this.mailsQueue.add(SEND_TYPE_EMAIL, {
      email,
      subject,
      body,
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
    user,
    input,
    request,
    response,
    locale,
  }: {
    user: Document;
    input: CreateEmailTokenDTO;
    request: NuvixRequest;
    response: NuvixRes;
    locale: LocaleTranslator;
  }) {
    if (!APP_SMTP_HOST) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled');
    }

    const { userId, email, phrase: inputPhrase = false } = input;
    let phrase: string;

    if (inputPhrase === true) {
      phrase = PhraseGenerator.generate();
    }

    const result = await this.db.findOne('users', [
      Query.equal('email', [email]),
    ]);
    if (!result.isEmpty()) {
      user.setAttributes(result.toObject());
    } else {
      const limit = CONSOLE_CONFIG.auths['limit'] ?? 0;

      if (limit !== 0) {
        const total = await this.db.count('users', [], APP_LIMIT_USERS);

        if (total >= limit) {
          throw new Exception(Exception.USER_COUNT_EXCEEDED);
        }
      }

      // Makes sure this email is not already used in another identity
      const identityWithMatchingEmail = await this.db.findOne('identities', [
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
        async () => await this.db.createDocument('users', user),
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

    const createdToken = await this.db.createDocument(
      'tokens',
      token.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await this.db.purgeCachedDocument('users', user.getId());

    let subject = locale.getText('emails.otpSession.subject');
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

    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.getAttribute('name'),
      project: 'Console',
      otp: tokenSecret,
      agentDevice: agentDevice['deviceBrand'] || 'UNKNOWN',
      agentClient: agentClient['clientName'] || 'UNKNOWN',
      agentOs: agentOs['osName'] || 'UNKNOWN',
      phrase: phrase || '',
    };

    await this.mailsQueue.add(SEND_TYPE_EMAIL, {
      email,
      subject,
      body,
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
   * Send Session Alert.
   */
  async sendSessionAlert(
    locale: LocaleTranslator,
    user: Document,
    session: Document,
  ) {
    let subject: string = locale.getText('emails.sessionAlert.subject');
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
      project: 'Console',
      device: session.getAttribute('clientName'),
      ipAddress: session.getAttribute('ip'),
      country: locale.getText(
        'countries.' + session.getAttribute('countryCode'),
        locale.getText('locale.country.unknown'),
      ),
    };

    let body = template(emailData);
    const email = user.getAttribute('email');

    await this.mailsQueue.add(SEND_TYPE_EMAIL, {
      email,
      subject,
      body,
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
   * Create a new session for the user
   */
  async createSession({
    user,
    input,
    request,
    response,
    locale,
  }: {
    user: Document;
    input: CreateSessionDTO;
    request: NuvixRequest;
    response: NuvixRes;
    locale: LocaleTranslator;
  }) {
    const { userId, secret } = input;
    const roles = Authorization.getRoles();
    const isPrivilegedUser = Auth.isPrivilegedUser(roles);
    const isAppUser = Auth.isAppUser(roles);

    const userFromRequest = await Authorization.skip(
      async () => await this.db.getDocument('users', userId),
    );

    if (userFromRequest.isEmpty()) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    const verifiedToken = Auth.tokenVerify(
      userFromRequest.getAttribute('tokens', []),
      null,
      secret,
    );

    if (!verifiedToken) {
      throw new Exception(Exception.USER_INVALID_TOKEN);
    }

    user.setAttributes(userFromRequest.toObject());

    const duration =
      CONSOLE_CONFIG.auths.duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    const detector = new Detector(request.headers['user-agent'] || 'UNKNOWN');
    const record = this.geodb.get(request.ip);
    const sessionSecret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_SESSION);

    const factor = (() => {
      switch (verifiedToken.getAttribute('type')) {
        case Auth.TOKEN_TYPE_MAGIC_URL:
        case Auth.TOKEN_TYPE_OAUTH2:
        case Auth.TOKEN_TYPE_EMAIL:
          return 'email';
        case Auth.TOKEN_TYPE_PHONE:
          return 'phone';
        case Auth.TOKEN_TYPE_GENERIC:
          return 'token';
        default:
          throw new Exception(Exception.USER_INVALID_TOKEN);
      }
    })();

    const session = new Document<any>({
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

    const createdSession = await this.db.createDocument(
      'sessions',
      session.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await Authorization.skip(
      async () => await this.db.deleteDocument('tokens', verifiedToken.getId()),
    );
    await this.db.purgeCachedDocument('users', user.getId());

    if (
      [Auth.TOKEN_TYPE_MAGIC_URL, Auth.TOKEN_TYPE_EMAIL].includes(
        verifiedToken.getAttribute('type'),
      )
    ) {
      user.setAttribute('emailVerification', true);
    }

    if (verifiedToken.getAttribute('type') === Auth.TOKEN_TYPE_PHONE) {
      user.setAttribute('phoneVerification', true);
    }

    try {
      await this.db.updateDocument('users', user.getId(), user);
    } catch (error) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed saving user to DB',
      );
    }

    const isAllowedTokenType = ![
      Auth.TOKEN_TYPE_MAGIC_URL,
      Auth.TOKEN_TYPE_EMAIL,
    ].includes(verifiedToken.getAttribute('type'));
    const hasUserEmail = user.getAttribute('email', false) !== false;
    const isSessionAlertsEnabled = CONSOLE_CONFIG.auths.sessionAlerts ?? false;
    const isNotFirstSession =
      (await this.db.count('sessions', [
        Query.equal('userId', [user.getId()]),
      ])) !== 1;

    if (
      isAllowedTokenType &&
      hasUserEmail &&
      isSessionAlertsEnabled &&
      isNotFirstSession
    ) {
      await this.sendSessionAlert(locale, user, createdSession);
    }

    // queueForEvents.setParam('userId', user.getId()).setParam('sessionId', createdSession.getId());

    const expire = new Date(Date.now() + duration * 1000);
    const protocol = request.protocol;

    response
      .cookie(
        Auth.cookieName,
        Auth.encodeSession(user.getId(), sessionSecret),
        {
          expires: new Date(expire),
          path: '/',
          // domain: Auth.cookieDomain,
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
      .setAttribute('expire', expire)
      .setAttribute(
        'secret',
        isPrivilegedUser || isAppUser
          ? Auth.encodeSession(user.getId(), sessionSecret)
          : '',
      );

    return createdSession;
  }

  /**
   * Update Status
   */
  async updateStatus({
    user,
    request,
    response,
  }: {
    user: Document;
    request: NuvixRequest;
    response: NuvixRes;
  }) {
    user.setAttribute('status', false);

    user = await this.db.updateDocument('users', user.getId(), user);
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
   * Create Recovery
   */
  async createRecovery({
    request,
    response,
    user,
    locale,
    input,
  }: WithReqRes<WithUser<WithLocale<{ input: CreateRecoveryDTO }>>>) {
    if (!APP_SMTP_HOST) {
      throw new Exception(Exception.GENERAL_SMTP_DISABLED, 'SMTP disabled');
    }

    const email = input.email.toLowerCase();
    let url = input.url;

    const profile = await this.db.findOne('users', [
      Query.equal('email', [email]),
    ]);

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

    const createdRecovery = await this.db.createDocument(
      'tokens',
      recovery.setAttribute('$permissions', [
        Permission.read(Role.user(profile.getId())),
        Permission.update(Role.user(profile.getId())),
        Permission.delete(Role.user(profile.getId())),
      ]),
    );

    await this.db.purgeCachedDocument('users', profile.getId());

    // Parse and merge URL query parameters
    const urlObj = new URL(url);
    urlObj.searchParams.set('userId', profile.getId());
    urlObj.searchParams.set('secret', secret);
    urlObj.searchParams.set('expire', expire.toISOString());
    url = urlObj.toString();

    const projectName = 'Console';
    let body = locale.getText('emails.recovery.body');
    let subject = locale.getText('emails.recovery.subject');

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
    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: profile.getAttribute('name'),
      redirect: url,
      project: projectName,
      team: '',
    };

    await this.mailsQueue.add(SEND_TYPE_EMAIL, {
      email: profile.getAttribute('email', ''),
      subject,
      body,
      variables: emailVariables,
    });

    createdRecovery.setAttribute('secret', secret);

    response.status(201);
    return createdRecovery;
  }

  /**
   * Update password recovery (confirmation)
   */
  async updateRecovery({
    user,
    response,
    input,
  }: WithUser<{ response: NuvixRes; input: UpdateRecoveryDTO }>) {
    const profile = await this.db.getDocument('users', input.userId);

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

    const historyLimit = CONSOLE_CONFIG.auths['passwordHistory'] ?? 0;
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

    const updatedProfile = await this.db.updateDocument(
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

    const recoveryDocument = await this.db.getDocument(
      'tokens',
      verifiedToken.getId(),
    );

    /**
     * We act like we're updating and validating
     * the recovery token but actually we don't need it anymore.
     */
    await this.db.deleteDocument('tokens', verifiedToken.getId());
    await this.db.purgeCachedDocument('users', profile.getId());

    response.status(200);
    return recoveryDocument;
  }

  /**
   * Create email verification token
   */
  async createEmailVerification({
    user,
    request,
    response,
    locale,
    url,
  }: WithReqRes<WithUser<WithLocale<{ url: string }>>>) {
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

    const createdVerification = await this.db.createDocument(
      'tokens',
      verification.setAttribute('$permissions', [
        Permission.read(Role.user(user.getId())),
        Permission.update(Role.user(user.getId())),
        Permission.delete(Role.user(user.getId())),
      ]),
    );

    await this.db.purgeCachedDocument('users', user.getId());

    // Parse and merge URL query parameters
    const urlObj = new URL(url);
    urlObj.searchParams.set('userId', user.getId());
    urlObj.searchParams.set('secret', verificationSecret);
    urlObj.searchParams.set('expire', expire.toISOString());
    const finalUrl = urlObj.toString();

    const projectName = 'Console';
    let body = locale.getText('emails.verification.body');
    let subject = locale.getText('emails.verification.subject');

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
    const emailVariables = {
      direction: locale.getText('settings.direction'),
      user: user.getAttribute('name'),
      redirect: finalUrl,
      project: projectName,
      team: '',
    };

    await this.mailsQueue.add(SEND_TYPE_EMAIL, {
      email: user.getAttribute('email'),
      subject,
      body,
      variables: emailVariables,
    });

    createdVerification.setAttribute('secret', verificationSecret);
    response.status(201);
    return createdVerification;
  }

  /**
   * Verify email
   */
  async updateEmailVerification({
    user,
    response,
    userId,
    secret,
  }: WithUser<{ response: NuvixRes; userId: string; secret: string }>) {
    const profile = await Authorization.skip(
      async () => await this.db.getDocument('users', userId),
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

    const updatedProfile = await this.db.updateDocument(
      'users',
      profile.getId(),
      profile.setAttribute('emailVerification', true),
    );

    user.setAttributes(updatedProfile.toObject());

    const verification = await this.db.getDocument(
      'tokens',
      verifiedToken.getId(),
    );

    /**
     * We act like we're updating and validating
     * the verification token but actually we don't need it anymore.
     */
    await this.db.deleteDocument('tokens', verifiedToken.getId());
    await this.db.purgeCachedDocument('users', profile.getId());

    return verification;
  }

  /**
   * Update MFA
   */
  async updateMfa({
    user,
    mfa,
    session,
  }: WithUser<{ mfa: boolean; session?: Document }>) {
    user.setAttribute('mfa', mfa);

    user = await this.db.updateDocument('users', user.getId(), user);

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
      await this.db.updateDocument('sessions', session.getId(), session);
    }

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
  async createMfaAuthenticator({ user, type }: WithUser<{ type: string }>) {
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
    otp.setIssuer('Console');

    const authenticator = TOTP.getAuthenticatorFromUser(user);

    if (authenticator) {
      if (authenticator.getAttribute('verified')) {
        throw new Exception(Exception.USER_AUTHENTICATOR_ALREADY_VERIFIED);
      }
      await this.db.deleteDocument('authenticators', authenticator.getId());
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

    await this.db.createDocument('authenticators', newAuthenticator);
    await this.db.purgeCachedDocument('users', user.getId());

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
  }: WithUser<{ session: Document; otp: string; type: string }>) {
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

    await this.db.updateDocument(
      'authenticators',
      authenticator.getId(),
      authenticator,
    );
    await this.db.purgeCachedDocument('users', user.getId());

    const factors = session.getAttribute('factors', []);
    factors.push(type);
    const uniqueFactors = [...new Set(factors)];

    session.setAttribute('factors', uniqueFactors);
    await this.db.updateDocument('sessions', session.getId(), session);

    return user;
  }

  /**
   * Create MFA recovery codes
   */
  async createMfaRecoveryCodes({ user }: WithUser) {
    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);

    if (mfaRecoveryCodes.length > 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_ALREADY_EXISTS);
    }

    const newRecoveryCodes = TOTP.generateBackupCodes();
    user.setAttribute('mfaRecoveryCodes', newRecoveryCodes);
    await this.db.updateDocument('users', user.getId(), user);

    const document = new Document({
      recoveryCodes: newRecoveryCodes,
    });

    return document;
  }

  /**
   * Update MFA recovery codes (regenerate)
   */
  async updateMfaRecoveryCodes({ user }: WithUser) {
    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);

    if (mfaRecoveryCodes.length === 0) {
      throw new Exception(Exception.USER_RECOVERY_CODES_NOT_FOUND);
    }

    const newMfaRecoveryCodes = TOTP.generateBackupCodes();
    user.setAttribute('mfaRecoveryCodes', newMfaRecoveryCodes);
    await this.db.updateDocument('users', user.getId(), user);

    const document = new Document({
      recoveryCodes: newMfaRecoveryCodes,
    });

    return document;
  }

  /**
   * Delete Authenticator
   */
  async deleteMfaAuthenticator({ user, type }: WithUser<{ type: string }>) {
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

    await this.db.deleteDocument('authenticators', authenticator.getId());
    await this.db.purgeCachedDocument('users', user.getId());

    return {};
  }

  /**
   * Create MFA Challenge
   */
  async createMfaChallenge({
    user,
    request,
    response,
    locale,
    userId,
    factor,
  }: WithUser<WithReqRes<WithLocale<CreateMfaChallengeDTO>>>) {
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

    const createdChallenge = await this.db.createDocument(
      'challenges',
      challenge,
    );

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

        let smsMessage = locale.getText('sms.verification.body');

        const smsContent = smsMessage
          .replace('{{project}}', 'Console')
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
        const emailVariables = {
          direction: locale.getText('settings.direction'),
          user: user.getAttribute('name'),
          project: 'Console',
          otp: code,
          agentDevice: agentDevice['deviceBrand'] || 'UNKNOWN',
          agentClient: agentClient['clientName'] || 'UNKNOWN',
          agentOs: agentOs['osName'] || 'UNKNOWN',
        };

        await this.mailsQueue.add(SEND_TYPE_EMAIL, {
          email: user.getAttribute('email'),
          subject,
          body,
          variables: emailVariables,
        });
        break;
    }

    response.status(201);
    return createdChallenge;
  }

  /**
   * Update MFA Challenge
   */
  async updateMfaChallenge({
    user,
    session,
    otp,
    challengeId,
  }: WithUser<VerifyMfaChallengeDTO & { session: Document }>) {
    const challenge = await this.db.getDocument('challenges', challengeId);

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
          await this.db.updateDocument('users', user.getId(), user);
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

    await this.db.deleteDocument('challenges', challengeId);
    await this.db.purgeCachedDocument('users', user.getId());

    let factors = session.getAttribute('factors', []);
    factors.push(type);
    factors = [...new Set(factors)]; // Remove duplicates

    session
      .setAttribute('factors', factors)
      .setAttribute('mfaUpdatedAt', new Date());

    await this.db.updateDocument('sessions', session.getId(), session);

    return session;
  }

  /**
   * Create Push Target
   */
  async createPushTarget({
    user,
    request,
    targetId,
    providerId,
    identifier,
  }: WithUser<CreatePushTargetDTO & { request: NuvixRequest }>) {
    const finalTargetId = targetId === 'unique()' ? ID.unique() : targetId;

    const provider = await Authorization.skip(
      async () => await this.db.getDocument('providers', providerId),
    );

    const target = await Authorization.skip(
      async () => await this.db.getDocument('targets', finalTargetId),
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
    const session = await this.db.getDocument('sessions', sessionId.toString());

    try {
      const createdTarget = await this.db.createDocument(
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

      await this.db.purgeCachedDocument('users', user.getId());

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
    user,
    request,
    targetId,
    identifier,
  }: WithUser<
    UpdatePushTargetDTO & { request: NuvixRequest; targetId: string }
  >) {
    const target = await Authorization.skip(
      async () => await this.db.getDocument('targets', targetId),
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

    const updatedTarget = await this.db.updateDocument(
      'targets',
      target.getId(),
      target,
    );

    await this.db.purgeCachedDocument('users', user.getId());
    return updatedTarget;
  }

  /**
   * Delete Push Target
   */
  async deletePushTarget({ user, targetId }: WithUser<{ targetId: string }>) {
    const target = await Authorization.skip(
      async () => await this.db.getDocument('targets', targetId),
    );

    if (target.isEmpty()) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    if (user.getInternalId() !== target.getAttribute('userInternalId')) {
      throw new Exception(Exception.USER_TARGET_NOT_FOUND);
    }

    await this.db.deleteDocument('targets', target.getId());

    await this.db.purgeCachedDocument('users', user.getId());

    // TODO: Handle Delete Queue
    // queueForDeletes
    //   .setType(DELETE_TYPE_TARGET)
    //   .setDocument(target);

    return {};
  }

  /**
   * Get Identities
   */
  async getIdentities({ user, queries }: WithUser<{ queries: Query[] }>) {
    queries.push(Query.equal('userInternalId', [user.getInternalId()]));

    const cursor = queries.find(query =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      // TODO: cursor validator
      const identityId = cursor.getValue();
      const cursorDocument = await this.db.getDocument(
        'identities',
        identityId,
      );

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
      const results = await this.db.find('identities', queries);
      const total = await this.db.count(
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
  async deleteIdentity({ identityId }: { identityId: string }) {
    const identity = await this.db.getDocument('identities', identityId);

    if (identity.isEmpty()) {
      throw new Exception(Exception.USER_IDENTITY_NOT_FOUND);
    }

    await this.db.deleteDocument('identities', identityId);
    return {};
  }
}

type WithReqRes<T = unknown> = {
  request: NuvixRequest;
  response: NuvixRes;
} & T;
type WithUser<T = unknown> = { user: Document } & T;
type WithLocale<T = unknown> = { locale: LocaleTranslator } & T;
