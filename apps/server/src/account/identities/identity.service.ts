import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { Database, Query } from '@nuvix/db'
import { configuration } from '@nuvix/utils'
import type { IdentitiesDoc, UsersDoc } from '@nuvix/utils/types'

@Injectable()
export class IdentityService {
  /**
   * Get Identities
   */
  async getIdentities({
    user,
    queries = [],
  }: WithDB<WithUser<{ queries?: Query[] }>>): Promise<{
    data: IdentitiesDoc[]
    total: number
  }> {
    queries.push(Query.equal('userInternalId', [user.getSequence()]))

    const filterQueries = Query.groupByType(queries).filters
    try {
      const results = await this.db.find('identities', queries)
      const total = await this.db.count(
        'identities',
        filterQueries,
        configuration.limits.limitCount,
      )

      return {
        data: results,
        total: total,
      }
    } catch (error: any) {
      if (error.name === 'OrderException') {
        throw new Exception(
          Exception.DATABASE_QUERY_ORDER_NULL,
          `The order attribute '${error.get()}' had a null value. Cursor pagination requires all documents order attribute values are non-null.`,
        )
      }
      throw error
    }
  }

  /**
   * Delete Identity
   */
  async deleteIdentity({
    identityId,
  }: WithDB<{ identityId: string }>): Promise<void> {
    const identity = await this.db.getDocument('identities', identityId)

    if (identity.empty()) {
      throw new Exception(Exception.USER_IDENTITY_NOT_FOUND)
    }

    await this.db.deleteDocument('identities', identityId)
  }
}

type WithDB<T = unknown> = T
type WithUser<T = unknown> = { user: UsersDoc } & T
