import { Query, type Session } from '@nuvix/db'
import { NotFoundError } from '../../shared/errors'
import type { IdentitiesDoc } from '../../types/generated'
import { formatIdentity, type IdentityView } from './formatter'

export class AccountIdentitiesService {
  constructor(private readonly session: Session) {}

  async getIdentities(
    userId: string,
    queries: Query[] = [],
  ): Promise<{ total: number; identities: IdentityView[] }> {
    const q = [...queries, Query.equal('userId', [userId])]
    const filterQueries = Query.groupByType(q).filters

    const docs = (await this.session.find('identities', q)) as IdentitiesDoc[]
    const total = await this.session.count('identities', filterQueries)

    return {
      total,
      identities: docs.map(formatIdentity),
    }
  }

  async deleteIdentity(userId: string, identityId: string): Promise<void> {
    const doc = (await this.session.getDocument('identities', identityId)) as IdentitiesDoc
    if (doc.empty() || doc.get('userId') !== userId) {
      throw new NotFoundError('Identity not found', { code: 'user_identity_not_found' })
    }

    await this.session.deleteDocument('identities', identityId)
  }
}
