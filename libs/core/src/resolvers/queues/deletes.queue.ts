import { Processor } from '@nestjs/bullmq'
import { Queue } from './queue'
import {
  configuration,
  DeleteDocumentType,
  DeleteType,
  QueueFor,
  Schemas,
} from '@nuvix/utils'
import { Job } from 'bullmq'
import { Database, Doc, IEntity, Query } from '@nuvix/db'
import type {
  Memberships,
  ProjectsDoc,
  Schedules,
  TopicsDoc,
  UsersDoc,
} from '@nuvix/utils/types'
import { CoreService } from '@nuvix/core/core.service'
import {
  deleteIdentities,
  deleteSubscribers,
  deleteTargets,
} from '@nuvix/core/helper/misc.helper'
import { Auth } from '@nuvix/core/helper'
import { Audit } from '@nuvix/audit'
import { Logger } from '@nestjs/common'

@Processor(QueueFor.DELETES, { concurrency: 1000 })
export class DeletesQueue extends Queue {
  private readonly dbForPlatform: Database
  private readonly logger = new Logger(DeletesQueue.name)

  constructor(private readonly coreService: CoreService) {
    super()
    this.dbForPlatform = this.coreService.getPlatformDb()
  }

  override async process(
    job: Job<DeletesJobData, unknown, DeleteType>,
  ): Promise<any> {
    const document = new Doc(job.data.document) as Doc<any>
    const { datetime, hourlyUsageRetentionDatetime, resource, resourceType } =
      job.data
    let project: ProjectsDoc = new Doc(
      job.data.project,
    ) as unknown as ProjectsDoc

    switch (job.name) {
      case DeleteType.DOCUMENT:
        switch (document.getCollection() as DeleteDocumentType) {
          case DeleteDocumentType.PROJECTS:
            // TODO: Implement deleteProject with devices and certificates
            this.logger.warn('Project deletion not fully implemented')
            break
          case DeleteDocumentType.FUNCTIONS:
            // TODO: Implement deleteFunction
            this.logger.warn('Function deletion not fully implemented')
            break
          case DeleteDocumentType.DEPLOYMENTS:
            // TODO: Implement deleteDeployment
            this.logger.warn('Deployment deletion not fully implemented')
            break
          case DeleteDocumentType.USERS:
            await this.deleteUser(project, document as UsersDoc)
            break
          case DeleteDocumentType.BUCKETS:
            // TODO: Implement deleteBucket
            this.logger.warn('Bucket deletion not fully implemented')
            break
          case DeleteDocumentType.INSTALLATIONS:
            // TODO: Implement deleteInstallation
            this.logger.warn('Installation deletion not fully implemented')
            break
          case DeleteDocumentType.RULES:
            // TODO: Implement deleteRule with certificates
            this.logger.warn('Rule deletion not fully implemented')
            break
          default:
            this.logger.error(
              'No lazy delete operation available for document of type: ' +
                document.getCollection(),
            )
            break
        }
        break
      case DeleteType.TEAM_PROJECTS:
        await this.deleteProjectsByTeam(document)
        break
      // case DeleteType.EXECUTIONS:
      //    break
      case DeleteType.AUDIT:
        await this.deleteAuditLogs(project, datetime!)
        break
      // case DeleteType.REALTIME:
      //     break
      case DeleteType.SESSIONS:
        await this.deleteExpiredSessions(project)
        break
      case DeleteType.USAGE:
        await this.deleteUsageStats(project, hourlyUsageRetentionDatetime!)
        break
      case DeleteType.SCHEDULES:
        await this.deleteSchedules(datetime!)
        break
      case DeleteType.TOPIC:
        await this.deleteTopic(project, document as TopicsDoc)
        break
      case DeleteType.TARGET:
        await this.withDatabase(project, db => {
          return deleteSubscribers(db, document)
        })
        break
      case DeleteType.EXPIRED_TARGETS:
        await this.deleteExpiredTargets(project)
        break
      case DeleteType.SESSION_TARGETS:
        await this.deleteSessionTargets(project, document)
        break
      default:
        throw new Error('No delete operation for type: ' + job.name)
    }
  }

  /**
   * Delete schedules which are inactive and their resource is deleted or updated before given datetime
   */
  private async deleteSchedules(datetime: string): Promise<void> {
    const regions = [configuration.app.region || 'default']

    await this.listByGroup<Schedules>(
      'schedules',
      [
        Query.equal('region', regions),
        Query.lessThanEqual('resourceUpdatedAt', datetime),
        Query.equal('active', [false]),
      ],
      this.dbForPlatform,
      async document => {
        const project = await this.dbForPlatform.getDocument(
          'projects',
          document.get('projectId'),
        )

        if (project.empty()) {
          await this.dbForPlatform.deleteDocument('schedules', document.getId())
          this.logger.log(
            'Deleted schedule for deleted project ' + document.get('projectId'),
          )
          return
        }

        let collectionId: string
        switch (document.get('resourceType')) {
          case 'function':
            collectionId = 'functions'
            break
          case 'execution':
            collectionId = 'executions'
            break
          case 'message':
            collectionId = 'messages'
            break
          default:
            return
        }

        let resource: Doc
        try {
          resource = await this.withDatabase(project, db => {
            return db.getDocument(collectionId, document.get('resourceId'))
          })
        } catch (e: any) {
          this.logger.error(
            'Failed to get resource for schedule ' +
              document.getId() +
              ' ' +
              e.message,
          )
          return
        }

        let shouldDelete = true

        switch (document.get('resourceType')) {
          case 'function':
            shouldDelete = resource.empty()
            break
          case 'execution':
            shouldDelete = false
            break
        }

        if (shouldDelete) {
          await this.dbForPlatform.deleteDocument('schedules', document.getId())
          this.logger.log(
            'Deleting schedule for ' +
              document.get('resourceType') +
              ' ' +
              document.get('resourceId'),
          )
        }
      },
    )
  }

  /**
   * Delete topic and its subscribers
   */
  private async deleteTopic(
    project: ProjectsDoc,
    topic: TopicsDoc,
  ): Promise<void> {
    if (topic.empty()) {
      this.logger.error('Failed to delete subscribers. Topic not found')
      return
    }

    await this.withDatabase(project, db => {
      return this.deleteByGroup(
        'subscribers',
        [
          Query.equal('topicInternalId', [topic.getSequence()]),
          Query.orderAsc(),
        ],
        db,
      ).catch((e: any) => {
        this.logger.error('Failed to delete subscribers: ' + e.message)
      })
    })
  }

  /**
   * Delete expired targets
   */
  private async deleteExpiredTargets(project: ProjectsDoc): Promise<void> {
    await this.withDatabase(
      project,
      db => {
        return deleteTargets(db, Query.equal('expired', [true]))
      },
      Schemas.Auth,
    )
  }

  /**
   * Delete session targets
   */
  private async deleteSessionTargets(
    project: ProjectsDoc,
    session: Doc,
  ): Promise<void> {
    await this.withDatabase(
      project,
      db => {
        return deleteTargets(
          db,
          Query.equal('sessionInternalId', [session.getSequence()]),
        )
      },
      Schemas.Auth,
    )
  }

  /**
   * Delete usage stats from project database
   */
  private async deleteUsageStats(
    project: ProjectsDoc,
    hourlyUsageRetentionDatetime: string,
  ): Promise<void> {
    await this.withDatabase(project, async db => {
      await this.deleteByGroup(
        'stats',
        [
          Query.equal('period', ['1h']),
          Query.lessThan('time', hourlyUsageRetentionDatetime),
          Query.orderDesc('time'),
          Query.orderDesc(),
        ],
        db,
      )
    })
  }

  /**
   * Delete memberships for a team
   */
  private async deleteMemberships(
    project: ProjectsDoc,
    team: Doc,
  ): Promise<void> {
    const teamInternalId = team.getSequence()

    await this.withDatabase(
      project,
      db => {
        return this.deleteByGroup<Memberships>(
          'memberships',
          [Query.equal('teamInternalId', [teamInternalId]), Query.orderAsc()],
          db,
          async membership => {
            const userId = membership.get('userId')
            await db.purgeCachedDocument('users', userId)
          },
        )
      },
      Schemas.Auth,
    )
  }

  /**
   * Delete projects by team
   */
  private async deleteProjectsByTeam(team: Doc): Promise<void> {
    const projects = await this.dbForPlatform.find<ProjectsDoc>('projects', [
      Query.equal('teamInternalId', [team.getSequence()]),
      Query.equal('region', [configuration.app.region || 'default']),
    ])

    for (const project of projects) {
      // TODO: Implement device cleanup and project deletion
      // This would require access to storage devices and certificates
      await this.dbForPlatform.deleteDocument('projects', project.getId())
    }
  }

  /**
   * Delete user and associated data
   */
  private async deleteUser(
    project: ProjectsDoc,
    user: UsersDoc,
  ): Promise<void> {
    const userId = user.getId()
    const userInternalId = user.getSequence()

    await this.withDatabase(
      project,
      async db => {
        // Delete all sessions of this user from the sessions table
        await this.deleteByGroup(
          'sessions',
          [Query.equal('userInternalId', [userInternalId]), Query.orderAsc()],
          db,
        )

        await db.purgeCachedDocument('users', userId)

        // Delete Memberships and decrement team membership counts
        await this.deleteByGroup<Memberships>(
          'memberships',
          [Query.equal('userInternalId', [userInternalId]), Query.orderAsc()],
          db,
          async membership => {
            if (membership.get('confirm')) {
              // Count only confirmed members
              const teamId = membership.get('teamId')
              const team = await db.getDocument('teams', teamId)
              if (!team.empty()) {
                await db.decreaseDocumentAttribute(
                  'teams',
                  teamId,
                  'total',
                  1,
                  0,
                )
              }
            }
          },
        )

        // Delete tokens
        await this.deleteByGroup(
          'tokens',
          [Query.equal('userInternalId', [userInternalId]), Query.orderAsc()],
          db,
        )

        // Delete identities
        await deleteIdentities(
          db,
          Query.equal('userInternalId', [userInternalId]),
        )

        // Delete targets
        await deleteTargets(db, Query.equal('userInternalId', [userInternalId]))
      },
      Schemas.Auth,
    )
  }

  /**
   * Delete expired sessions based on project auth duration
   */
  private async deleteExpiredSessions(project: ProjectsDoc): Promise<void> {
    await this.withDatabase(
      project,
      async db => {
        const duration =
          project.get('auths')?.['duration'] ?? Auth.TOKEN_EXPIRATION_LOGIN_LONG
        const expired = new Date(Date.now() - duration * 1000).toISOString()

        await this.deleteByGroup(
          'sessions',
          [
            Query.lessThan('$createdAt', expired),
            Query.orderDesc('$createdAt'),
            Query.orderDesc(),
          ],
          db,
        )
      },
      Schemas.Auth,
    )
  }

  /**
   * Delete audit logs older than the retention period
   */
  private async deleteAuditLogs(
    project: ProjectsDoc,
    auditRetention: string,
  ): Promise<void> {
    const projectId = project.getId()

    await this.withDatabase(project, async db => {
      try {
        await this.deleteByGroup(
          Audit.COLLECTION,
          [
            Query.lessThan('time', auditRetention),
            Query.orderDesc('time'),
            Query.orderAsc(),
          ],
          db,
        )
      } catch (error: any) {
        this.logger.error(
          `Failed to delete audit logs for project ${projectId}: ${error.message}`,
        )
      }
    })
  }

  private async withDatabase<T>(
    project: ProjectsDoc,
    callback: (db: Database) => Promise<T>,
    schema = Schemas.Core,
  ) {
    let _client: any
    try {
      const { dbForProject, client } =
        await this.coreService.createProjectDatabase(project, {
          schema,
        })
      _client = client
      return callback(dbForProject)
    } finally {
      await this.coreService.releaseDatabaseClient(_client)
    }
  }

  protected async deleteByGroup<T extends IEntity>(
    collection: string,
    queries: Query[],
    database: Database,
    callback?: (doc: Doc<T>) => void | Promise<void>,
  ): Promise<void> {
    const start = Date.now()
    const batch_limit = 500 // TODO: --------------

    try {
      const count = await database.deleteDocumentsBatch(
        collection,
        queries,
        batch_limit,
        callback,
      )

      const end = Date.now()
      this.logger.log(
        `Deleted ${count} documents by group in ${(end - start) / 1000} seconds`,
      )
    } catch (error: any) {
      this.logger.error(
        `Failed to delete documents for collection:${database.namespace}_${collection} :${error.message}`,
      )
    }
  }

  protected async listByGroup<T extends IEntity>(
    collection: string,
    queries: Query[],
    database: Database,
    callback?: (doc: Doc<T>) => void | Promise<void>,
  ): Promise<void> {
    let count = 0
    const limit = 1000
    let sum = limit
    let cursor: Doc<T> | null = null

    const start = Date.now()

    while (sum === limit) {
      const paginatedQueries = [...queries, Query.limit(limit)]

      if (cursor !== null) {
        paginatedQueries.push(Query.cursorAfter(cursor))
      }

      const results = await database.find<T>(collection, paginatedQueries)

      sum = results.length

      if (sum > 0) {
        cursor = results[sum - 1] as Doc<T>
      }

      for (const document of results) {
        if (callback) {
          await callback(document)
        }
        count++
      }
    }

    const end = Date.now()

    this.logger.log(
      `Listed ${count} documents by group in ${(end - start) / 1000} seconds`,
    )
  }
}

export type DeletesJobData = {
  datetime?: string
  document?: Doc<any>
  hourlyUsageRetentionDatetime?: string
  resource?: string
  resourceType?: string
  project: ProjectsDoc
}
