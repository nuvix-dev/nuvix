import { Logger } from '@nestjs/common'
import {
  Database,
  Doc,
  Permission,
  Role,
  DuplicateException,
  Authorization,
  ID,
} from '@nuvix/db'
import collections from '@nuvix/utils/collections'
import { Audit } from '@nuvix/audit'
import { AppConfigService, CoreService } from '@nuvix/core'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Schemas } from '@nuvix/utils'
import { Auth } from '@nuvix/core/helpers'
import type { Projects, Teams } from '@nuvix/utils/types'
import { Exception } from '@nuvix/core/extend/exception'
import { oAuthProviders, OAuthProviderType } from '@nuvix/core/config'
import { authMethods, defaultSmtpConfig, services } from '@nuvix/core/config'
import { setupDatabase } from '@nuvix/utils/database'
import { loadAuthConfig } from '../../../platform/src/projects/projects.service'

export async function dbSetup(
  app: NestFastifyApplication,
  config: AppConfigService,
) {
  const logger = new Logger('Setup')
  const coreService = app.get(CoreService)
  try {
    logger.log('🚀 Initializing Nuvix Test setup...')
    const pool = coreService.createProjectDbClient('initial-setup')
    await pool
      .query(`create schema if not exists ${Schemas.Internal};`)
      .catch(e =>
        logger.error('❌ Failed to create internal database schema', e),
      )
      .finally(() => pool.end())

    const db = coreService.getPlatformDb()

    try {
      await db.getCache().flush()
      await db.create()
      logger.log('✓ Platform database initialized successfully')
    } catch (e) {
      if (!(e instanceof DuplicateException)) throw e
      logger.log('✓ Platform database already exists')
    }

    logger.log('📦 Setting up collections and resources...')
    await Authorization.skip(async () => {
      const internalCollections = collections.internal
      for (const [_, collection] of Object.entries(internalCollections)) {
        if (collection.$collection !== Database.METADATA) {
          continue
        }
        if (await db.exists(db.schema, collection.$id)) {
          continue
        }

        logger.log(`  ➜ Creating collection: ${collection.$id}`)

        const attributes = collection.attributes.map(
          attribute => new Doc(attribute),
        )

        const indexes = (collection.indexes ?? []).map(index => new Doc(index))

        await db.createCollection({
          id: collection.$id,
          attributes,
          indexes,
          permissions: [Permission.create(Role.any())],
          documentSecurity: true,
        })
      }

      const defaultBucket = await db.getDocument('buckets', 'default')
      if (defaultBucket.empty() && !(await db.exists(db.schema, 'bucket_1'))) {
        logger.log('📁 Creating default storage bucket...')

        await db.createDocument(
          'buckets',
          new Doc({
            $id: 'default',
            $collection: 'buckets',
            name: 'Default',
            maximumFileSize: 10 * 1024 * 1024, // 10MB
            allowedFileExtensions: [],
            enabled: true,
            compression: 'gzip',
            encryption: true,
            antivirus: true,
            fileSecurity: true,
            $permissions: [
              Permission.read(Role.any()),
              Permission.create(Role.any()),
              Permission.update(Role.any()),
              Permission.delete(Role.any()),
            ],
            search: 'buckets Default',
          }),
        )

        const bucket = await db.getDocument('buckets', 'default')
        logger.log('  ➜ Creating files collection for default bucket')

        const files = collections.bucket['files']
        if (!files) {
          throw new Error('Files collection is not configured.')
        }

        const fileAttributes = files.attributes.map(
          attribute => new Doc(attribute),
        )

        const fileIndexes = files.indexes?.map(index => new Doc(index))

        await db.createCollection({
          id: `bucket_${bucket.getSequence()}`,
          attributes: fileAttributes,
          indexes: fileIndexes,
        })
      }
      if (!(await db.exists(db.schema, Audit.COLLECTION))) {
        logger.log('📋 Setting up audit logging system')
        await new Audit(db).setup()
      }

      const hasSuperUser = await db.findOne('users')
      if (!hasSuperUser.empty()) {
        logger.log('✓ Admin user already exists, skipping creation')
      } else {
        const adminEmail = process.env['NUVIX_ADMIN_EMAIL']
        const adminPassword = process.env['NUVIX_ADMIN_PASSWORD']

        if (!adminEmail || !adminPassword) {
          throw new Error(
            '❌ NUVIX_ADMIN_EMAIL and NUVIX_ADMIN_PASSWORD environment variables are required for initial setup',
          )
        }

        logger.log(`👤 Creating admin user with email: ${adminEmail}`)
        const hashedPassword =
          (await Auth.passwordHash(
            adminPassword,
            Auth.DEFAULT_ALGO,
            Auth.DEFAULT_ALGO_OPTIONS,
          )) ?? undefined

        const userId = ID.unique()
        const user = new Doc({
          $id: userId,
          $permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ],
          email: adminEmail,
          emailVerification: true,
          status: true,
          password: hashedPassword,
          passwordHistory: [],
          passwordUpdate: new Date(),
          hash: Auth.DEFAULT_ALGO,
          hashOptions: Auth.DEFAULT_ALGO_OPTIONS,
          registration: new Date(),
          reset: false,
          name: 'Test Admin',
          mfa: false,
          prefs: {},
          search: `${userId} ${adminEmail}`,
          accessedAt: new Date(),
        })
        const adminUser = await Authorization.skip(() =>
          db.createDocument('users', user),
        )

        const teamId = ID.custom('my-team')
        const team = await db.createDocument(
          'teams',
          new Doc({
            $id: teamId,
            name: 'Test Team',
            total: 1,
            $permissions: [
              Permission.read(Role.user(adminUser.getId())),
              Permission.update(Role.user(adminUser.getId())),
              Permission.delete(Role.user(adminUser.getId())),
              Permission.read(Role.team(teamId)),
              Permission.update(Role.team(teamId)),
            ],
          }),
        )
        await db.createDocument(
          'memberships',
          new Doc({
            $id: ID.unique(),
            teamInternalId: team.getSequence(),
            teamId: teamId,
            userInternalId: adminUser.getSequence(),
            userId: adminUser.getId(),
            joined: new Date(),
            confirm: true,
            roles: ['owner'],
            $permissions: [
              Permission.read(Role.user(adminUser.getId())),
              Permission.update(Role.user(adminUser.getId())),
              Permission.read(Role.team(teamId)),
              Permission.update(Role.team(teamId)),
              Permission.delete(Role.team(teamId)),
            ],
          }),
        )

        const projectId = config.get('app').projectId
        await createProject({
          db,
          coreService,
          org: team,
          projectId,
          name: 'My Project',
          password: config.getDatabaseConfig().postgres.adminPassword || '',
          region: 'local',
        })
        logger.log(`✓ Default project created with ID: ${projectId}`)
      }

      logger.log('✅ Nuvix test setup completed successfully!')
      logger.log('🎉 Your test environment is ready to use')
      await db.getCache().flush()
    })
  } catch (error: any) {
    logger.error(`❌ Setup failed: ${error.message}`, error.stack)
    throw error
  }
}

async function createProject({
  db,
  org,
  coreService,
  projectId: _projectId,
  teamId,
  password,
  name,
  ...rest
}: {
  db: Database
  coreService: CoreService
  projectId: string
  org: Doc<Teams>
  password: string
  name: string
  [key: string]: any
}): Promise<Doc<Projects>> {
  const projectId = _projectId === 'unique()' ? ID.unique() : _projectId

  try {
    const auths = loadAuthConfig(authMethods)
    const defaultoAuthProviders: OAuthProviderType[] = []
    const defaultServices: Record<string, boolean> = {}

    Object.entries(oAuthProviders).forEach(([key, value]) => {
      if (value.enabled) {
        defaultoAuthProviders.push({
          key: key,
          name: value.name,
          appId: '',
          secret: '',
          enabled: false,
        })
      }
    })

    Object.values(services).forEach(value => {
      if (value.optional) {
        defaultServices[value.key] = true
      }
    })

    let project = new Doc<Projects>({
      ...rest,
      $id: projectId,
      $permissions: [
        Permission.read(Role.team(ID.custom(teamId))),
        Permission.update(Role.team(ID.custom(teamId), 'owner')),
        Permission.update(Role.team(ID.custom(teamId), 'developer')),
        Permission.delete(Role.team(ID.custom(teamId), 'owner')),
        Permission.delete(Role.team(ID.custom(teamId), 'developer')),
      ],
      teamId: org.getId(),
      teamInternalId: org.getSequence(),
      name: name,
      oAuthProviders: defaultoAuthProviders as any,
      smtp: defaultSmtpConfig as any,
      auths: auths,
      services: defaultServices,
      accessedAt: new Date(),
      environment: '',
      database: {
        postgres: {
          password,
        },
        pool: {
          password,
        },
      } as any,
      enabled: true,
      status: 'pending',
      metadata: {
        allowedSchemas: ['public'],
      },
    })

    project = await db.createDocument('projects', project)
    await setupDatabase({
      coreService: coreService,
      projectId: project.getId(),
    })

    return project
  } catch (error) {
    if (error instanceof DuplicateException) {
      throw new Exception(Exception.PROJECT_ALREADY_EXISTS)
    } else throw error
  }
}
