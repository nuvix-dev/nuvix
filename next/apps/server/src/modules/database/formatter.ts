import type { SchemaType, SchemaView } from './types'

export function formatSchema(row: {
  name: string
  description?: string | null
  type: string
}): SchemaView {
  return {
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    type: row.type as SchemaType,
  }
}
