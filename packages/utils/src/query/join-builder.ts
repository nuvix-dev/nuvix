/** Compiles embedded-relation nodes into joins: flattened joins for inline expansion, or LATERAL joins that aggregate child rows into JSON. */
import { trusted } from '@nuvix/pg'
import type { ASTToQueryBuilder } from './builder'
import {
  type EmbedNode,
  type EmbedParserResult,
  type Expression,
  type ParsedOrdering,
  QueryParserError,
  type SelectNode,
} from './types'

/**
 * Compiles an `EmbedNode` into the parent query. Non-flattened embeds become
 * LATERAL joins returning a JSON column (one object or an array per parent
 * row); flattened embeds become plain joins with GROUP BY-based expansion.
 */
export class JoinBuilder {
  constructor(private readonly astBuilder: ASTToQueryBuilder<any>) {}

  /** Validate and dispatch an embed node. */
  public applyEmbedNode(embedNode: EmbedNode): void {
    const {
      resource: tableName,
      alias: tableAlias,
      joinType,
      constraint,
      select: selectFields,
      flatten: shouldFlatten,
      shape: resultShape,
    } = embedNode
    let joinAlias = tableAlias || tableName

    // Schema-qualified embeds must target an allow-listed schema; the join
    // alias defaults to the bare table name.
    if (tableName.includes('.')) {
      const [_schema, _table] = tableName.split('.', 2)
      if (_schema && !this.astBuilder.allowedSchemas.includes(_schema)) {
        throw new QueryParserError(`Schema "${_schema}" is not allowed for join: ${tableName}`, {
          code: 'general_query_builder_error',
        })
      }
      if (!tableAlias && _table) {
        joinAlias = _table
      }
    }

    const { limit, offset, order, group, ...filterConstraints } = constraint

    // Non-flattened embeds render through LATERAL joins, which only support
    // these join types.
    if (!shouldFlatten && !['left', 'inner'].includes(joinType)) {
      throw new QueryParserError(
        `Unsupported join type "${joinType}" for non-flattened embed: ${tableName}`,
        {
          code: 'general_query_builder_error',
          hint: 'Use "left" or "inner" join for non-flattened embeds.',
          detail: `Invalid join type "${joinType}" for embed: ${tableName}`,
        },
      )
    }

    if (shouldFlatten) {
      this._applyFlattenedJoin(
        tableName,
        joinAlias,
        joinType,
        filterConstraints as Expression,
        selectFields,
        group,
        order ?? [],
      )
    } else {
      this._applyLateralJoin(
        tableName,
        joinAlias,
        joinType,
        filterConstraints as Expression,
        selectFields,
        group,
        order ?? [],
        Number(limit ?? 100),
        Number(offset ?? 0),
        resultShape ?? 'array',
      )
    }
  }

  /**
   * Plain (non-LATERAL) join. The constraint expression is compiled into a
   * standalone query first so its WHERE clause can be reused as the ON
   * condition, keeping identifier escaping and value binding identical to
   * top-level filters.
   */
  private _applyFlattenedJoin(
    tableName: string,
    joinAlias: string,
    joinType: string,
    filterConstraints: Expression,
    selectFields: SelectNode[],
    groupBy: EmbedParserResult['group'],
    orderBy: ParsedOrdering[],
  ): void {
    const subQb = this.astBuilder.db.table(tableName).as(joinAlias)
    this.astBuilder._applyExpressionToBuilder(filterConstraints, subQb)

    const compiled = subQb.toSQL()
    // Reuse the compiled subquery's WHERE clause as the ON condition;
    // fall back to `true` when the constraint is empty.
    const whereMatch = compiled.text.match(/where\s+([\s\S]+)$/i)
    const condition = whereMatch ? whereMatch[1] : 'true'

    const joinKeyword = joinType === 'inner' ? 'inner join' : 'left join'
    const joinSql = `${joinKeyword} "${tableName}" as "${joinAlias}" on ${condition}`

    this.astBuilder.qb.joinRaw(joinSql, compiled.values as unknown[])

    this.astBuilder.applyGroupBy(groupBy, joinAlias)
    this.astBuilder.applyOrder(orderBy, joinAlias)
    this.astBuilder.applySelect(selectFields)
  }

  /**
   * LATERAL join: runs a nested query per parent row and exposes it to the
   * parent as a single JSON column. The child projection/order/grouping are
   * compiled inside the subquery; the filter constraints are appended after
   * limit/offset so they always apply to the final child rows.
   */
  private _applyLateralJoin(
    tableName: string,
    joinAlias: string,
    joinType: string,
    filterConstraints: Expression,
    selectFields: SelectNode[],
    groupBy: EmbedParserResult['group'],
    orderBy: ParsedOrdering[],
    limit: number,
    offset: number,
    resultShape: string,
  ): void {
    const subQb = this.astBuilder.db.table(tableName).as(joinAlias)

    const childASTBuilder = this.astBuilder.createChildBuilder(subQb, {
      tableName,
    })
    childASTBuilder.applySelect(selectFields)
    childASTBuilder.applyGroupBy(groupBy, joinAlias)
    childASTBuilder.applyOrder(orderBy, joinAlias)

    // Object shape exposes at most one child row per parent.
    if (resultShape === 'object') {
      subQb.limit(1)
    } else if (limit > 0) {
      subQb.limit(limit)
    }
    if (offset > 0) {
      subQb.offset(offset)
    }

    this.astBuilder._applyExpressionToBuilder(filterConstraints, subQb)

    const subQuerySQL = subQb.toSQL()
    const lateralSelectContent = this._buildLateralSelectContent(
      joinAlias,
      subQuerySQL.text,
      resultShape,
    )

    const joinKeyword = joinType === 'inner' ? 'inner join lateral' : 'left join lateral'
    this.astBuilder.qb.joinRaw(
      `${joinKeyword} (${lateralSelectContent}) as "${joinAlias}" on true`,
      subQuerySQL.values as unknown[],
    )

    this.astBuilder.qb.select(trusted(`"${joinAlias}"`))
  }

  /**
   * Wrap subquery output as JSON: `to_jsonb` for a single object,
   * `jsonb_agg` (defaulting to `[]`) for arrays so parents without children
   * still get an empty array rather than NULL.
   */
  private _buildLateralSelectContent(
    joinAlias: string,
    subQuerySQL: string,
    resultShape: string,
  ): string {
    const wrappedAlias = `"${joinAlias}"`
    const aliasedSubqueryResult = `${wrappedAlias}.*`

    if (resultShape === 'object') {
      return `select to_jsonb(${aliasedSubqueryResult}) as ${wrappedAlias} from (${subQuerySQL}) as ${wrappedAlias}`
    }
    return `select coalesce(jsonb_agg(to_jsonb(${aliasedSubqueryResult})), '[]'::jsonb) as ${wrappedAlias} from (${subQuerySQL}) as ${wrappedAlias}`
  }
}
