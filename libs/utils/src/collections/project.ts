import { Collection } from '@nuvix/db'
import { authCollections, commonCollections } from './common'

export const projectCollections: Record<string, Collection> = {
  ...authCollections,
  ...commonCollections,
}
