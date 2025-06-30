import { Inject, Injectable, Logger } from '@nestjs/common';
import { Authorization, Database, Document, Role } from '@nuvix/database';
import {
  API_KEY_DYNAMIC,
  API_KEY_STANDARD,
  APP_KEY_ACCESS,
  APP_MODE_DEFAULT,
  DB_FOR_PLATFORM,
  PROJECT,
  SCOPES,
  USER,
} from '@nuvix/utils/constants';
import { Exception } from '@nuvix/core/extend/exception';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { roles } from '@nuvix/core/config/roles';
import ParamsHelper from '@nuvix/core/helper/params.helper';
import { JwtService } from '@nestjs/jwt';
import { APP_PLATFORM_SERVER, platforms } from '@nuvix/core/config/platforms';
import { Hook } from '../../server/hooks/interface';

@Injectable()
export class ApiHook implements Hook {
  private readonly logger = new Logger(ApiHook.name);
  constructor(
    @Inject(DB_FOR_PLATFORM) private readonly db: Database,
    private readonly jwtService: JwtService,
  ) {}

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    const params = new ParamsHelper(req);
    const project: Document = req[PROJECT];
    let user: Document = req[USER];
    const mode: string =
      params.getFromHeaders('x-nuvix-mode') ||
      params.getFromQuery('mode', APP_MODE_DEFAULT);

    if (project.isEmpty()) throw new Exception(Exception.PROJECT_NOT_FOUND);

    // ACL Check
    let role = user.isEmpty()
      ? Role.guests().toString()
      : Role.users().toString();

    // Add user roles
    const memberships = user.find<Document>(
      'teamId',
      project.getAttribute('teamId'),
      'memberships',
    );

    if (memberships) {
      memberships.getAttribute('roles', []).forEach((memberRole: string) => {
        switch (memberRole) {
          case 'owner':
            role = Auth.USER_ROLE_OWNER;
            break;
          case 'admin':
            role = Auth.USER_ROLE_ADMIN;
            break;
          case 'developer':
            role = Auth.USER_ROLE_DEVELOPER;
            break;
        }
      });
    }

    let scopes = roles[role].scopes; // Allowed scopes for user role
    const apiKey: string = params.getFromHeaders('x-nuvix-api');

    if (apiKey) {
      // Don't allow API key to be used for session based requests
      if (!user.isEmpty()) {
        throw new Exception(Exception.USER_API_KEY_AND_SESSION_SET);
      }

      if (!apiKey.includes('_')) {
        throw new Exception(
          Exception.INVALID_PARAMS,
          'Invalid API Key Structure',
        );
      }

      const [keyType, KeyId] = apiKey.split('_', 2);

      if (keyType === API_KEY_DYNAMIC) {
        let payload: any;
        try {
          payload = this.jwtService.verify(KeyId);
        } catch (error) {
          throw new Exception(Exception.API_KEY_EXPIRED);
        }

        const projectId = payload['projectId'] ?? '';
        const tokenScopes = payload['scopes'] ?? [];

        // JWT includes project ID for better security
        if (projectId === project.getId()) {
          user = new Document({
            $id: '',
            status: true,
            email: `app.${project.getId()}@service.${req.hostname}`,
            password: '',
            name: project.getAttribute('name', 'Untitled'),
          });

          role = Auth.USER_ROLE_APPS;
          scopes = [...roles[role].scopes, ...tokenScopes];

          Authorization.setRole(Auth.USER_ROLE_APPS);
          Authorization.setDefaultStatus(false); // Cancel security segmentation for API keys.
        }
      } else if (keyType === API_KEY_STANDARD) {
        const key = project.find<Document>('secret', apiKey, 'keys');
        if (key) {
          user = new Document({
            $id: '',
            status: true,
            email: `app.${project.getId()}@service.${req.hostname}`,
            password: '',
            name: project.getAttribute('name', 'Untitled'),
          });

          role = Auth.USER_ROLE_APPS;
          scopes = [...roles[role].scopes, ...key.getAttribute('scopes', [])];

          const expire = key.getAttribute('expire');
          if (expire && new Date(expire) < new Date()) {
            throw new Exception(Exception.PROJECT_KEY_EXPIRED);
          }

          Authorization.setRole(Auth.USER_ROLE_APPS);
          Authorization.setDefaultStatus(false);

          const accessedAt = key.getAttribute('accessedAt', '');
          if (
            new Date(Date.now() - APP_KEY_ACCESS * 1000) > new Date(accessedAt)
          ) {
            key.setAttribute('accessedAt', new Date().toISOString());
            await this.db.updateDocument('keys', key.getId(), key);
            await this.db.purgeCachedDocument('projects', project.getId());
          }

          const sdksList = platforms[APP_PLATFORM_SERVER].sdks.map(
            sdk => sdk.name,
          );

          const sdk = params.getFromHeaders('x-sdk-name') || 'UNKNOWN';
          if (sdksList.includes(sdk)) {
            const sdks = key.getAttribute('sdks', []);
            if (!sdks.includes(sdk)) {
              sdks.push(sdk);
              key.setAttribute('sdks', sdks);

              key.setAttribute('accessedAt', new Date().toISOString());
              await this.db.updateDocument('keys', key.getId(), key);
              await this.db.purgeCachedDocument('projects', project.getId());
            }
          }
        }
      }
    }

    Authorization.setRole(role);
    for (const authRole of Auth.getRoles(user)) {
      Authorization.setRole(authRole);
    }

    req[SCOPES] = scopes;
    req['role'] = role;
    req[USER] = user;

    this.logger.log(
      `[${mode}] ${role} ${user.isEmpty() ? 'API' : user.getAttribute('email')}`,
    );

    return;
  }
}
