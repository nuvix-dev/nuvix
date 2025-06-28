import { Logger } from '@nestjs/common';
import { DataSource } from '@nuvix/pg';
import { EmbedNode, Expression, Condition } from './types';
import { ASTToQueryBuilder } from './builder';

type QueryBuilder = ReturnType<DataSource['queryBuilder']>;

export class JoinBuilder<T extends ASTToQueryBuilder<QueryBuilder>> {
  private readonly logger = new Logger(JoinBuilder.name);
  private readonly astBuilder: T;
  private readonly maxDepth = 3;

  constructor(astBuilder: T) {
    this.astBuilder = astBuilder;
  }

  public applyEmbedNode(embed: EmbedNode): void {
    const {
      resource,
      alias,
      joinType,
      constraint,
      mainTable,
      select,
      flatten,
      shape,
    } = embed;

    const { limit, offset, order, group, ...restConstraint } = constraint;

    const joinAlias = alias || resource;

    if (flatten) {
      const subQb = this._buildJoinConditionSQL(
        restConstraint,
        this.astBuilder.pg.queryBuilder(),
      );

      const conditionSQL = subQb.toSQL();
      this.astBuilder.qb[joinType + 'Join'](
        this.astBuilder.pg.alias(resource, joinAlias),
        this.astBuilder.pg.raw(
          conditionSQL.sql.replace('select * where', ''),
          conditionSQL.bindings,
        ),
      );

      const childAST = new ASTToQueryBuilder(
        this.astBuilder.qb,
        this.astBuilder.pg,
        { tableName: joinAlias },
      );
      childAST.applyGroupBy(group, joinAlias);
      childAST.applyOrder(order, joinAlias);
      childAST.applySelect(select);
    } else {
      const subQb = this.astBuilder.pg.qb(
        this.astBuilder.pg.alias(resource, joinAlias),
      );

      const childAST = new ASTToQueryBuilder(subQb, this.astBuilder.pg, {
        tableName: resource,
      });

      childAST.applySelect(select);
      childAST.applyGroupBy(group, joinAlias);
      childAST.applyOrder(order, joinAlias);

      // Add constraint condition (LIMIT, OFFSET)
      if (shape === 'object') {
        subQb.limit(1);
      } else {
        subQb.limit(limit);
      }
      subQb.offset(offset);

      this._buildJoinConditionSQL(restConstraint, subQb);

      const subQuerySQL = subQb.toSQL();

      let lateralSelectContent: string;
      const aliasedSubqueryResult = `${this.astBuilder.pg.wrapIdentifier(joinAlias, undefined)}.*`;

      if (shape === 'object') {
        lateralSelectContent = `
            SELECT to_jsonb(${aliasedSubqueryResult}) AS ${this.astBuilder.pg.wrapIdentifier(joinAlias, undefined)}
            FROM (${subQuerySQL.sql}) AS ${this.astBuilder.pg.wrapIdentifier(joinAlias, undefined)}
        `;
      } else {
        lateralSelectContent = `
            SELECT COALESCE(jsonb_agg(to_jsonb(${aliasedSubqueryResult})), '[]'::jsonb) AS ${this.astBuilder.pg.wrapIdentifier(joinAlias, undefined)}
            FROM (${subQuerySQL.sql}) AS ${this.astBuilder.pg.wrapIdentifier(joinAlias, undefined)}
        `;
      }

      this.astBuilder.qb[joinType + 'Join'](
        this.astBuilder.pg.raw(
          `LATERAL (${lateralSelectContent})`,
          subQuerySQL.bindings,
        ),
        this.astBuilder.pg.raw('TRUE'),
      );

      this.astBuilder.qb.select(joinAlias);
    }
  }

  private _buildJoinConditionSQL(expr: Expression, subQb: QueryBuilder) {
    const ast = new ASTToQueryBuilder(subQb, this.astBuilder.pg);
    ast.applyFilters(expr, {});
    return subQb;
  }
}
