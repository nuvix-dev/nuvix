/**
 * Platform projects worker — finalizes background tenant provisioning.
 *
 * `ProjectService.create` reserves the container (fast) and enqueues a
 * `PROJECTS` job with the project id; THIS worker runs the slow tail —
 * readiness wait + `auth` schema bootstrap — and flips the record to
 * `active` (or `error` on the final attempt). Idempotent: already-final
 * statuses are skipped (manual retries race safely).
 *
 * The platform DB + provisioner are composed lazily per worker thread;
 * tests override the boundary via `setProjectProvisioner`.
 */

import type { ProjectJobData } from '@nuvix/core/queues'
import type { Job } from 'bullmq'

export interface ProjectProvisioningBoundary {
  finalize(projectId: string): Promise<unknown>
}

let boundary: ProjectProvisioningBoundary | undefined

/** Overrides the provisioning boundary (tests). */
export function setProjectProvisioning(custom: ProjectProvisioningBoundary): void {
  boundary = custom
}

/** Memoized default boundary: platform DB + Docker provisioner + service. */
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
    // Optional in environments where the key is not yet set.
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
      // Let BullMQ retry (exponential backoff); status stays `provisioning`.
      throw error
    }
    // Final failure already recorded `status: "error"` by the service.
    console.error(
      `[projects] provisioning failed permanently for ${projectId}:`,
      error instanceof Error ? error.message : error,
    )
    return { success: false, status: 'error' }
  }
}
