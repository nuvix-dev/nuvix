import { Inject, Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Document, Role } from '@nuvix/database';
import {
  ApiKey,
  APP_KEY_ACCESS,
  AppMode,
  DB_FOR_PLATFORM,
  PROJECT,
  PROJECT_DB_CLIENT,
  ROLE,
  SCOPES,
  SESSION,
  TEAM,
  USER,
} from '@nuvix/utils/constants';
import { Exception } from '@nuvix/core/extend/exception';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { roles } from '@nuvix/core/config/roles';
import ParamsHelper from '@nuvix/core/helper/params.helper';
import { APP_PLATFORM_SERVER, platforms } from '@nuvix/core/config/platforms';
import { Hook } from '../../server/hooks/interface';
import { setupDatabaseMeta } from '@nuvix/core/helper/db-meta.helper';
import { Key } from '@nuvix/core/helper/key.helper';

@Injectable()
export class ApiHook implements Hook {
  private readonly logger = new Logger(ApiHook.name);
  constructor(
    @Inject(DB_FOR_PLATFORM) private readonly db: Database,
  ) { }

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    const params = new ParamsHelper(req);
    const project: Document = req[PROJECT];
    let user: Document = req[USER];
    const team: Document = req[TEAM];
    const mode: AppMode = req[AppMode._REQUEST];
    const apiKey: Key | null = req[ApiKey._REQUEST];

    if (project.isEmpty()) throw new Exception(Exception.PROJECT_NOT_FOUND);

    if (mode === AppMode.ADMIN && project.getId() === 'console') {
      throw new Exception(
        Exception.GENERAL_ACCESS_FORBIDDEN,
        'Nuvix Console cannot be accessed in admin mode.',
      );
    }

    let role = user.isEmpty()
      ? Role.guests().toString()
      : Role.users().toString();
    let scopes = roles[role].scopes;

    if (apiKey) {
      if (!user.isEmpty()) {
        throw new Exception(Exception.USER_API_KEY_AND_SESSION_SET);
      }

      if (apiKey.isExpired()) {
        throw new Exception(Exception.PROJECT_KEY_EXPIRED);
      }

      role = apiKey.getRole();
      scopes = apiKey.getScopes();

      // Disable authorization checks for API keys
      Authorization.setDefaultStatus(false);

      if (apiKey.getRole() === Auth.USER_ROLE_APPS) {
        user = new Document({
          $id: '',
          status: true,
          type: Auth.ACTIVITY_TYPE_APP,
          email: 'app.' + project.getId() + '@service.' + req.hostname,
          password: '',
          name: apiKey.getName(),
        });
        // $queueForAudits -> setUser($user);
      }

      if (apiKey.getType() === ApiKey.STANDARD) {
        const dbKey = project.find(
          'secret',
          params.getFromHeaders('x-nuvix-key') || params.getFromQuery('apiKey'),
          'keys'
        );

        if (!dbKey || dbKey?.isEmpty?.()) {
          throw new Exception(Exception.USER_UNAUTHORIZED);
        }

        const accessedAt = dbKey.getAttribute('accessedAt', 0);

        if (new Date(Date.now() - APP_KEY_ACCESS * 1000) > new Date(accessedAt)) {
          dbKey.setAttribute('accessedAt', new Date());
          await this.db.updateDocument('keys', dbKey.getId(), dbKey);
          await this.db.purgeCachedDocument('projects', project.getId());
        }

        const sdksList = platforms[APP_PLATFORM_SERVER].sdks.map(sdk => sdk.name);
        const sdk = params.getFromHeaders('x-sdk-name') || 'UNKNOWN';

        if (sdk !== 'UNKNOWN' && sdksList.includes(sdk)) {
          const sdks = dbKey.getAttribute('sdks', []);

          if (!sdks.includes(sdk)) {
            sdks.push(sdk);
            dbKey.setAttribute('sdks', sdks);

            // Update access time as well
            dbKey.setAttribute('accessedAt', new Date());
            await this.db.updateDocument('keys', dbKey.getId(), dbKey);
            await this.db.purgeCachedDocument('projects', project.getId());
          }
        }
      }
    }
    else if (
      (project.getId() === 'console' && !team.isEmpty() && !user.isEmpty()) ||
      (project.getId() !== 'console' && !user.isEmpty() && mode === AppMode.ADMIN)
    ) {
      const teamId = team.getId();
      let adminRoles: string[] = [];
      const memberships = user.getAttribute('memberships', []);
      for (const membership of memberships) {
        if (
          membership.getAttribute('confirm', false) === true &&
          membership.getAttribute('teamId') === teamId
        ) {
          adminRoles = membership.getAttribute('roles', []);
          break;
        }
      }

      if (adminRoles.length === 0) {
        throw new Exception(Exception.USER_UNAUTHORIZED);
      }

      scopes = []; // Reset scope if admin
      for (const adminRole of adminRoles) {
        scopes = scopes.concat(roles[adminRole].scopes);
      }

      Authorization.setDefaultStatus(false); // Cancel security segmentation for admin users.
    }

    Authorization.setRole(role);
    for (const authRole of Auth.getRoles(user)) {
      Authorization.setRole(authRole);
    }

    scopes = Array.from(new Set(scopes));

    // Update project last activity
    if (!project.isEmpty() && project.getId() !== 'console') {
      const accessedAt = project.getAttribute('accessedAt', 0);
      if (new Date(Date.now() - APP_KEY_ACCESS * 1000) > new Date(accessedAt)) {
        project.setAttribute('accessedAt', new Date());
        await Authorization.skip(async () => {
          await this.db.updateDocument('projects', project.getId(), project);
        });
      }
    }

    const session: Document = req[SESSION];
    const client = req[PROJECT_DB_CLIENT];

    if (client) {
      await setupDatabaseMeta({
        client: req[PROJECT_DB_CLIENT],
        extra: {
          user:
            user && !user.isEmpty()
              ? JSON.stringify({
                $id: user.getId(),
                name: user.getAttribute('name'),
                email: user.getAttribute('email'),
              })
              : undefined,
          session: session ? JSON.stringify(session) : undefined,
          roles: JSON.stringify(Authorization.getRoles()),
        },
        extraPrefix: 'app',
      });
    }

    req[SCOPES] = scopes;
    req[ROLE] = role;
    req[USER] = user;

    this.logger.debug(
      `[${mode}] ${role} ${user.isEmpty() ? 'API' : user.getAttribute('email')}`,
    );

    return;
  }
}
