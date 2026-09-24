import type { TeamsDoc } from '../../types/generated'
import { formatMembership, type MembershipView } from '../users/formatter'

export type { MembershipView }
export { formatMembership }

export interface TeamView {
  $id: string
  $createdAt: string
  $updatedAt: string
  name: string
  total: number
  prefs: Record<string, unknown>
}

export function formatTeam(doc: TeamsDoc): TeamView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    name: doc.get('name') ?? '',
    total: doc.get('total') ?? 0,
    prefs: (doc.get('prefs') ?? {}) as Record<string, unknown>,
  }
}
