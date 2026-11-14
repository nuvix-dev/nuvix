/** Compiles parsed query ASTs (filters, projections, ordering) into `@nuvix/pg` QueryBuilder calls. Values stay parameterized; identifiers are escaped only inside `_rawFieldSql`. */
import type { DatabaseFacade, QueryBuilder } from '@nuvix/pg'
import { trusted } from '@nuvix/pg'
import { JoinBuilder } from './join-builder'
import type {
  AndExpression,
  ColumnNode,
  Condition,
  EmbedNode,
  Expression,
  NotExpression,
  OrExpression,
  ParsedOrdering,
  ParserResult,
  SelectNode,
  ValueType,
} from './types'
import { QueryParserError } from './types'

/** Options controlling AST compilation. */
export interface ASTToQueryBuilderOptions {
  applyExtra?: boolean
  tableName?: string
  allowUnsafeOperators?: boolean
  maxNestingDepth?: number
  throwOnEmpty?: boolean
  throwOnEmptyError?: Error
  allowedSchemas?: string[]
}

/**
 * Walks a parsed expression tree and produces the corresponding
 * `QueryBuilder` calls on a mutable `qb` instance. Boolean structure maps to
 * nested/wrapped where-groups so operator precedence is preserved.
 */
export class ASTToQueryBuilder<T extends QueryBuilder<any, any, any, any, any>> {
  public qb: T
  public readonly db: DatabaseFacade
  public readonly allowedSchemas: string[] = []

  /** Operators that accept an `(any|all, value...)` value-list modifier. */
  private readonly anyAllSupportedOperators = [
    'eq',
    'like',
    'ilike',
    'gt',
    'gte',
    'lt',
    'lte',
    'match',
    'imatch',
  ]

  constructor(qb: T, db: DatabaseFacade, options: ASTToQueryBuilderOptions = {}) {
    if (options.allowedSchemas) {
      this.allowedSchemas = options.allowedSchemas
    }
    this.qb = qb
    this.db = db
  }

  /** Create a builder for a nested query, inheriting schema restrictions. */
  createChildBuilder(qb: any, options: ASTToQueryBuilderOptions = {}): ASTToQueryBuilder<any> {
    return new ASTToQueryBuilder(qb, this.db, {
      ...options,
      allowedSchemas: this.allowedSchemas,
    })
  }

  /**
   * Apply a filter expression to the query builder. Modifiers (limit/offset/
   * order/group/shape) are stripped from the expression first; when
   * `applyExtra` is set they are applied explicitly instead.
   */
  applyFilters(
    expression: (Expression & ParserResult) | undefined,
    options: ASTToQueryBuilderOptions = {},
  ): T {
    if (options.applyExtra && expression) {
      const { limit, offset, group, order } = expression
      this.applyLimitOffset({ limit, offset })
      if (order) this.applyOrder(order, options.tableName)
      if (group) this.applyGroupBy(group, options.tableName)
    }

    if (!expression || Object.keys(expression).length === 0) {
      if (options.throwOnEmpty) {
        throw (
          options.throwOnEmptyError ??
          new QueryParserError('Empty expression provided', {
            code: 'general_parser_empty_error',
          })
        )
      }
      return this.qb
    }

    const { limit: _l, offset: _o, group: _g, order: _ord, shape: _s, ...filterExpr } = expression
    if (!filterExpr || Object.keys(filterExpr).length === 0) {
      if (options.throwOnEmpty) {
        throw (
          options.throwOnEmptyError ??
          new QueryParserError('Empty filter expression provided', {
            code: 'general_parser_empty_error',
          })
        )
      }
      return this.qb
    }

    this.qb = this._applyExpressionToBuilder(filterExpr as Expression, this.qb, 'and')
    return this.qb
  }

  /** Apply a projection: plain columns directly, embedded relations via `JoinBuilder`. */
  applySelect(selectNodes: SelectNode[] = [], queryBuilder: any = this.qb): T {
    if (!selectNodes || selectNodes.length === 0) {
      return queryBuilder
    }

    const selectColumns: unknown[] = []
    const embeds: EmbedNode[] = []

    for (const node of selectNodes) {
      if (node.type === 'column') {
        selectColumns.push(this._buildColumnSelect(node))
      } else if (node.type === 'embed') {
        embeds.push(node)
      }
    }

    let qb = queryBuilder
    if (selectColumns.length > 0) {
      qb = qb.select(...(selectColumns as any[]))
    }

    if (queryBuilder === this.qb) {
      this.qb = qb
    }

    for (const embed of embeds) {
      this._handleEmbedNode(embed)
    }

    return qb
  }

  /** Apply ORDER BY clauses; paths may traverse JSON accessors. */
  applyOrder(orderings: ParsedOrdering[] = [], table = ''): T {
    if (!orderings || orderings.length === 0) {
      return this.qb
    }

    for (const ordering of orderings) {
      const { path, direction, nulls } = ordering
      const fieldSql = this._rawFieldSql(path, table)
      const dirSql = direction.toLowerCase() === 'desc' ? 'desc' : 'asc'
      const nullsSql = nulls ? (nulls === 'nullsfirst' ? ' nulls first' : ' nulls last') : ''

      this.qb = this.qb.orderByRaw(`${fieldSql} ${dirSql}${nullsSql}`) as unknown as T
    }

    return this.qb
  }

  /** Apply GROUP BY for the given field paths. */
  applyGroupBy(columns?: Condition['field'][], tableName?: string): T {
    if (columns && columns.length > 0) {
      const parts = columns.map((col) => this._rawFieldSql(col, tableName))
      this.qb = this.qb.groupByRaw(parts.join(', ')) as unknown as T
    }
    return this.qb
  }

  /** Apply LIMIT/OFFSET, ignoring non-integer or negative values. */
  applyLimitOffset({ limit, offset }: { limit?: number | string; offset?: number | string }): T {
    const l = typeof limit === 'string' ? Number(limit) : limit
    const o = typeof offset === 'string' ? Number(offset) : offset

    if (typeof l === 'number' && Number.isInteger(l) && l >= 0) {
      this.qb = this.qb.limit(l) as unknown as T
    }
    if (typeof o === 'number' && Number.isInteger(o) && o >= 0) {
      this.qb = this.qb.offset(o) as unknown as T
    }

    return this.qb
  }

  /** Apply a RETURNING clause; embedded relations are rejected here. */
  applyReturning(selectNodes: SelectNode[] = [], queryBuilder: any = this.qb): T {
    let qb = queryBuilder
    if (!selectNodes || selectNodes.length === 0) {
      qb = qb.returning('*')
      if (queryBuilder === this.qb) this.qb = qb
      return qb
    }

    const returningColumns: unknown[] = []

    for (const node of selectNodes) {
      if (node.type === 'column') {
        returningColumns.push(this._buildColumnSelect(node))
      } else if (node.type === 'embed') {
        throw new QueryParserError('Embeds are not supported in returning clause', {
          code: 'general_parser_error',
        })
      }
    }

    if (returningColumns.length > 0) {
      qb = qb.returning(...(returningColumns as any[]))
    } else {
      qb = qb.returning('*')
    }

    if (queryBuilder === this.qb) this.qb = qb
    return qb
  }

  /**
   * Recursively translate an expression node into where-clauses. `connector`
   * describes how this node attaches to its parent ('and' | 'or'); or-groups
   * and not-groups are wrapped so their precedence cannot leak.
   */
  public _applyExpressionToBuilder(
    expression: Expression,
    qb: any,
    connector: 'and' | 'or' = 'and',
  ): any {
    if (!expression) return qb

    if (ASTToQueryBuilder._isCondition(expression)) {
      return this._applyCondition(expression, qb, connector)
    }

    if (ASTToQueryBuilder._isNotExpression(expression)) {
      const applyNot = (builder: any) => {
        builder.whereNot((nested: any) => {
          this._applyExpressionToBuilder(expression.not, nested, 'and')
        })
      }
      return connector === 'or' ? qb.orWhere(applyNot) : qb.whereWrapped(applyNot)
    }

    if (ASTToQueryBuilder._isOrExpression(expression)) {
      if (!expression.or || expression.or.length === 0) return qb
      const applyOrGroup = (builder: any) => {
        expression.or.forEach((subExpr, index) => {
          this._applyExpressionToBuilder(subExpr, builder, index === 0 ? 'and' : 'or')
        })
      }
      return connector === 'or' ? qb.orWhere(applyOrGroup) : qb.whereWrapped(applyOrGroup)
    }

    if (ASTToQueryBuilder._isAndExpression(expression)) {
      if (!expression.and || expression.and.length === 0) return qb
      if (connector === 'or') {
        return qb.orWhere((builder: any) => {
          expression.and.forEach((subExpr) => {
            this._applyExpressionToBuilder(subExpr, builder, 'and')
          })
        })
      }
      let currentQb = qb
      for (const subExpr of expression.and) {
        currentQb = this._applyExpressionToBuilder(subExpr, currentQb, 'and')
      }
      return currentQb
    }

    throw new QueryParserError(`Unsupported expression type: ${JSON.stringify(expression)}`, {
      code: 'general_parser_error',
    })
  }

  /**
   * Translate a single comparison into SQL. Handles the `(any|all, ...)` value
   * modifier, column-to-column comparisons, and the full operator switch
   * below. Each case mirrors itself for the 'or' connector.
   */
  private _applyCondition(condition: Condition, qb: any, connector: 'and' | 'or' = 'and'): any {
    const { field: _field, operator, values = [], tableName } = condition

    if (!_field || !operator) {
      throw new QueryParserError('Condition must have both column and operator', {
        code: 'general_parser_error',
      })
    }

    const fieldSql = this._rawFieldSql(_field, tableName)
    const fieldOperand = trusted(fieldSql)

    // `(any|all, value...)` modifier: first list element selects quantifier.
    if (
      Array.isArray(values) &&
      values.length >= 2 &&
      this.anyAllSupportedOperators.includes(operator)
    ) {
      const [modifier, ...restValues] = values
      if (modifier === 'any' || modifier === 'all') {
        const opMap: Record<string, string> = {
          eq: '=',
          like: 'like',
          ilike: 'ilike',
          gt: '>',
          gte: '>=',
          lt: '<',
          lte: '<=',
          match: '~',
          imatch: '~*',
        }
        const op = opMap[operator] ?? '='
        const patternValues =
          operator === 'like' || operator === 'ilike'
            ? restValues.map((v) => this._valueToPattern(v))
            : restValues
        const sql = `${fieldSql} ${op} ${modifier}(?)`
        return connector === 'or'
          ? qb.orWhereRaw(sql, [patternValues])
          : qb.whereRaw(sql, [patternValues])
      }
    }

    const filteredValues = values.filter((v) => !this._isValueColumnName(v))
    const value = values[0]

    // Column-to-column comparison: the right operand is a quoted identifier,
    // not a bound value.
    if (
      typeof value === 'object' &&
      value !== null &&
      '__type' in value &&
      (value as { __type: string }).__type === 'column'
    ) {
      const rightCol = (value as ValueType).name
      const rightOperand = trusted(
        rightCol.includes('.')
          ? rightCol
              .split('.')
              .map((c) => `"${c}"`)
              .join('.')
          : `"${rightCol}"`,
      )
      const compMap: Record<string, string> = {
        eq: '=',
        neq: '<>',
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
      }
      const sqlOp = compMap[operator] ?? '='
      return connector === 'or'
        ? qb.orWhere(fieldOperand, sqlOp as any, rightOperand)
        : qb.where(fieldOperand, sqlOp as any, rightOperand)
    }

    switch (operator) {
      case 'eq':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '=', value)
          : qb.where(fieldOperand, '=', value)
      case 'neq':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '<>', value)
          : qb.where(fieldOperand, '<>', value)
      case 'gt':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '>', value)
          : qb.where(fieldOperand, '>', value)
      case 'gte':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '>=', value)
          : qb.where(fieldOperand, '>=', value)
      case 'lt':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '<', value)
          : qb.where(fieldOperand, '<', value)
      case 'lte':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '<=', value)
          : qb.where(fieldOperand, '<=', value)
      case 'like':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, 'like', this._valueToPattern(value))
          : qb.where(fieldOperand, 'like', this._valueToPattern(value))
      case 'ilike':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, 'ilike', this._valueToPattern(value))
          : qb.where(fieldOperand, 'ilike', this._valueToPattern(value))
      case 'match':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '~', this._valueToPattern(value))
          : qb.where(fieldOperand, '~', this._valueToPattern(value))
      case 'imatch':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '~*', this._valueToPattern(value))
          : qb.where(fieldOperand, '~*', this._valueToPattern(value))
      case 'in':
        // Empty IN list: SQL cannot bind zero placeholders, so substitute an
        // equivalent constant predicate.
        if (filteredValues.length === 0) {
          return connector === 'or' ? qb.orWhereRaw('1 = 0') : qb.whereRaw('1 = 0')
        }
        return connector === 'or'
          ? qb.orWhereIn(fieldOperand, filteredValues)
          : qb.whereIn(fieldOperand, filteredValues)
      case 'notin':
        if (filteredValues.length === 0) {
          return connector === 'or' ? qb.orWhereRaw('1 = 1') : qb.whereRaw('1 = 1')
        }
        return connector === 'or'
          ? qb.orWhereNotIn(fieldOperand, filteredValues)
          : qb.whereNotIn(fieldOperand, filteredValues)
      case 'is':
      case 'isnot': {
        const valStr = String(value).toLowerCase()
        const isNot = operator === 'isnot'
        if (valStr === 'null') {
          if (connector === 'or') {
            return isNot ? qb.orWhereNotNull(fieldOperand) : qb.orWhereNull(fieldOperand)
          }
          return isNot ? qb.whereNotNull(fieldOperand) : qb.whereNull(fieldOperand)
        }
        if (valStr === 'not_null') {
          if (connector === 'or') {
            return isNot ? qb.orWhereNull(fieldOperand) : qb.orWhereNotNull(fieldOperand)
          }
          return isNot ? qb.whereNull(fieldOperand) : qb.whereNotNull(fieldOperand)
        }
        if (valStr === 'true') {
          return connector === 'or'
            ? isNot
              ? qb.orWhere(fieldOperand, '!=', true)
              : qb.orWhere(fieldOperand, '=', true)
            : isNot
              ? qb.where(fieldOperand, '!=', true)
              : qb.where(fieldOperand, '=', true)
        }
        if (valStr === 'false') {
          return connector === 'or'
            ? isNot
              ? qb.orWhere(fieldOperand, '!=', false)
              : qb.orWhere(fieldOperand, '=', false)
            : isNot
              ? qb.where(fieldOperand, '!=', false)
              : qb.where(fieldOperand, '=', false)
        }
        throw new QueryParserError(`Unsupported IS condition: ${value}`, {
          code: 'general_parser_error',
        })
      }
      case 'null':
        return connector === 'or' ? qb.orWhereNull(fieldOperand) : qb.whereNull(fieldOperand)
      case 'notnull':
        return connector === 'or' ? qb.orWhereNotNull(fieldOperand) : qb.whereNotNull(fieldOperand)
      case 'isdistinct':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, 'is distinct from', value)
          : qb.where(fieldOperand, 'is distinct from', value)
      case 'between':
        if (values.length !== 2) {
          throw new QueryParserError("'between' operator expects exactly two values.", {
            code: 'general_parser_error',
          })
        }
        return connector === 'or'
          ? qb.orWhereBetween(fieldOperand, [values[0], values[1]])
          : qb.whereBetween(fieldOperand, [values[0], values[1]])
      case 'cs':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '@>', JSON.stringify(values))
          : qb.where(fieldOperand, '@>', JSON.stringify(values))
      case 'cd':
        return connector === 'or'
          ? qb.orWhere(fieldOperand, '<@', JSON.stringify(values))
          : qb.where(fieldOperand, '<@', JSON.stringify(values))
      case 'ov':
        return connector === 'or'
          ? qb.orWhereRaw(`${fieldSql} && ?`, [values])
          : qb.whereRaw(`${fieldSql} && ?`, [values])
      case 'sl':
        return connector === 'or'
          ? qb.orWhereRaw(`${fieldSql} << ?`, [filteredValues])
          : qb.whereRaw(`${fieldSql} << ?`, [filteredValues])
      case 'sr':
        return connector === 'or'
          ? qb.orWhereRaw(`${fieldSql} >> ?`, [filteredValues])
          : qb.whereRaw(`${fieldSql} >> ?`, [filteredValues])
      case 'nxl':
        return connector === 'or'
          ? qb.orWhereRaw(`${fieldSql} &> ?`, [filteredValues])
          : qb.whereRaw(`${fieldSql} &> ?`, [filteredValues])
      case 'nxr':
        return connector === 'or'
          ? qb.orWhereRaw(`${fieldSql} &< ?`, [filteredValues])
          : qb.whereRaw(`${fieldSql} &< ?`, [filteredValues])
      case 'adj':
        return connector === 'or'
          ? qb.orWhereRaw(`${fieldSql} -|- ?`, [filteredValues])
          : qb.whereRaw(`${fieldSql} -|- ?`, [filteredValues])
      case 'fts':
        return this._applyFts(fieldSql, values, 'to_tsquery', qb, connector)
      case 'plfts':
        return this._applyFts(fieldSql, values, 'plainto_tsquery', qb, connector)
      case 'phfts':
        return this._applyFts(fieldSql, values, 'phraseto_tsquery', qb, connector)
      case 'wfts':
        return this._applyFts(fieldSql, values, 'websearch_to_tsquery', qb, connector)
      default:
        throw new QueryParserError(`Unsupported operator: ${operator}`, {
          code: 'general_parser_error',
        })
    }
  }

  /** Full-text search with an optional two-argument form (language, query). */
  private _applyFts(
    fieldSql: string,
    values: unknown[],
    tsFunction: 'to_tsquery' | 'plainto_tsquery' | 'phraseto_tsquery' | 'websearch_to_tsquery',
    qb: any,
    connector: 'and' | 'or' = 'and',
  ): any {
    if (values.length >= 2) {
      const [language, query] = values
      const sql = `to_tsvector(?, ${fieldSql}) @@ ${tsFunction}(?, ?)`
      const bindings = [language, language, query]
      return connector === 'or' ? qb.orWhereRaw(sql, bindings) : qb.whereRaw(sql, bindings)
    }
    const sql = `to_tsvector(${fieldSql}) @@ ${tsFunction}(?)`
    const bindings = [values[0]]
    return connector === 'or' ? qb.orWhereRaw(sql, bindings) : qb.whereRaw(sql, bindings)
  }

  /** Translate client-side `*` wildcards into SQL `%` for LIKE-style operators. */
  private _valueToPattern(value: unknown): string {
    return String(value).replaceAll('*', '%')
  }

  /** True when a comparison value explicitly references another column. */
  private _isValueColumnName(value: unknown): value is ValueType {
    return (
      value !== null &&
      typeof value === 'object' &&
      '__type' in value &&
      (value as { __type: string }).__type === 'column'
    )
  }

  /**
   * Render a field path as SQL text. Plain segments become double-quoted
   * identifiers; segments after a JSON accessor become quote-escaped keys or
   * numeric indexes. Identifier quoting lives ONLY here — new field contexts
   * must route through this method.
   */
  public _rawFieldSql(_field: Condition['field'], table?: string): string {
    if (typeof _field === 'string') {
      const safeCol = `"${_field.replace(/"/g, '""')}"`
      if (table) {
        return `"${table.replace(/"/g, '""')}".${safeCol}`
      }
      return safeCol
    }

    if (Array.isArray(_field)) {
      const sqlParts: string[] = []

      for (let i = 0; i < _field.length; i++) {
        const part = _field[i]!
        const isLastPart = i === _field.length - 1

        if (typeof part === 'string' || typeof part === 'number') {
          const isAfterOperator =
            i > 0 && _field.slice(0, i).some((p) => typeof p === 'object' && 'operator' in p)

          if (isAfterOperator) {
            const numericValue = Number(part)
            if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
              sqlParts.push(String(part))
            } else {
              sqlParts.push(`'${String(part).replace(/'/g, "''")}'`)
            }
          } else {
            sqlParts.push(`"${String(part).replace(/"/g, '""')}"`)
          }

          if (!isLastPart) {
            sqlParts.push('.')
          }
        } else if (typeof part === 'object' && 'operator' in part) {
          if (isLastPart) {
            throw new QueryParserError(
              'Invalid syntax, should be string or number after `->` or `->>`',
              { code: 'general_parser_error' },
            )
          }
          const hasObjectPartsBefore = _field
            .slice(0, i)
            .some((p) => typeof p === 'object' && 'operator' in p)

          if (!hasObjectPartsBefore) {
            sqlParts.push(`"${part.name.replace(/"/g, '""')}"`)
          } else {
            const numericValue = Number(part.name)
            if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
              sqlParts.push(part.name)
            } else {
              sqlParts.push(`'${part.name.replace(/'/g, "''")}'`)
            }
          }
          sqlParts.push(part.operator ?? '->')
        }
      }

      if (table && !sqlParts[0]?.startsWith(`"${table}"`)) {
        return `"${table.replace(/"/g, '""')}".${sqlParts.join('')}`
      }
      return sqlParts.join('')
    }

    throw new QueryParserError('Invalid field type: field must be string or array', {
      code: 'general_parser_error',
    })
  }

  /**
   * Build a select expression for one column node: escaped path, optional
   * cast, optional aggregate wrapper, and an alias — inferred from the JSON
   * path suffix when not given explicitly.
   */
  private _buildColumnSelect({ path, tableName, alias, cast, aggregate }: ColumnNode): unknown {
    let resolvedAlias = alias
    if (!resolvedAlias && Array.isArray(path)) {
      const firstJsonPartIndex = path.findIndex(
        (p) => typeof p === 'object' && (p.__type === 'json' || p.operator),
      )
      if (firstJsonPartIndex !== -1) {
        resolvedAlias = path
          .slice(firstJsonPartIndex)
          .map((p) => (typeof p === 'string' ? p : typeof p === 'object' && p.name ? p.name : ''))
          .filter(Boolean)
          .join('_')
      }
    }

    const rawPath =
      aggregate && aggregate.fn === 'count' && path === '*'
        ? '*'
        : this._rawFieldSql(path, tableName)
    let sql = cast ? `cast((${rawPath}) as ${cast})` : rawPath

    if (aggregate) {
      sql = `${aggregate.fn}(${sql})`
      if (aggregate.cast) {
        sql = `cast((${sql}) as ${aggregate.cast})`
      }
    }

    if (resolvedAlias) {
      return trusted(`${sql} as "${resolvedAlias.replace(/"/g, '""')}"`)
    }
    return trusted(sql)
  }

  /** Delegate embedded-relation compilation to the join builder. */
  private _handleEmbedNode(embed: EmbedNode): void {
    const joinBuilder = new JoinBuilder(this)
    joinBuilder.applyEmbedNode(embed)
  }

  /** Structural type guards for expression nodes (tree nodes are untagged unions). */
  public static _isCondition(expression: Expression): expression is Condition {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'field' in expression &&
      'operator' in expression
    )
  }

  public static _isNotExpression(expression: Expression): expression is NotExpression {
    return expression !== null && typeof expression === 'object' && 'not' in expression
  }

  public static _isOrExpression(expression: Expression): expression is OrExpression {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'or' in expression &&
      Array.isArray((expression as OrExpression).or)
    )
  }

  public static _isAndExpression(expression: Expression): expression is AndExpression {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'and' in expression &&
      Array.isArray((expression as AndExpression).and)
    )
  }
}
