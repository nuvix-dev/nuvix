export interface Select {
  schema: string
  table: string
  url: string
  limit?: number
  offset?: number
  shape?: 'array' | 'object'
  context: Record<string, any>
}

export interface Insert {
  table: string
  input:
    | Record<string, string | number | null | boolean>
    | Record<string, string | number | null | boolean>[]
  columns?: string[]
  schema: string
  url: string
  returnPref?: 'minimal' | 'location' | 'full'
  context: Record<string, any>
}

export interface Update extends Omit<Insert, 'input'> {
  input: Record<string, string | number | null | boolean>
  limit?: number
  offset?: number
  force?: boolean
}

export interface Delete extends Select {
  force?: boolean
}

export interface CallFunction {
  schema: string
  functionName: string
  url: string
  limit?: number
  offset?: number
  args?: Record<string, string | number | boolean | null> | any[]
  context: Record<string, any>
}

export interface UpdatePermissions {
  schema: string
  permissions: string[]
  rowId?: number
  tableId: string
}

export interface GetPermissions {
  schema: string
  rowId?: number
  tableId: string
}
