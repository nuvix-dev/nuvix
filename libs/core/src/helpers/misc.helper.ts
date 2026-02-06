import { Database, Query } from '@nuvix/db'
import { MessageType } from '@nuvix/utils'
import type { TargetsDoc } from '@nuvix/utils/types'

export async function deleteTargets(
  database: Database,
  query: Query,
): Promise<void> {
  await database.deleteDocumentsBatch(
    'targets',
    [query, Query.orderAsc()],
    Database.DELETE_BATCH_SIZE,
    target => deleteSubscribers(database, target),
  )
}

export async function deleteSubscribers(
  database: Database,
  target: TargetsDoc,
): Promise<void> {
  await database.deleteDocumentsBatch(
    'subscribers',
    [Query.equal('targetInternalId', [target.getSequence()]), Query.orderAsc()],
    Database.DELETE_BATCH_SIZE,
    async subscriber => {
      const topicId = subscriber.get('topicId')
      const topicInternalId = subscriber.get('topicInternalId')
      const topic = await database.getDocument('topics', topicId)

      if (!topic.empty() && topic.getSequence() === topicInternalId) {
        const providerType = target.get('providerType')
        let totalAttribute: string

        switch (providerType as MessageType) {
          case MessageType.EMAIL:
            totalAttribute = 'emailTotal'
            break
          case MessageType.SMS:
            totalAttribute = 'smsTotal'
            break
          case MessageType.PUSH:
            totalAttribute = 'pushTotal'
            break
          default:
            throw new Error('Invalid target provider type')
        }

        await database.decreaseDocumentAttribute(
          'topics',
          topicId,
          totalAttribute,
          undefined,
          0,
        )
      }
    },
  )
}

export async function deleteIdentities(
  database: Database,
  query: Query,
): Promise<void> {
  await database.deleteDocumentsBatch(
    'identities',
    [query, Query.orderAsc()],
    Database.DELETE_BATCH_SIZE,
  )
}
