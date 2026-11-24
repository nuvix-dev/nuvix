/** Owns project authentication policy updates while preserving the rest of each project's stored settings. */
import { NotFoundError } from '@nuvix/core/errors'
import type { Database } from '@nuvix/db'

/** Phone mock number used by the SMS/phone development template. */
export interface MockNumber {
  phone: string
  otp: string
}

/** Membership privacy switches (names/emails/MFA status visible to other members). */
export interface MembershipsPrivacyInput {
  userName?: boolean
  userEmail?: boolean
  mfa?: boolean
}

/** The `projects.auths` record shape: session policy, password policy, and privacy switches. */
export interface ProjectAuthSettings {
  sessionAlerts?: boolean
  limit?: number
  duration?: number
  passwordHistory?: number
  passwordDictionary?: boolean
  personalDataCheck?: boolean
  maxSessions?: number
  mockNumbers?: MockNumber[]
  membershipsUserName?: boolean
  membershipsUserEmail?: boolean
  membershipsMfa?: boolean
  [method: string]: unknown
}

/** Reads and updates the project-scoped authentication policy used by tenant services. */
export class AuthSettingsService {
  constructor(private readonly db: Database) {}

  // Project metadata is resolved through the trusted platform database boundary, not through a tenant connection.
  private async getProject(projectId: string) {
    const session = this.db.system()
    const project = await session.getDocument('projects', projectId)
    if (project.empty()) {
      throw new NotFoundError('Project not found', {
        code: 'project_not_found',
      })
    }
    return project
  }

  private async updateAuths(
    projectId: string,
    updater: (auths: Record<string, unknown>) => void,
  ): Promise<Record<string, unknown>> {
    const project = await this.getProject(projectId)
    const session = this.db.system()

    // Mutate the existing record rather than replacing it so independent auth options remain intact.
    const auths = (project.get('auths') as Record<string, unknown>) ?? {}
    updater(auths)

    project.set('auths', auths)
    await session.updateDocument('projects', projectId, project)
    return auths
  }

  /** Return the whole `auths` record. */
  async getAuthSettings(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.getProject(projectId)
    return (project.get('auths') as Record<string, unknown>) ?? {}
  }

  async updateSessionAlerts(projectId: string, alerts: boolean) {
    return this.updateAuths(projectId, (auths) => {
      auths.sessionAlerts = alerts
    })
  }

  async updateAuthLimit(projectId: string, limit: number) {
    return this.updateAuths(projectId, (auths) => {
      auths.limit = limit
    })
  }

  async updateSessionDuration(projectId: string, duration: number) {
    return this.updateAuths(projectId, (auths) => {
      auths.duration = duration
    })
  }

  async updatePasswordHistory(projectId: string, limit: number) {
    return this.updateAuths(projectId, (auths) => {
      auths.passwordHistory = limit
    })
  }

  async updatePasswordDictionary(projectId: string, enabled: boolean) {
    return this.updateAuths(projectId, (auths) => {
      auths.passwordDictionary = enabled
    })
  }

  async updatePersonalData(projectId: string, enabled: boolean) {
    return this.updateAuths(projectId, (auths) => {
      auths.personalDataCheck = enabled
    })
  }

  async updateMaxSessions(projectId: string, limit: number) {
    return this.updateAuths(projectId, (auths) => {
      auths.maxSessions = limit
    })
  }

  async updateMockNumbers(projectId: string, numbers: MockNumber[]) {
    return this.updateAuths(projectId, (auths) => {
      auths.mockNumbers = numbers
    })
  }

  async updateMembershipsPrivacy(projectId: string, privacy: MembershipsPrivacyInput) {
    return this.updateAuths(projectId, (auths) => {
      if (privacy.userName !== undefined) auths.membershipsUserName = privacy.userName
      if (privacy.userEmail !== undefined) auths.membershipsUserEmail = privacy.userEmail
      if (privacy.mfa !== undefined) auths.membershipsMfa = privacy.mfa
    })
  }

  async updateAuthMethod(projectId: string, method: string, status: boolean) {
    return this.updateAuths(projectId, (auths) => {
      auths[method] = status
    })
  }
}
