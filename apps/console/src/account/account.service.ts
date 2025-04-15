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
import { FastifyRequest, FastifyReply } from 'fastify';
import { CountryResponse, Reader } from 'maxmind';
import { Exception } from '@nuvix/core/extend/exception';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { Detector } from '@nuvix/core/helper/detector.helper';
import { PersonalDataValidator } from '@nuvix/core/validators/personal-data.validator';
import {
  CONSOLE_CONFIG,
  DB_FOR_CONSOLE,
  GEO_DB,
  PROJECT_ROOT,
  SEND_TYPE_EMAIL,
  WORKER_TYPE_MAILS,
} from '@nuvix/utils/constants';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import {
  UpdateEmailDTO,
  UpdateNameDTO,
  UpdatePasswordDTO,
  UpdatePhoneDTO,
} from './DTO/account.dto';
import { PasswordHistoryValidator } from '@nuvix/core/validators/password-history.validator';
import { MfaType, TOTP } from '@nuvix/core/validators/MFA.validator';
import { CreateEmailSessionDTO } from './DTO/session.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as Template from 'handlebars';
import * as fs from 'fs';
import {
  MailJobs,
  MailQueueOptions,
} from '@nuvix/core/resolvers/queues/mail.queue';

@Injectable()
@UseInterceptors(ResponseInterceptor)
export class AccountService {
  constructor(
    @Inject(GEO_DB) private readonly geodb: Reader<CountryResponse>,
    @Inject(DB_FOR_CONSOLE) private readonly db: Database,
    @InjectQueue(WORKER_TYPE_MAILS)
    private readonly mailQueue: Queue<MailQueueOptions, MailJobs>,
  ) { }

  /**
   * Create a new account
   */
  async createAccount(
    userId: string,
    email: string,
    password: string,
    name: string,
    request: FastifyRequest,
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

    const templatePath =
      PROJECT_ROOT + 'assets/locale/templates/email-account-create.tpl';
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Template.compile(templateSource);

    const body = template({
      name: user.getAttribute('name', 'User'),
      verification_link: '#',
    });

    const vars = {
      date: new Date().toDateString(),
      year: new Date().getFullYear(),
    };

    await this.mailQueue.add(SEND_TYPE_EMAIL, {
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

    // Delete the user document
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
  async updateName(user: Document, input: UpdateNameDTO) {
    user.setAttribute('name', input.name);

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
   * Get User's MFA factors
   */
  async getMfaFactors(user: Document) {
    const mfaRecoveryCodes = user.getAttribute('mfaRecoveryCodes', []);
    const recoveryCodeEnabled =
      Array.isArray(mfaRecoveryCodes) && mfaRecoveryCodes.length > 0;

    const totp = TOTP.getAuthenticatorFromUser(user);

    const factors = new Document({
      [MfaType.TOTP]: totp !== null && totp.getAttribute('verified', false),
      [MfaType.EMAIL]:
        user.getAttribute('email', false) &&
        user.getAttribute('emailVerification', false),
      [MfaType.PHONE]:
        user.getAttribute('phone', false) &&
        user.getAttribute('phoneVerification', false),
      [MfaType.RECOVERY_CODE]: recoveryCodeEnabled,
    });

    return factors;
  }

  /**
   * Get Logs
   */
  async getLogs(user: Document, queries: Query[]) {
    const grouped = Query.groupByType(queries);
    const limit = grouped.limit ?? CONSOLE_CONFIG.auths.limit ?? 100;
    const offset = grouped.offset ?? 0;

    // const audit = new EventAudit(this.db);

    const logs: any = []; //await audit.getLogsByUser(user.getInternalId(), limit, offset);

    const output = [];

    for (const log of logs) {
      log.userAgent = log.userAgent || 'UNKNOWN';

      const detector = new Detector(log.userAgent);

      const logDocument = new Document({
        ...log.toObject(),
        ...log.data,
        ...detector.getOS(),
        ...detector.getClient(),
        ...detector.getDevice(),
      });

      const record = this.geodb.get(log.ip);

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
      total: 0, //await audit.countLogsByUser(user.getInternalId()),
      logs: output,
    };
  }

  /**
   * Get User's Sessions
   */
  async getSessions(user: Document) {
    const roles = Authorization.getRoles();
    const isPrivilegedUser = Auth.isPrivilegedUser(roles);
    const isAppUser = Auth.isAppUser(roles);

    const sessions = user.getAttribute('sessions', []);
    const current = Auth.sessionVerify(sessions, Auth.secret);

    const updatedSessions = sessions.map((session: Document) => {
      const countryName = ''; // TODO: Implement locale.getText equivalent

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
    request: FastifyRequest,
    response: FastifyReply,
  ) {
    const protocol = request.protocol;
    const sessions = user.getAttribute('sessions', []);

    for (const session of sessions) {
      await this.db.deleteDocument('sessions', session.getId());

      if (!CONSOLE_CONFIG.domainVerification) {
        response.header('X-Fallback-Cookies', JSON.stringify([]));
      }

      session.setAttribute('current', false);
      session.setAttribute('countryName', 'Unknown'); // Implement locale.getText equivalent if needed

      if (session.getAttribute('secret') === Auth.hash(Auth.secret)) {
        session.setAttribute('current', true);

        // If current session, delete the cookies too
        response
          .cookie(`${Auth.cookieName}_legacy`, '', {
            expires: new Date(0),
            path: '/',
            // domain: Config.getParam('cookieDomain'),
            secure: protocol === 'https',
            httpOnly: true,
          })
          .cookie(Auth.cookieName, '', {
            expires: new Date(0),
            path: '/',
            // domain: Config.getParam('cookieDomain'),
            secure: protocol === 'https',
            httpOnly: true,
            // sameSite: Config.getParam('cookieSamesite'),
          });

        // Use current session for events.
        // queueForEvents.setPayload(response.output(session, Models.SESSION));

        // queueForDeletes.setType(DELETE_TYPE_SESSION_TARGETS).setDocument(session).trigger();
      }
    }

    await this.db.purgeCachedDocument('users', user.getId());

    return;
  }

  /**
   * Get a Session
   */
  async getSession(user: Document, sessionId: string) {
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
        // TODO: add logic to ..
        const countryName = '--';
        // locale.getText(
        //   'countries.' + session.getAttribute('countryCode').toLowerCase(),
        //   locale.getText('locale.country.unknown')
        // );

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
    request: FastifyRequest,
    response: FastifyReply,
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
          })
          .cookie(Auth.cookieName, '', {
            expires: new Date(0),
            path: '/',
            secure: protocol === 'https',
            httpOnly: true,
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

    const authDuration =
      CONSOLE_CONFIG.auths.duration ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG;
    session.setAttribute('expire', new Date(Date.now() + authDuration * 1000));

    const provider = session.getAttribute('provider', '');
    const refreshToken = session.getAttribute('providerRefreshToken', '');
    const className = `nuvix\\Auth\\OAuth2\\${provider.charAt(0).toUpperCase() + provider.slice(1)}`;

    if (provider && className in global) {
      const appId = CONSOLE_CONFIG.oAuthProviders[`${provider}Appid`] ?? '';
      const appSecret =
        CONSOLE_CONFIG.oAuthProviders[`${provider}Secret`] ?? '';

      const oauth2 = new (global as any)[className](
        appId,
        appSecret,
        '',
        [],
        [],
      );
      await oauth2.refreshTokens(refreshToken);

      session
        .setAttribute('providerAccessToken', oauth2.getAccessToken(''))
        .setAttribute('providerRefreshToken', oauth2.getRefreshToken(''))
        .setAttribute(
          'providerAccessTokenExpiry',
          new Date(Date.now() + oauth2.getAccessTokenExpiry('') * 1000),
        );
    }

    await this.db.updateDocument('sessions', sessionId, session);
    await this.db.purgeCachedDocument('users', user.getId());

    // queueForEvents.setParam('userId', user.getId()).setParam('sessionId', session.getId());

    return session;
  }

  /**
   * Get identities
   */
  async getIdentities(user: Document, queries: Query[]) {
    queries.push(Query.equal('userInternalId', [user.getInternalId()]));

    const cursor = queries.find(query =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
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

    const filterQueries = Query.groupByType(queries).filters;

    const results = await this.db.find('identities', queries);
    const total = await this.db.count('identities', filterQueries);

    return {
      identities: results,
      total: total,
    };
  }

  /**
   * Get identity
   */
  async getIdentity(id: string) {
    const identity = await this.db.getDocument('identities', id);

    if (identity.isEmpty()) {
      throw new Exception(Exception.USER_IDENTITY_NOT_FOUND);
    }

    return identity;
  }

  /**
   * Create a new session for the user using Email & Password
   */
  async createEmailSession(
    user: Document,
    input: CreateEmailSessionDTO,
    request: FastifyRequest,
    response: FastifyReply,
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
      .cookie(
        `${Auth.cookieName}_legacy`,
        Auth.encodeSession(user.getId(), secret),
        {
          expires: expire,
          path: '/',
          secure: protocol === 'https',
          domain: Auth.cookieDomain,
          sameSite: Auth.cookieSamesite as any,
          httpOnly: true,
        },
      )
      .cookie(Auth.cookieName, Auth.encodeSession(user.getId(), secret), {
        expires: expire,
        path: '/',
        secure: protocol === 'https',
        domain: Auth.cookieDomain,
        sameSite: Auth.cookieSamesite as any,
        httpOnly: true,
      })
      .status(201);

    const countryName = ''; // Implement locale.getText equivalent if needed

    createdSession
      .setAttribute('current', true)
      .setAttribute('countryName', countryName)
      .setAttribute(
        'secret',
        isPrivilegedUser || isAppUser
          ? Auth.encodeSession(user.getId(), secret)
          : '',
      );

    return createdSession;
  }

  /**
   * Create a new session for the user
   */
  async createSession(
    userId: string,
    secret: string,
    request: FastifyRequest,
    response: FastifyReply,
    user: Document,
    // locale: Locale,
    // queueForEvents: Event,
    // queueForMails: Mail
  ) {
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
      // sendSessionAlert(locale, user, project, createdSession, queueForMails);
    }

    // queueForEvents.setParam('userId', user.getId()).setParam('sessionId', createdSession.getId());

    // if (!Config.getParam('domainVerification')) {
    //   response.setHeader('X-Fallback-Cookies', JSON.stringify({ [Auth.cookieName]: Auth.encodeSession(user.getId(), sessionSecret) }));
    // }

    const expire = new Date(Date.now() + duration * 1000);
    const protocol = request.protocol;

    response
      .cookie(
        `${Auth.cookieName}_legacy`,
        Auth.encodeSession(user.getId(), sessionSecret),
        {
          expires: new Date(expire),
          path: '/',
          // domain: Config.getParam('cookieDomain'),
          secure: protocol === 'https',
          httpOnly: true,
        },
      )
      .cookie(
        Auth.cookieName,
        Auth.encodeSession(user.getId(), sessionSecret),
        {
          expires: new Date(expire),
          path: '/',
          // domain: Config.getParam('cookieDomain'),
          secure: protocol === 'https',
          httpOnly: true,
          // sameSite: Config.getParam('cookieSamesite'),
        },
      )
      .status(201);

    const countryName = ''; // locale.getText(`countries.${session.getAttribute('countryCode').toLowerCase()}`, locale.getText('locale.country.unknown'));

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
}
