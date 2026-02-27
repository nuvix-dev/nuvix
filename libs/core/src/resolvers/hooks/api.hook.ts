import { Injectable, Logger } from '@nestjs/common'
import { Authorization, Database, Doc, Role } from '@nuvix/db'
import { ApiKey, AppMode, AuthActivity, configuration } from '@nuvix/utils'
import type { KeysDoc, UsersDoc } from '@nuvix/utils/types'
import { APP_PLATFORM_SERVER, platforms } from '../../config/platforms'
import { roles } from '../../config/roles'
import { CoreService } from '../../core.service.js'
import { AuthType } from '../../decorators'
import { Exception } from '../../extend/exception'
import { Auth, UserRole } from '../../helpers/auth.helper'
import ParamsHelper from '../../helpers/params.helper'
import { Hook } from '../../server/hooks/interface'

@Injectable()
export class ApiHook implements Hook {
  private readonly logger = new Logger(ApiHook.name)
  private readonly internalDb: Database
  constructor(private readonly coreService: CoreService) {
    this.internalDb = this.coreService.getInternalDatabase()
  }

  async onRequest(req: NuvixRequest): Promise<void> {
    const params = new ParamsHelper(req)
    const { project, apiKey, mode } = req.context
    let user = req.context.user

    if (mode === AppMode.ADMIN && this.coreService.isConsole()) {
      throw new Exception(
        Exception.GENERAL_ACCESS_FORBIDDEN,
        'Admin mode is not allowed in console requests',
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

      req.context._isAPIUser = true
      req.context.authType = AuthType.KEY

      if (apiKey.getRole() === 'apps') {
        user = new Doc({
          $id: '',
          $sequence: -1,
          status: true,
          type: AuthActivity.APP,
          email: `app.${project.getId()}@service.${req.host}`,
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
          new Date(Date.now() - configuration.access.key * 1000) >
          new Date(accessedAt as string)
        ) {
          dbKey.set('accessedAt', new Date())
          await this.internalDb.updateDocument('keys', dbKey.getId(), dbKey)
          await this.internalDb.purgeCachedDocument('projects', project.getId())
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
            await this.internalDb.updateDocument('keys', dbKey.getId(), dbKey)
            await this.internalDb.purgeCachedDocument(
              'projects',
              project.getId(),
            )
          }
        }
      }
    } else if (
      !user.empty() &&
      (this.coreService.isConsole() || mode === AppMode.ADMIN)
    ) {
      const adminRoles: string[] = [UserRole.OWNER] // will support dynamic admin roles in the future, for now only owner role is considered as admin
      scopes = []
      for (const adminRole of adminRoles) {
        scopes = scopes.concat(roles[adminRole as keyof typeof roles].scopes)
      }

      Authorization.setDefaultStatus(false) // Cancel security segmentation for admin users.
      req.context._isAdminUser = true

      if (mode === AppMode.ADMIN) {
        // req.context._isAPIUser = true; // Admin mode is a special mode for API users with elevated privileges, so we set _isAPIUser to true as well
        // Set auth type to admin
        req.context.authType = AuthType.ADMIN
      }
    }

    Authorization.setRole(role)
    for (const authRole of Auth.getRoles(
      user,
      req.context.isAdminUser,
      req.context.isAPIUser,
    )) {
      Authorization.setRole(authRole)
    }

    scopes = Array.from(new Set(scopes))

    req.context.scopes = scopes
    req.context.role = role
    req.context.user = user

    this.logger.debug(
      `[${mode ?? AppMode.DEFAULT}] ${role} ${user.empty() ? 'API' : user.getId()}`,
    )
  }
}
