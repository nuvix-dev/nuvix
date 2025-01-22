import { TokenDocument } from 'src/console-user/schemas/token.schema';
import { SessionDocument } from './schemas/account.schema';
import { UserDocument } from 'src/console-user/schemas/user.schema';
import Role from 'src/core/helper/role.helper';
import Roles from 'src/core/validators/roles.validator';
import { Auth as BaseAuth } from 'src/core/helper/auth.helper';
import { ClsServiceManager } from 'nestjs-cls';
import { Authorization } from 'src/core/validators/authorization.validator';

//@ts-ignore
export class Auth extends BaseAuth {
  public static override tokenVerify(
    tokens: TokenDocument[],
    type: number | null,
    secret: string,
  ): TokenDocument | false {
    for (const token of tokens) {
      if (
        token.secret !== undefined &&
        token.expire !== undefined &&
        token.type !== undefined &&
        (type === null || token.type === type) &&
        token.secret === this.hash(secret) &&
        new Date(token.expire) >= new Date()
      ) {
        return token;
      }
    }

    return false;
  }

  public static override sessionVerify(
    sessions: SessionDocument[],
    secret: string,
  ): string | false {
    for (const session of sessions) {
      if (
        session.secret !== undefined &&
        session.provider !== undefined &&
        session.secret === this.hash(secret) &&
        new Date(session.expire) >= new Date()
      ) {
        return session.$id;
      }
    }

    return false;
  }

  public static override getRoles(user: UserDocument): string[] {
    const authorization = ClsServiceManager.getClsService().get(
      'authorization',
    ) as Authorization;
    const roles: string[] = [];

    if (
      !this.isPrivilegedUser(authorization.getRoles()) &&
      !this.isAppUser(authorization.getRoles())
    ) {
      if (user.$id) {
        roles.push(Role.User(user.$id).toString());
        roles.push(Role.Users().toString());

        const emailVerified = user.emailVerification;
        const phoneVerified = user.phoneVerification;

        if (emailVerified || phoneVerified) {
          roles.push(Role.User(user.$id, Roles.DIMENSION_VERIFIED).toString());
          roles.push(Role.Users(Roles.DIMENSION_VERIFIED).toString());
        } else {
          roles.push(
            Role.User(user.$id, Roles.DIMENSION_UNVERIFIED).toString(),
          );
          roles.push(Role.Users(Roles.DIMENSION_UNVERIFIED).toString());
        }
      } else {
        return [Role.Guests().toString()];
      }
    }

    for (const node of user.memberships || []) {
      if (!node.confirm) {
        continue;
      }

      if (node.$id && node.teamId) {
        roles.push(Role.Team(node.teamId).toString());
        roles.push(Role.Member(node.$id).toString());

        if (node.roles) {
          for (const nodeRole of node.roles) {
            roles.push(Role.Team(node.teamId, nodeRole).toString());
          }
        }
      }
    }

    for (const label of user.labels || []) {
      roles.push(`label:${label}`);
    }

    return roles;
  }

  public static override isAnonymousUser(user: UserDocument): boolean {
    return user.email === null && user.phone === null;
  }
}
