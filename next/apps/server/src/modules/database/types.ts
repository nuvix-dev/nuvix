export type SchemaType = 'document' | 'managed' | 'unmanaged'

export interface SchemaView {
  name: string
  description: string | null
  type: SchemaType
}

export interface CreateSchemaInput {
  name: string
  description?: string | null
  type: SchemaType
}

export interface UpdateSchemaInput {
  description?: string | null
}
