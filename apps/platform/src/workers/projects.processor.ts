/** Processes project jobs by finalizing tenant provisioning and mapping retry outcomes to worker results. */

import type { ProjectJobData } from '@nuvix/core/queues'
import type { Job } from 'bullmq'

export interface ProjectProvisioningBoundary {
  finalize(projectId: string): Promise<unknown>
}

let boundary: ProjectProvisioningBoundary | undefined

/** Replaces the provisioning boundary so tests can avoid constructing platform infrastructure. */
export function setProjectProvisioning(custom: ProjectProvisioningBoundary): void {
  boundary = custom
}

/** Lazily constructs and reuses the production platform database, provisioner, and service boundary. */
async function defaultBoundary(): Promise<ProjectProvisioningBoundary> {
  const { ProjectService } = await import('../modules/projects/service')
  const { DockerTenantProvisioner, decodeEncryptionKey } = await import('@nuvix/core/tenants')
  const { createPlatformDatabase } = await import('../registry/setup')
  const { config } = await import('@nuvix/utils')

  const db = await createPlatformDatabase()
  let encryptionKey: Uint8Array | undefined
  try {
    encryptionKey = decodeEncryptionKey(config.platform.tenantEncryptionKey)
  } catch {
    // Secret encryption remains optional for environments that do not configure a tenant key.
  }

  const provisioner = new DockerTenantProvisioner({
    image: config.platform.tenantPostgresImage,
  })
  const service = new ProjectService(db, provisioner, undefined, undefined, encryptionKey)
  return {
    finalize: (projectId: string) => service.provisionProject(projectId),
  }
}

async function getBoundary(): Promise<ProjectProvisioningBoundary> {
  if (!boundary) {
    boundary = await defaultBoundary()
  }
  return boundary
}

export default async function processProject(
  job: Job<ProjectJobData>,
): Promise<{ success: boolean; status?: string }> {
  const { projectId } = job.data
  const { finalize } = await getBoundary()

  try {
    const view = (await finalize(projectId)) as { status?: string }
    return { success: true, status: view?.status }
  } catch (error) {
    const attempts = job.opts.attempts ?? 1
    const isFinal = job.attemptsMade >= attempts
    if (!isFinal) {
      // Rethrow non-final failures so BullMQ applies its configured retry policy.
      throw error
    }
    // The service has already recorded the final provisioning error; report it without another retry.
    console.error(
      `[projects] provisioning failed permanently for ${projectId}:`,
      error instanceof Error ? error.message : error,
    )
    return { success: false, status: 'error' }
  }
}
