import { beforeAll, describe, expect, it } from 'bun:test'
import processProject, { setProjectProvisioning } from './projects.processor'

const finalized: string[] = []
const failures: string[] = []

beforeAll(() => {
  setProjectProvisioning({
    finalize: async (projectId) => {
      if (failures.includes(projectId)) {
        throw new Error('bootstrap down')
      }
      finalized.push(projectId)
      return { status: 'active' }
    },
  })
})

function job(projectId: string, attempts = 3, attemptsMade = 0) {
  return {
    data: { projectId },
    opts: { attempts },
    attemptsMade,
  } as never
}

describe('projects.processor (background provisioning)', () => {
  it('finalizes a provisioning project', async () => {
    const result = await processProject(job('proj_ok'))
    expect(result.success).toBe(true)
    expect(result.status).toBe('active')
    expect(finalized).toContain('proj_ok')
  })

  it('rethrows on non-final attempts so BullMQ retries', async () => {
    failures.push('proj_retry')
    await expect(processProject(job('proj_retry', 3, 0))).rejects.toThrow('bootstrap down')
    // attemptsMade 1 of 3 → still retrying.
    await expect(processProject(job('proj_retry', 3, 1))).rejects.toThrow('bootstrap down')
  })

  it('reports failure without throwing on the final attempt', async () => {
    // The service already recorded status 'error'; the worker surfaces it.
    const result = await processProject(job('proj_retry', 3, 3))
    expect(result.success).toBe(false)
    expect(result.status).toBe('error')
  })
})
