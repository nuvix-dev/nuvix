import { Injectable } from '@nestjs/common'
import { CoreService } from '@nuvix/core'
import { authMethods } from '@nuvix/core/config'
import { Exception } from '@nuvix/core/extend/exception'
import { Database } from '@nuvix/db'
import {
  AuthMembershipPrivacyDTO,
  AuthMockNumbersDTO,
} from './DTO/project-auth.dto'

@Injectable()
export class AuthSettingsService {
  private readonly db: Database

  constructor(private coreService: CoreService) {
    this.db = this.coreService.getPlatformDb()
  }

  /**
   * Update session alerts of a project.
   */
  async updateSessionAlerts(id: string, status = false) {
    let project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const auths = project.get('auths', {})
    auths.sessionAlerts = status

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }

  /**
   * Update users limit of a project.
   */
  async updateAuthLimit(id: string, limit: number) {
    let project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const auths = project.get('auths', {})
    auths.limit = limit

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }

  /**
   * Update session duration of a project.
   */
  async updateSessionDuration(id: string, duration: number) {
    let project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const auths = project.get('auths', {})
    auths.duration = duration

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }

  /**
   * Update auth method of a project.
   */
  async updateAuthMethod(id: string, method: string, status: boolean) {
    let project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const auth: any = authMethods[method] ?? {}
    const authKey = auth.key ?? ''

    const auths = project.get('auths', {})
    auths[authKey] = status

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }

  /**
   * Update password history of a project.
   */
  async updatePasswordHistory(id: string, limit: number) {
    let project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const auths = project.get('auths', {})
    auths.passwordHistory = limit

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }

  /**
   * Update password dictionary of a project.
   */
  async updatePasswordDictionary(id: string, enabled: boolean) {
    let project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const auths = project.get('auths', {})
    auths.passwordDictionary = enabled

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }

  /**
   * Update personal data of a project.
   */
  async updatePersonalData(id: string, enabled: boolean) {
    let project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const auths = project.get('auths', {})
    auths.personalDataCheck = enabled

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }

  /**
   * Update max sessions of a project.
   */
  async updateMaxSessions(id: string, limit: number) {
    let project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const auths = project.get('auths', {})
    auths.maxSessions = limit

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }

  /**
   * Update mock numbers of a project.
   */
  async updateMockNumbers(id: string, input: AuthMockNumbersDTO) {
    let project = await this.db.getDocument('projects', id)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const uniqueNumbers: { [key: string]: string } = {}
    input.numbers.forEach(number => {
      if (uniqueNumbers[number.phone]) {
        throw new Exception(
          Exception.GENERAL_BAD_REQUEST,
          'Duplicate phone numbers are not allowed.',
        )
      }
      uniqueNumbers[number.phone] = number.otp
    })

    const auths = project.get('auths', {})
    auths.mockNumbers = input.numbers

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }

  async updateMembershipsPrivacy(
    projectId: string,
    input: AuthMembershipPrivacyDTO,
  ) {
    let project = await this.db.getDocument('projects', projectId)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const auths = project.get('auths', {})

    if (input.userName !== undefined) {
      auths.membershipsUserName = input.userName
    }
    if (input.userEmail !== undefined) {
      auths.membershipsUserEmail = input.userEmail
    }
    if (input.mfa !== undefined) {
      auths.membershipsMfa = input.mfa
    }

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    )

    return project
  }
}
