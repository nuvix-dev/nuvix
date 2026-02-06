export type * from './generated'

import { Doc } from '@nuvix/db'

export type RecordDoc<T = unknown> = Doc<Record<string, T>>
