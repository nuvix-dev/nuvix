import { Injectable, Logger } from '@nestjs/common'
import { Authorization, Database, Doc, Role } from '@nuvix/db'
import { ApiKey, AppMode, AuthActivity, Context } from '@nuvix/utils'
import {
  KeysDoc,
  MembershipsDoc,
  ProjectsDoc,
  SessionsDoc,
  TeamsDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { APP_PLATFORM_SERVER, platforms } from '../../config/platforms'
import { roles } from '../../config/roles'
import { AppConfigService } from '../../config.service.js'
import { CoreService } from '../../core.service.js'
import { AuthType } from '../../decorators'
import { Exception } from '../../extend/exception'
import { Auth } from '../../helpers/auth.helper'
import { Key } from '../../helpers/key.helper'
import ParamsHelper from '../../helpers/params.helper'
import { Hook } from '../../server/hooks/interface'

@Injectable()
export class ApiHook implements Hook {
  private readonly logger = new Logger(ApiHook.name)
  private readonly db: Database
  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
  ) {
    this.db = this.coreService.getPlatformDb()
  }

  async onRequest(req: NuvixRequest, _reply: NuvixRes): Promise<void> {
    const params = new ParamsHelper(req)
    const project: ProjectsDoc = req[Context.Project]
    let user: UsersDoc = req[Context.User]
    const team: TeamsDoc = req[Context.Team]
    const mode: AppMode = req[Context.Mode]
    const apiKey: Key | null = req[Context.ApiKey]

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    if (mode === AppMode.ADMIN && project.getId() === 'console') {
      throw new Exception(
        Exception.GENERAL_ACCESS_FORBIDDEN,
        'Nuvix Console cannot be accessed in admin mode.',
      )
    }

    let role = user.empty() ? Role.guests().toString() : Role.users().toString()
    let scopes = roles[role as keyof typeof roles].scopes

    if (apiKey) {
      if (!user.empty()) {
        throw new Exception(Exception.USER_API_KEY_AND_SESSION_SET)
      }

      if (apiKey.isExpired()) {
        throw new Exception(Exception.PROJECT_KEY_EXPIRED)
      }

      role = apiKey.getRole()
      scopes = apiKey.getScopes()

      // Disable authorization checks for API keys
      Authorization.setDefaultStatus(false)
      Auth.setTrustedActor(true)

      // Set auth type to key
      req[Context.AuthType] = AuthType.KEY

      if (apiKey.getRole() === 'apps') {
        user = new Doc({
          $id: '',
          $sequence: -1,
          status: true,
          type: AuthActivity.APP,
          email: `app.${project.getId()}@service.${req.host}`,
          password: '',
          name: apiKey.getName(),
        }) as unknown as UsersDoc
      }

      if (apiKey.getType() === ApiKey.STANDARD) {
        const dbKey = project.findWhere(
          'keys',
          (key: KeysDoc) => key.get('secret') === apiKey.getKey(),
        )
        if (!dbKey || dbKey.empty()) {
          throw new Exception(Exception.USER_UNAUTHORIZED)
        }

        const accessedAt = dbKey.get('accessedAt', 0)

        if (
          new Date(Date.now() - this.appConfig.get('access').key * 1000) >
          new Date(accessedAt as string)
        ) {
          dbKey.set('accessedAt', new Date())
          await this.db.updateDocument('keys', dbKey.getId(), dbKey)
          await this.db.purgeCachedDocument('projects', project.getId())
        }

        const sdksList = platforms[APP_PLATFORM_SERVER].sdks.map(
          sdk => sdk.name,
        )
        const sdk = params.getFromHeaders('x-sdk-name') || 'UNKNOWN'

        if (sdk !== 'UNKNOWN' && sdksList.includes(sdk)) {
          const sdks = dbKey.get('sdks', [])

          if (!sdks.includes(sdk)) {
            sdks.push(sdk)
            dbKey.set('sdks', sdks)

            // Update access time as well
            dbKey.set('accessedAt', new Date())
            await this.db.updateDocument('keys', dbKey.getId(), dbKey)
            await this.db.purgeCachedDocument('projects', project.getId())
          }
        }
      }
    } else if (
      (project.getId() === 'console' && !team.empty() && !user.empty()) ||
      (project.getId() !== 'console' && !user.empty() && mode === AppMode.ADMIN)
    ) {
      const teamId = team.getId()
      let adminRoles: string[] = []
      const memberships = user.get('memberships', []) as MembershipsDoc[]
      for (const membership of memberships) {
        if (
          membership.get('confirm', false) === true &&
          membership.get('teamId') === teamId
        ) {
          adminRoles = membership.get('roles', [])
          break
        }
      }

      if (adminRoles.length === 0) {
        throw new Exception(Exception.USER_UNAUTHORIZED)
      }

      scopes = [] // Reset scope if admin
      for (const adminRole of adminRoles) {
        scopes = scopes.concat(roles[adminRole as keyof typeof roles].scopes)
      }

      Authorization.setDefaultStatus(false) // Cancel security segmentation for admin users.
      Auth.setPlatformActor(true) // current user is platform user
      if (project.empty() || project.getId() !== 'console') {
        Auth.setTrustedActor(true)

        // Set auth type to admin
        req[Context.AuthType] = AuthType.ADMIN
      }
    }

    Authorization.setRole(role)
    for (const authRole of Auth.getRoles(user)) {
      Authorization.setRole(authRole)
    }

    scopes = Array.from(new Set(scopes))

    // Update project last activity
    if (!project.empty() && project.getId() !== 'console') {
      const accessedAt = project.get('accessedAt', 0)
      if (
        new Date(Date.now() - this.appConfig.get('access').key * 1000) >
        new Date(accessedAt as string)
      ) {
        project.set('accessedAt', new Date())
        await Authorization.skip(async () => {
          await this.db.updateDocument('projects', project.getId(), project)
        })
      }
    }

    const session: SessionsDoc = req[Context.Session]

    req[Context.AuthMeta] = {
      user:
        user && !user.empty()
          ? {
              id: user.getId(),
              name: user.get('name'),
              email: user.get('email'),
            }
          : undefined,
      team:
        team && !team.empty()
          ? {
              id: team.getId(),
              name: team.get('name'),
            }
          : undefined,
      session: session
        ? JSON.stringify({
            id: session.getId(),
            userId: session.get('userId'),
            provider: session.get('provider'),
            ip: session.get('ip'),
            userAgent: session.get('userAgent'),
          })
        : undefined,
      roles: JSON.stringify(Authorization.getRoles()),
    }
    req[Context.Scopes] = scopes
    req[Context.Role] = role
    req[Context.User] = user

    this.logger.debug(
      `[${mode}] ${role} ${user.empty() ? 'API' : user.get('email')}`,
    )

    return
  }
}
