import { DataSource } from '@nuvix/pg';
import {
  EmbedNode,
  EmbedParserResult,
  Expression,
  ParsedOrdering,
  SelectNode,
} from './types';
import { ASTToQueryBuilder } from './builder';

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

    const { limit, offset, order, group, ...filterConstraints } = constraint;
    const joinAlias = tableAlias || tableName;

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
    const cleanedCondition = conditionSQL.sql.replace('select * where', '');

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
        `LATERAL (${lateralSelectContent})`,
        subQuerySQL.bindings,
      ),
      this.astBuilder.pg.raw('TRUE'),
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
        SELECT to_jsonb(${aliasedSubqueryResult}) AS ${wrappedAlias}
        FROM (${subQuerySQL}) AS ${wrappedAlias}
      `;
    } else {
      return `
        SELECT COALESCE(jsonb_agg(to_jsonb(${aliasedSubqueryResult})), '[]'::jsonb) AS ${wrappedAlias}
        FROM (${subQuerySQL}) AS ${wrappedAlias}
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
