import { Inject, Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Doc, Role } from '@nuvix-tech/db';
import {
  ApiKey,
  AppMode,
  Context,
  PROJECT_DB_CLIENT,
} from '@nuvix/utils';
import { Exception } from '@nuvix/core/extend/exception';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { roles } from '@nuvix/core/config/roles';
import ParamsHelper from '@nuvix/core/helper/params.helper';
import { APP_PLATFORM_SERVER, platforms } from '@nuvix/core/config/platforms';
import { Hook } from '../../server/hooks/interface';
import { setupDatabaseMeta } from '@nuvix/core/helper/db-meta.helper';
import { Key } from '@nuvix/core/helper/key.helper';
import { KeysDoc, MembershipsDoc, ProjectsDoc, SessionsDoc, TeamsDoc, UsersDoc } from '@nuvix/utils/types';
import { CoreService } from '@nuvix/core/core.service.js';
import { AppConfigService } from '@nuvix/core/config.service.js';

@Injectable()
export class ApiHook implements Hook {
  private readonly logger = new Logger(ApiHook.name);
  private readonly db: Database;
  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
  ) {
    this.db = coreService.getPlatformDb();
  }

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    const params = new ParamsHelper(req);
    const project: ProjectsDoc = req[Context.Project];
    let user: UsersDoc = req[Context.User];
    const team: TeamsDoc = req[Context.Team];
    const mode: AppMode = req[Context.Mode];
    const apiKey: Key | null = req[Context.ApiKey];

    if (project.empty()) throw new Exception(Exception.PROJECT_NOT_FOUND);

    if (mode === AppMode.ADMIN && project.getId() === 'console') {
      throw new Exception(
        Exception.GENERAL_ACCESS_FORBIDDEN,
        'Nuvix Console cannot be accessed in admin mode.',
      );
    }

    let role = user.empty()
      ? Role.guests().toString()
      : Role.users().toString();
    let scopes = roles[role as keyof typeof roles].scopes;

    if (apiKey) {
      if (!user.empty()) {
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
        user = new Doc({
          $id: '',
          status: true,
          type: Auth.ACTIVITY_TYPE_APP,
          email: 'app.' + project.getId() + '@service.' + req.hostname,
          password: '',
          name: apiKey.getName(),
        }) as unknown as UsersDoc;
        // $queueForAudits -> setUser($user);
      }

      if (apiKey.getType() === ApiKey.STANDARD) {
        const dbKey = project.findWhere(
          'keys',
          (key: KeysDoc) => key.get('key') === apiKey.getKey() && key.get('type') === ApiKey.STANDARD,
        );
        if (!dbKey || dbKey.empty()) {
          throw new Exception(Exception.USER_UNAUTHORIZED);
        }

        const accessedAt = dbKey.get('accessedAt', 0);

        if (
          new Date(Date.now() - this.appConfig.get('access').key * 1000) > new Date(accessedAt as string)
        ) {
          dbKey.set('accessedAt', new Date());
          await this.db.updateDocument('keys', dbKey.getId(), dbKey);
          await this.db.purgeCachedDocument('projects', project.getId());
        }

        const sdksList = platforms[APP_PLATFORM_SERVER].sdks.map(
          sdk => sdk.name,
        );
        const sdk = params.getFromHeaders('x-sdk-name') || 'UNKNOWN';

        if (sdk !== 'UNKNOWN' && sdksList.includes(sdk)) {
          const sdks = dbKey.get('sdks', []);

          if (!sdks.includes(sdk)) {
            sdks.push(sdk);
            dbKey.set('sdks', sdks);

            // Update access time as well
            dbKey.set('accessedAt', new Date());
            await this.db.updateDocument('keys', dbKey.getId(), dbKey);
            await this.db.purgeCachedDocument('projects', project.getId());
          }
        }
      }
    } else if (
      (project.getId() === 'console' && !team.empty() && !user.empty()) ||
      (project.getId() !== 'console' &&
        !user.empty() &&
        mode === AppMode.ADMIN)
    ) {
      const teamId = team.getId();
      let adminRoles: string[] = [];
      const memberships = user.get('memberships', []) as MembershipsDoc[];
      for (const membership of memberships) {
        if (
          membership.get('confirm', false) === true &&
          membership.get('teamId') === teamId
        ) {
          adminRoles = membership.get('roles', []);
          break;
        }
      }

      if (adminRoles.length === 0) {
        throw new Exception(Exception.USER_UNAUTHORIZED);
      }

      scopes = []; // Reset scope if admin
      for (const adminRole of adminRoles) {
        scopes = scopes.concat(roles[adminRole as keyof typeof roles].scopes);
      }

      Authorization.setDefaultStatus(false); // Cancel security segmentation for admin users.
    }

    Authorization.setRole(role);
    for (const authRole of Auth.getRoles(user)) {
      Authorization.setRole(authRole);
    }

    scopes = Array.from(new Set(scopes));

    // Update project last activity
    if (!project.empty() && project.getId() !== 'console') {
      const accessedAt = project.get('accessedAt', 0);
      if (new Date(Date.now() - this.appConfig.get('access').key * 1000) > new Date(accessedAt as string)) {
        project.set('accessedAt', new Date());
        await Authorization.skip(async () => {
          await this.db.updateDocument('projects', project.getId(), project);
        });
      }
    }

    const session: SessionsDoc = req[Context.Session];
    const client = req[PROJECT_DB_CLIENT];

    if (client) {
      await setupDatabaseMeta({
        client: req[PROJECT_DB_CLIENT],
        extra: {
          user:
            user && !user.empty()
              ? JSON.stringify({
                $id: user.getId(),
                name: user.get('name'),
                email: user.get('email'),
              })
              : undefined,
          session: session ? JSON.stringify(session) : undefined,
          roles: JSON.stringify(Authorization.getRoles()),
        },
        extraPrefix: 'app',
      });
    }

    req[Context.Scopes] = scopes;
    req[Context.Role] = role;
    req[Context.User] = user;

    this.logger.debug(
      `[${mode}] ${role} ${user.empty() ? 'API' : user.get('email')}`,
    );

    return;
  }
}
