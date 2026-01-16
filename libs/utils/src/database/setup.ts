import { Logger } from '@nestjs/common'
import { Database, Doc, DuplicateException, type Collection } from '@nuvix/db'
import { Schemas } from '@nuvix/utils'
import { Exception } from '@nuvix/core/extend/exception'
import { Audit } from '@nuvix/audit'
import collections from '@nuvix/utils/collections'
import { CoreService } from '@nuvix/core'

const logger = new Logger('Database Setup')

export interface DatabaseSetupOptions {
  coreService: CoreService
  projectId: string
}

export interface SetupResult {
  success: boolean
  schemas: string[]
  collections: {
    auth: number
    core: number
  }
}

/**
 * Sets up database schemas and collections for a project
 * @param pool - Database pool/client connection
 * @param options - Setup configuration options
 * @returns Setup result with status and counts
 */
export async function setupDatabase({
  coreService,
  projectId,
}: DatabaseSetupOptions): Promise<SetupResult> {
  try {
    const pool = coreService.createMainPool()
    const coreSchema = coreService.getProjectDb(pool, {
      projectId,
      schema: Schemas.Core,
    })

    await createSchemaIfNotExists(coreSchema, Schemas.Core)

    // Create auth schema
    const authSchema = coreService.getProjectDb(pool, {
      projectId,
      schema: Schemas.Auth,
    })

    await createSchemaIfNotExists(authSchema, Schemas.Auth)

    // Setup collections
    const authCollectionEntries = Object.entries(collections.auth) ?? []
    const coreCollectionEntries = Object.entries(collections.project) ?? []

    const authCount = await setupCollections(
      authSchema,
      authCollectionEntries,
      projectId,
    )
    const coreCount = await setupCollections(
      coreSchema,
      coreCollectionEntries,
      projectId,
    )

    // Setup audit
    await setupAudit(coreSchema)

    logger.log(`Database setup completed for project ${projectId}`)

    return {
      success: true,
      schemas: [Schemas.Core, Schemas.Auth],
      collections: {
        auth: authCount,
        core: coreCount,
      },
    }
  } catch (error: any) {
    logger.error(
      `Failed to setup database for project ${projectId}: ${error.message}`,
    )
    throw new Exception(`Database setup failed: ${error.message}`)
  }
}

/**
 * Creates a database schema if it doesn't exist
 */
async function createSchemaIfNotExists(
  db: Database,
  schemaName: string,
): Promise<void> {
  try {
    await db.create(schemaName)
    logger.log(`Schema ${schemaName} created`)
  } catch (error) {
    if (error instanceof DuplicateException) {
      logger.debug(`Schema ${schemaName} already exists`)
    } else {
      throw error
    }
  }
}

/**
 * Sets up collections in a schema with retry logic
 */
async function setupCollections(
  db: Database,
  collectionEntries: [string, Collection][],
  projectId: string,
): Promise<number> {
  const MAX_RETRIES = 3
  const BASE_DELAY_MS = 200
  let successCount = 0

  logger.log(
    `Setting up ${collectionEntries.length} collections in schema ${db.schema} for project ${projectId}`,
  )

  for (const [_, collection] of collectionEntries) {
    if (collection['$collection'] !== Database.METADATA) {
      continue
    }

    const collectionId = collection.$id
    const attributes = (collection['attributes'] || []).map(
      attr => new Doc(attr),
    )
    const indexes = (collection['indexes'] || []).map(idx => new Doc(idx))

    let lastError: any = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await db.createCollection({
          id: collectionId,
          attributes,
          indexes,
        })

        successCount++
        lastError = null
        logger.debug(
          `Collection ${collectionId} created in schema ${db.schema}`,
        )
        break
      } catch (error: any) {
        lastError = error

        // Idempotent: treat duplicates as success
        if (error instanceof DuplicateException) {
          logger.debug(
            `Collection ${collectionId} already exists in schema ${db.schema}`,
          )
          successCount++
          lastError = null
          break
        }

        // Retry with exponential backoff
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
          logger.warn(
            `Attempt ${attempt}/${MAX_RETRIES} failed for collection ${collectionId}. Retrying in ${delay}ms...`,
          )
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          logger.error(
            `Failed to create collection ${collectionId} after ${MAX_RETRIES} attempts: ${error.message}`,
          )
        }
      }
    }

    if (lastError) {
      throw new Exception(
        `Failed to create collection ${collectionId}: ${lastError.message}`,
      )
    }
  }

  logger.log(
    `Successfully set up ${successCount} collections in schema ${db.schema}`,
  )
  return successCount
}

/**
 * Sets up audit functionality
 */
async function setupAudit(db: Database): Promise<void> {
  try {
    await new Audit(db).setup()
    logger.log('Audit setup completed')
  } catch (error) {
    if (error instanceof DuplicateException) {
      logger.debug('Audit already configured')
    } else {
      throw error
    }
  }
}
