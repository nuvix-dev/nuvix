import type {
  Expression,
  ParserResult,
  SelectNode,
  ParsedOrdering,
} from '@nuvix/utils/query'
import type { SelectQueryDTO } from './DTO/table.dto'
import type { RequestContext } from '@nuvix/core/helpers'

export interface SelectQuery
  extends Omit<SelectQueryDTO, 'select' | 'filter' | 'order'> {
  filter?: Expression & ParserResult
  select?: SelectNode[]
  order?: ParsedOrdering[]
}

type Common = {
  schema: string
  table: string
  context: RestContext
}

export interface Select extends Common {
  query: SelectQuery
}

export interface InsertQuery {
  columns?: string[]
  select?: SelectNode[]
}

export interface Insert extends Common {
  input:
    | Record<string, string | number | null | boolean>
    | Record<string, string | number | null | boolean>[]
  returnPref?: 'minimal' | 'location' | 'full'
  query: InsertQuery
}

export interface UpdateQuery extends SelectQuery {
  force?: boolean
  columns?: string[]
}

export interface Update extends Omit<Insert, 'input'> {
  input: Record<string, string | number | null | boolean>
  query: UpdateQuery
}

export interface DeleteQuery extends SelectQuery {
  force?: boolean
}

export interface Delete extends Omit<Select, 'query'> {
  query: DeleteQuery
}

interface CallFunctionQuery extends SelectQuery {}

export interface CallFunction {
  schema: string
  functionName: string
  args?: Record<string, string | number | boolean | null> | any[]
  query: CallFunctionQuery
  context: RestContext
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

export interface RestContext {
  ip: string
  headers: Record<string, string | string[] | undefined>
  method: string
  url: string
  id: string
  ctx: RequestContext
}
