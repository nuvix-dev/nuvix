import {
  Body,
  Controller,
  Param,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import { Patch } from '@nuvix/core'
import { Auth, AuthType, Namespace } from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helpers'
import { ConsoleInterceptor, ResponseInterceptor } from '@nuvix/core/resolvers'
import { IResponse } from '@nuvix/utils'
import { ProjectsDoc } from '@nuvix/utils/types'
import { ProjectParamsDTO } from '../DTO/create-project.dto'
import { AuthSettingsService } from './auth-settings.service'
import {
  AuthDurationDTO,
  AuthLimitDTO,
  AuthMaxSessionsDTO,
  AuthMembershipPrivacyDTO,
  AuthMethodParamsDTO,
  AuthMethodStatusDTO,
  AuthMockNumbersDTO,
  AuthPasswordDictionaryDTO,
  AuthPasswordHistoryDTO,
  AuthPersonalDataDTO,
  AuthSessionAlertsDTO,
} from './DTO/project-auth.dto'

@Namespace('projects')
@Controller({
  version: ['1', VERSION_NEUTRAL],
  path: 'projects/:projectId/auth',
})
@Auth(AuthType.ADMIN)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class AuthSettingsController {
  constructor(private readonly authSettingsService: AuthSettingsService) {}

  @Patch('session-alerts', {
    summary: 'Update project sessions emails',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateSessionAlerts',
      descMd: '/docs/references/projects/update-session-alerts.md',
    },
  })
  async updateSessionAlerts(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: AuthSessionAlertsDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updateSessionAlerts(projectId, input.alerts)
  }

  @Patch('limit', {
    summary: 'Update project users limit',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateAuthLimit',
      descMd: '/docs/references/projects/update-auth-limit.md',
    },
  })
  async updateAuthLimit(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: AuthLimitDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updateAuthLimit(projectId, input.limit)
  }

  @Patch('duration', {
    summary: 'Update project authentication duration',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateAuthDuration',
      descMd: '/docs/references/projects/update-auth-duration.md',
    },
  })
  async updateAuthDuration(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: AuthDurationDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updateSessionDuration(
      projectId,
      input.duration,
    )
  }

  @Patch('password-history', {
    summary: 'Update authentication password history',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateAuthPasswordHistory',
      descMd: '/docs/references/projects/update-auth-password-history.md',
    },
  })
  async updatePasswordHistory(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: AuthPasswordHistoryDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updatePasswordHistory(
      projectId,
      input.limit,
    )
  }

  @Patch('password-dictionary', {
    summary: 'Update authentication password dictionary status',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateAuthPasswordDictionary',
      descMd: '/docs/references/projects/update-auth-password-dictionary.md',
    },
  })
  async updatePasswordDictionary(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: AuthPasswordDictionaryDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updatePasswordDictionary(
      projectId,
      input.enabled,
    )
  }

  @Patch('personal-data', {
    summary: 'Update personal data check',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updatePersonalDataCheck',
      descMd: '/docs/references/projects/update-personal-data-check.md',
    },
  })
  async updatePersonalData(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: AuthPersonalDataDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updatePersonalData(projectId, input.enabled)
  }

  @Patch('max-sessions', {
    summary: 'Update project user sessions limit',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateAuthSessionsLimit',
      descMd: '/docs/references/projects/update-auth-sessions-limit.md',
    },
  })
  async updateMaxSessions(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: AuthMaxSessionsDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updateMaxSessions(projectId, input.limit)
  }

  @Patch('mock-numbers', {
    summary: 'Update the mock numbers for the project',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateMockNumbers',
      descMd: '/docs/references/projects/update-mock-numbers.md',
    },
  })
  async updateMockNumbers(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: AuthMockNumbersDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updateMockNumbers(projectId, input)
  }

  @Patch('memberships-privacy', {
    summary: 'Update project memberships privacy attributes',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateMembershipsPrivacy',
      descMd: '/docs/references/projects/update-memberships-privacy.md',
    },
  })
  async updateMembershipsPrivacy(
    @Param() { projectId }: ProjectParamsDTO,
    @Body() input: AuthMembershipPrivacyDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updateMembershipsPrivacy(projectId, input)
  }

  @Patch(':method', {
    summary: 'Update project auth method status',
    scopes: 'projects.update',
    model: Models.PROJECT,
    sdk: {
      name: 'updateAuthStatus',
      descMd: '/docs/references/projects/update-auth-status.md',
    },
  })
  async updateAuthMethod(
    @Param() { projectId, method }: AuthMethodParamsDTO,
    @Body() input: AuthMethodStatusDTO,
  ): Promise<IResponse<ProjectsDoc>> {
    return this.authSettingsService.updateAuthMethod(
      projectId,
      method,
      input.status,
    )
  }
}
