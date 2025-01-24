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
import { Request, Response } from 'express';
import { CountryResponse, Reader } from 'maxmind';
import * as fs from 'fs';
import { Exception } from 'src/core/extend/exception';
import { Auth } from 'src/core/helper/auth.helper';
import { Detector } from 'src/core/helper/detector.helper';
import { PersonalDataValidator } from 'src/core/validators/personal-data.validator';
import { CONSOLE_CONFIG, DB_FOR_CONSOLE } from 'src/Utils/constants';
import { ResolverInterceptor } from 'src/core/resolver/response.resolver';
import {
  UpdateEmailDTO,
  UpdateNameDTO,
  UpdatePhoneDTO,
} from './DTO/account.dto';

@Injectable()
@UseInterceptors(ResolverInterceptor)
export class AccountService {
  private readonly geodb: Reader<CountryResponse>;
  constructor(
    // private readonly queueForEvents: Event,
    // private readonly queueForMails: Mail,
    // private readonly locale: Locale,
    // private readonly geodb: Reader<CountryResponse>,
    @Inject(DB_FOR_CONSOLE) private readonly db: Database,
  ) {
    try {
      const buffer = fs.readFileSync(
        process.cwd() + '/assets/dbip/dbip-country-lite-2024-09.mmdb',
      );
      this.geodb = new Reader<CountryResponse>(buffer);
    } catch (error) {
      console.warn(
        'GeoIP database not found, country detection will be disabled',
      );
      this.geodb = null;
    }
  }

  /**
   * Create a new account
   */
  async createAccount(
    userId: string,
    email: string,
    password: string,
    name: string,
    request: Request,
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

    // queueForEvents.setParam('userId', user.getId());

    return user;
  }

  async updatePrefs(user: Document, prefs: { [key: string]: any }) {
    user.setAttribute('prefs', prefs);

    user = await this.db.updateDocument('users', user.getId(), user);

    return user.getAttribute('prefs', {});
  }

  async updateEmail(user: Document, input: UpdateEmailDTO) {}

  async updateName(user: Document, input: UpdateNameDTO) {}

  async updatePhone(user: Document, input: UpdatePhoneDTO) {}

  /**
   * Create a new session for the user
   */
  async createSession(
    userId: string,
    secret: string,
    request: Request,
    response: Response,
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

    user.setAttributes(userFromRequest.getArrayCopy());

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

    const session = new Document({
      $id: ID.unique(),
      userId: user.getId(),
      userInternalId: user.getInternalId(),
      provider: Auth.getSessionProviderByTokenType(
        verifiedToken.getAttribute('type'),
      ),
      secret: Auth.hash(sessionSecret),
      userAgent: request.get('User-Agent') || 'UNKNOWN',
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
