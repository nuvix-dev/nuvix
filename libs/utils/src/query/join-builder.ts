import { DataSource } from '@nuvix/pg';
import {
  EmbedNode,
  EmbedParserResult,
  Expression,
  ParsedOrdering,
  SelectNode,
} from './types';
import { ASTToQueryBuilder } from './builder';
import { Exception } from '@nuvix/core/extend/exception';

type QueryBuilder = ReturnType<DataSource['queryBuilder']>;

export class JoinBuilder<T extends ASTToQueryBuilder<QueryBuilder>> {
  private readonly astBuilder: T;

  constructor(astBuilder: T) {
    this.astBuilder = astBuilder;
  }

  public applyEmbedNode(embedNode: EmbedNode): void {
    const {
      resource: tableName,
      alias: tableAlias,
      joinType,
      constraint,
      mainTable,
      select: selectFields,
      flatten: shouldFlatten,
      shape: resultShape,
    } = embedNode;
    let joinAlias = tableAlias || tableName;

    if (tableName.includes('.')) {
      const [_schema, _table] = tableName.split('.', 2);
      if (!this.astBuilder.allowedSchemas.includes(_schema)) {
        throw new Exception(
          Exception.GENERAL_QUERY_BUILDER_ERROR,
          `Schema "${_schema}" is not allowed for join: ${tableName}`,
        );
      }
      if (!tableAlias) { joinAlias = _table };
    }

    const { limit, offset, order, group, ...filterConstraints } = constraint;

    if (!shouldFlatten && !['left', 'inner'].includes(joinType)) {
      throw new Exception(
        Exception.GENERAL_QUERY_BUILDER_ERROR,
        `Unsupported join type "${joinType}" for non-flattened embed: ${tableName}`,
      ).addDetails({
        hint: 'Use "left" or "inner" join for non-flattened embeds.',
        detail: `Invalid join type "${joinType}" for embed: ${tableName}`,
      });
    }

    if (shouldFlatten) {
      this._applyFlattenedJoin(
        tableName,
        joinAlias,
        joinType,
        filterConstraints,
        selectFields,
        group,
        order,
      );
    } else {
      this._applyLateralJoin(
        tableName,
        joinAlias,
        joinType,
        filterConstraints,
        selectFields,
        group,
        order,
        limit,
        offset,
        resultShape,
      );
    }
  }

  private _applyFlattenedJoin(
    tableName: string,
    joinAlias: string,
    joinType: string,
    filterConstraints: Expression,
    selectFields: SelectNode[],
    groupBy: EmbedParserResult['group'],
    orderBy: ParsedOrdering[],
  ): void {
    const conditionQueryBuilder = this._buildJoinConditionSQL(
      filterConstraints,
      this.astBuilder.pg.queryBuilder(),
    );

    const conditionSQL = conditionQueryBuilder.toSQL();
    const cleanedCondition = conditionSQL.sql.replace('select * where ', '');

    this.astBuilder.qb[joinType + 'Join'](
      this.astBuilder.pg.alias(tableName, joinAlias),
      this.astBuilder.pg.raw(cleanedCondition, conditionSQL.bindings),
    );

    const childASTBuilder = new ASTToQueryBuilder(
      this.astBuilder.qb,
      this.astBuilder.pg,
      { tableName: joinAlias },
    );

    childASTBuilder.applyGroupBy(groupBy, joinAlias);
    childASTBuilder.applyOrder(orderBy, joinAlias);
    childASTBuilder.applySelect(selectFields);
  }

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
    const subQueryBuilder = this.astBuilder.pg.qb(
      this.astBuilder.pg.alias(tableName, joinAlias),
    );

    const childASTBuilder = new ASTToQueryBuilder(
      subQueryBuilder,
      this.astBuilder.pg,
      {
        tableName,
      },
    );

    childASTBuilder.applySelect(selectFields);
    childASTBuilder.applyGroupBy(groupBy, joinAlias);
    childASTBuilder.applyOrder(orderBy, joinAlias);

    this._applyLimitAndOffset(subQueryBuilder, resultShape, limit, offset);
    this._buildJoinConditionSQL(filterConstraints, subQueryBuilder);

    const subQuerySQL = subQueryBuilder.toSQL();
    const lateralSelectContent = this._buildLateralSelectContent(
      joinAlias,
      subQuerySQL.sql,
      resultShape,
    );

    this.astBuilder.qb[joinType + 'Join'](
      this.astBuilder.pg.raw(
        `lateral (${lateralSelectContent})`,
        subQuerySQL.bindings,
      ),
      this.astBuilder.pg.raw('true'),
    );

    this.astBuilder.qb.select(joinAlias);
  }

  private _applyLimitAndOffset(
    queryBuilder: QueryBuilder,
    resultShape: string,
    limit: number,
    offset: number,
  ): void {
    if (resultShape === 'object') {
      queryBuilder.limit(1);
    } else {
      queryBuilder.limit(limit);
    }
    queryBuilder.offset(offset);
  }

  private _buildLateralSelectContent(
    joinAlias: string,
    subQuerySQL: string,
    resultShape: string,
  ): string {
    const wrappedAlias = this.astBuilder.pg.wrapIdentifier(
      joinAlias,
      undefined,
    );
    const aliasedSubqueryResult = `${wrappedAlias}.*`;

    if (resultShape === 'object') {
      return `
        select to_jsonb(${aliasedSubqueryResult}) as ${wrappedAlias}
        from (${subQuerySQL}) as ${wrappedAlias}
      `;
    } else {
      return `
        select coalesce(jsonb_agg(to_jsonb(${aliasedSubqueryResult})), '[]'::jsonb) as ${wrappedAlias}
        from (${subQuerySQL}) as ${wrappedAlias}
      `;
    }
  }

  private _buildJoinConditionSQL(
    expression: Expression,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    const astBuilder = new ASTToQueryBuilder(queryBuilder, this.astBuilder.pg);
    astBuilder.applyFilters(expression, {});
    return queryBuilder;
  }
}
