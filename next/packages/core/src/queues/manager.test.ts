import { describe, expect, it } from 'bun:test'
import { QueueFor } from '@nuvix/utils'
import { createQueueManager } from './manager'

describe('QueueManager', () => {
  it('buffers jobs in memory in test mode without requiring Redis', async () => {
    const manager = createQueueManager({ isTest: true })

    const mailJobId = await manager.enqueueMail({
      to: 'alice@example.com',
      subject: 'Welcome',
      body: 'Hello Alice',
    })
    expect(mailJobId).toMatch(/^job_/)

    const auditJobId = await manager.enqueueAudit({
      event: 'users.create',
      userId: 'u_1',
      resource: 'users',
    })
    expect(auditJobId).toMatch(/^job_/)

    const webhookJobId = await manager.enqueueWebhook({
      webhookId: 'hook_1',
      projectId: 'proj_1',
      event: 'users.create',
      payload: { id: 'u_1' },
      url: 'https://example.com/webhook',
    })
    expect(webhookJobId).toMatch(/^job_/)

    const deleteJobId = await manager.enqueueDelete({
      type: 'document',
      resourceId: 'doc_1',
      projectId: 'proj_1',
      cascade: true,
    })
    expect(deleteJobId).toMatch(/^job_/)

    const logJobId = await manager.enqueueLog({
      projectId: 'proj_1',
      method: 'GET',
      path: '/v2/health',
      statusCode: 200,
      durationMs: 5,
    })
    expect(logJobId).toMatch(/^job_/)

    const messagingJobId = await manager.enqueueMessaging({
      provider: 'smtp',
      to: 'bob@example.com',
      message: 'Hello Bob',
    })
    expect(messagingJobId).toMatch(/^job_/)

    const statsJobId = await manager.enqueueStats({
      metric: 'requests.count',
      value: 1,
      projectId: 'proj_1',
    })
    expect(statsJobId).toMatch(/^job_/)

    const batchJobId = await manager.enqueueBatch({
      operations: [{ action: 'insert' }],
      projectId: 'proj_1',
    })
    expect(batchJobId).toMatch(/^job_/)

    // Inspect buffered jobs
    const mailJobs = manager.getInMemoryJobs(QueueFor.MAILS)
    expect(mailJobs.length).toBe(1)
    expect(mailJobs[0]?.data).toEqual({
      to: 'alice@example.com',
      subject: 'Welcome',
      body: 'Hello Alice',
    })

    const webhookJobs = manager.getInMemoryJobs(QueueFor.WEBHOOKS)
    expect(webhookJobs.length).toBe(1)
    expect(webhookJobs[0]?.data).toEqual({
      webhookId: 'hook_1',
      projectId: 'proj_1',
      event: 'users.create',
      payload: { id: 'u_1' },
      url: 'https://example.com/webhook',
    })

    await manager.close()
  })
})
