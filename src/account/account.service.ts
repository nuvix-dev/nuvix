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
import DuplicateException from '@nuvix/database/dist/errors/Duplicate';
import { Exception } from 'src/core/extend/exception';
import { Auth } from 'src/core/helper/auth.helper';
import { LocaleTranslator } from 'src/core/helper/locale.helper';
import { Response } from 'src/core/helper/response.helper';
import { PersonalDataValidator } from 'src/core/validators/personal-data.validator';
import { DB_FOR_PROJECT, EVENT_USER_CREATE, EVENT_USER_DELETE } from 'src/Utils/constants';

@Injectable()
export class AccountService {

  constructor(
    @Inject(DB_FOR_PROJECT) private readonly db: Database,
    private eventEmitter: EventEmitter2
  ) { }

  /**
  * Create a new account
  */
  async createAccount(
    userId: string,
    email: string,
    password: string,
    name: string,
    user: Document,
    project: Document
  ): Promise<Document> {
    email = email.toLowerCase();

    const auths = project.getAttribute('auths', {})

    const limit = auths.limit ?? 0;

    if (limit !== 0) {
      const total = await this.db.count('users', []);

      if (total >= limit) {
        throw new Exception(Exception.USER_COUNT_EXCEEDED);
      }
    }

    const identityWithMatchingEmail = await this.db.findOne('identities', [
      Query.equal('providerEmail', [email]),
    ]);

    if (identityWithMatchingEmail && !identityWithMatchingEmail.isEmpty()) {
      throw new Exception(Exception.GENERAL_BAD_REQUEST);
    }

    if (auths.personalDataCheck ?? false) {
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

    const passwordHistory = auths.passwordHistory ?? 0;
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

    await this.eventEmitter.emitAsync(EVENT_USER_CREATE, { userId: user.getId() })

    return user;
  }

  async updatePrefs(user: Document, prefs: { [key: string]: any }) {
    user.setAttribute('prefs', prefs);

    user = await this.db.updateDocument('users', user.getId(), user);

    return user.getAttribute('prefs', {});
  }

  async deleteAccount(user: Document) {
    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    await Authorization.skip(
      async () => await this.db.deleteDocument('users', user.getId()),
    );

    await this.eventEmitter.emitAsync(EVENT_USER_DELETE, {
      userId: user.getId(),
      payload: {
        data: user,
        type: Response.MODEL_USER
      }
    })

    await this.db.purgeCachedDocument('users', user.getId());

    return user;
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
      const countryName = locale.getText(session.getAttribute('countryCode', ''), locale.getText('locale.country.unknown'));

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



}
