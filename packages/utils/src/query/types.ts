/** Type definitions shared by the query language parser, its builders, and the SQL emitters that consume parsed output. */
import type { AllowedOperators } from './base'

/** Location of a token inside the raw query string, for precise parser error reporting. */
export interface ParsePosition {
  line: number
  column: number
  offset: number
}

/**
 * Error thrown when query syntax is invalid. Always a client error: carries
 * an HTTP 400 status, a stable snake_case `code`, and optional position,
 * `detail`, and `hint` fields suitable for problem-details responses.
 */
export class QueryParserError extends Error {
  readonly status = 400
  readonly code: string
  readonly position?: ParsePosition
  readonly detail?: string
  readonly hint?: string

  constructor(
    message: string,
    options: {
      code?: string
      position?: ParsePosition
      detail?: string
      hint?: string
    } = {},
  ) {
    super(message)
    this.name = 'QueryParserError'
    this.code = options.code ?? 'general_parser_error'
    this.position = options.position
    this.detail = options.detail
    this.hint = options.hint
  }
}

/** One JSON path segment. `->` selects the JSON value, `->>` selects it as text. */
export type JsonFieldType = {
  __type: 'json'
  name: string
  operator?: '->' | '->>'
}

/** An explicit column reference or raw SQL fragment used as a comparison value. */
export type ValueType = {
  __type: 'column' | 'raw'
  name: string
}

/** A single parsed ORDER BY entry; `path` may traverse JSON fields. */
export interface ParsedOrdering {
  path: string | (string | JsonFieldType)[]
  direction: 'asc' | 'desc'
  nulls: 'nullsfirst' | 'nullslast' | null
}

/** A selected table column, optionally aliased, cast, or wrapped in an aggregate function. */
export interface ColumnNode {
  type: 'column'
  tableName: string
  path: string | (string | JsonFieldType)[]
  alias: string | null
  cast: string | null
  aggregate?: {
    fn: 'sum' | 'count' | 'min' | 'max' | 'avg'
    cast?: string
  }
}

/**
 * A related-resource selection: join `mainTable` to `resource`, apply the
 * parsed constraint expression as the join condition, and recurse into the
 * nested `select`.
 */
export interface EmbedNode {
  type: 'embed'
  resource: string
  mainTable: string
  joinType: 'left' | 'right' | 'inner' | 'full' | 'cross'
  alias?: string
  constraint: Expression & EmbedParserResult
  select: SelectNode[]
  shape?: 'array' | 'object'
  flatten?: boolean
}

/** A projection item: either a plain column or an embedded relation. */
export type SelectNode = ColumnNode | EmbedNode

/**
 * Syntax configuration for the tokenizer/parser: grouping and boolean tokens,
 * list/value styles, and cast delimiters. Lets the same parser grammar serve
 * different query syntaxes.
 */
export interface ParserConfig {
  groups: {
    NOT: string
    OPEN: '(' | '{'
    CLOSE: ')' | '}'
    OR: string
    SEP: string
  }
  values: {
    FUNCTION_STYLE: boolean
    LIST_STYLE: '[]' | '()' | '{}'
  }
  cast: {
    OPEN: '{' | '('
    CLOSE: '}' | ')'
  }
}

/** A leaf comparison: `field` against `values` using a single operator. */
export interface Condition {
  tableName: string
  field: string | (string | JsonFieldType)[]
  operator: AllowedOperators
  values: (string | number | null | undefined | boolean | ValueType)[]
}

/** Boolean combinators over nested expressions. */
export interface NotExpression {
  not: Expression
}

export interface OrExpression {
  or: Expression[]
}

export interface AndExpression {
  and: Expression[]
}

/** Recursive filter tree. `null` means "no filter" (match everything). */
export type Expression = Condition | NotExpression | OrExpression | AndExpression | null

/** Top-level query modifiers produced by parsing a query string. */
export interface ParserResult {
  limit?: number
  offset?: number
  group?: Condition['field'][]
  order?: ParsedOrdering[]
  shape?: 'array' | 'object'
}

/** Query modifiers scoped to a single embedded relation. */
export interface EmbedParserResult extends ParserResult {
  joinType?: 'left' | 'right' | 'inner' | 'full' | 'cross'
  order?: ParsedOrdering[]
}

/** A field reference: a plain column name or a path that traverses JSON columns. */
export type FieldPath = string | (string | JsonFieldType)[]
