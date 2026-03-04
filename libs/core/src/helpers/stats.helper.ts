import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Database, Doc, Events } from '@nuvix/db'
import { MetricFor, QueueFor } from '@nuvix/utils'
import type { Queue } from 'bullmq'
import { StatsQueueJob, type StatsQueueOptions } from '../resolvers/queues'

@Injectable()
export class StatsHelper {
  constructor(
    @InjectQueue(QueueFor.STATS)
    private readonly statsQueue: Queue<
      StatsQueueOptions,
      unknown,
      StatsQueueJob
    >,
  ) {}

  connect(db: Database) {
    db.on(Events.DocumentCreate, 'calculate-usage', document =>
      this.usageDatabaseListener(Events.DocumentCreate, document),
    )
      .on(Events.DocumentDelete, 'calculate-usage', document =>
        this.usageDatabaseListener(Events.DocumentDelete, document),
      )
      .on(Events.DocumentsCreate, 'calculate-usage', documents =>
        this.usageDatabaseListener(
          Events.DocumentsCreate,
          new Doc({
            modified: documents.length,
          }),
        ),
      )
      .on(Events.DocumentsDelete, 'calculate-usage', documents =>
        this.usageDatabaseListener(
          Events.DocumentDelete,
          Array.isArray(documents)
            ? new Doc({
                modified: documents.length,
              })
            : documents,
        ),
      )
      .on(Events.DocumentsUpsert, 'calculate-usage', document =>
        this.usageDatabaseListener(Events.DocumentsUpsert, document),
      )
  }

  private async usageDatabaseListener(event: Events, document: Doc<any>) {
    const metrics: Array<{ key: MetricFor; value: number }> = []
    const reduce: Doc<any>[] = []

    let value = 1

    switch (event) {
      case Events.DocumentDelete:
        value = -1
        break
      case Events.DocumentsDelete:
        value = -1 * document.get('modified', 0)
        break
      case Events.DocumentsCreate:
        value = document.get('modified', 0)
        break
      case Events.DocumentsUpsert:
        value = document.get('created', 0)
        break
    }
    const collection = document.getCollection()

    switch (true) {
      case collection === 'teams':
        metrics.push({ key: MetricFor.TEAMS, value })
        break
      case collection === 'users':
        metrics.push({ key: MetricFor.USERS, value })
        if (event === Events.DocumentDelete) {
          reduce.push(document)
        }
        break
      case collection === 'sessions':
        metrics.push({ key: MetricFor.SESSIONS, value })
        break
      case collection === 'buckets':
        metrics.push({ key: MetricFor.BUCKETS, value })
        if (event === Events.DocumentDelete) {
          reduce.push(document)
        }
        break
      case collection.startsWith('bucket_'): {
        const bucketParts = collection.split('_')
        const bucketInternalId = bucketParts[1]

        metrics.push({ key: MetricFor.FILES, value })
        metrics.push({
          key: MetricFor.FILES_STORAGE,
          value: document.get('sizeOriginal') * value,
        })
        metrics.push({
          key: `${bucketInternalId}.files` as MetricFor.BUCKET_ID_FILES,
          value,
        })
        metrics.push({
          key: `${bucketInternalId}.files.storage` as MetricFor.BUCKET_ID_FILES_STORAGE,
          value: document.get('sizeOriginal') * value,
        })
        break
      }
      default:
        break
    }

    await this.statsQueue.add(StatsQueueJob.ADD_METRIC, {
      metrics,
      reduce,
    })
  }
}
