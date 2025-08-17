import { ApiKey } from '@nuvix/utils';
import { Auth } from './auth.helper';
import { roles } from '../config/roles';
import { Doc } from '@nuvix-tech/db';
import { JwtService } from '@nestjs/jwt';
import { KeysDoc, ProjectsDoc } from '@nuvix/utils/types';

interface JWTPayload {
  name?: string;
  projectId?: string;
  disabledMetrics?: string[];
  hostnameOverride?: boolean;
  bannerDisabled?: boolean;
  projectCheckDisabled?: boolean;
  previewAuthDisabled?: boolean;
  deploymentStatusIgnored?: boolean;
  scopes?: string[];
}

export class Key {
  private static jwtService: JwtService;
  constructor(
    protected projectId: string,
    protected type: string,
    protected role: string,
    protected scopes: string[],
    protected name: string,
    protected readonly key: string,
    protected readonly expired: boolean = false,
  ) {}

  public getProjectId(): string {
    return this.projectId;
  }

  public getType(): string {
    return this.type;
  }

  public getRole(): string {
    return this.role;
  }

  public getScopes(): string[] {
    return this.scopes;
  }

  public getName(): string {
    return this.name;
  }

  public getKey(): string {
    return this.key;
  }

  public isExpired(): boolean {
    return this.expired;
  }

  public static setJwtService(jwtService: JwtService) {
    Key.jwtService = jwtService;
  }

  /**
   * Decode the given secret key into a Key object, containing the project ID, type, role, scopes, and name.
   * Can be a stored API key or a dynamic key (JWT).
   */
  public static async decode(project: ProjectsDoc, key: string): Promise<Key> {
    let type: string;
    let secret: string;

    if (key.includes('_')) {
      [type, secret] = key.split('_', 2) as [string, string];
    } else {
      type = ApiKey.STANDARD;
      secret = key;
    }

    const role = Auth.USER_ROLE_APPS;
    let scopes = roles[Auth.USER_ROLE_APPS]?.scopes ?? [];
    let expired = false;

    const guestKey = new Key(
      project.getId(),
      type,
      Auth.USER_ROLE_GUESTS,
      roles[Auth.USER_ROLE_GUESTS]?.scopes ?? [],
      'UNKNOWN',
      key,
    );

    switch (type) {
      case ApiKey.DYNAMIC:
        if (!Key.jwtService) {
          throw new Error('JWT Service is not set for Key decoding');
        }

        let payload: JWTPayload = {};
        try {
          payload = (await Key.jwtService.verifyAsync(secret)) as JWTPayload;
        } catch (error) {
          expired = true;
        }

        const name = payload.name ?? 'Dynamic Key';
        const projectId = payload.projectId ?? '';
        const projectCheckDisabled = payload.projectCheckDisabled ?? false;
        scopes = [...(payload.scopes ?? []), ...scopes];

        if (!projectCheckDisabled && projectId !== project.getId()) {
          return guestKey;
        }

        return new Key(projectId, type, role, scopes, name, key, expired);

      case ApiKey.STANDARD:
        const keyDoc = project.findWhere(
          'keys',
          (item: Doc) => item.get('secret') === key,
        ) as KeysDoc | null;

        if (!keyDoc) {
          return guestKey;
        }

        const expire = keyDoc.get('expire');
        if (
          expire &&
          new Date(expire as string).getMilliseconds() < Date.now()
        ) {
          expired = true;
        }

        const keyName = keyDoc.get('name', 'UNKNOWN');
        scopes = [...keyDoc.get('scopes', []), ...scopes];

        return new Key(
          project.getId(),
          type,
          role,
          scopes,
          keyName,
          key,
          expired,
        );

      default:
        return guestKey;
    }
  }
}
