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
      // Flattened JOIN (existing behavior)
      const subQb = this._buildJoinConditionSQL(
        restConstraint,
        this.astBuilder.pg.queryBuilder()
      );

      const conditionSQL = subQb.toSQL()
      this.astBuilder.qb[joinType + 'Join'](
        this.astBuilder.pg.alias(resource, joinAlias),
        this.astBuilder.pg.raw(conditionSQL.sql.replace('select * where', ''), conditionSQL.bindings),
      );

      const childAST = new ASTToQueryBuilder(
        this.astBuilder.qb,
        this.astBuilder.pg,
        { tableName: joinAlias },
      );

      childAST.applySelect(select);
    } else {
      // LOIN: Lateral Object Inline Join with JSON aggregation
      const subQb = this.astBuilder.pg.qb(
        this.astBuilder.pg.alias(resource, joinAlias),
      );

      const childAST = new ASTToQueryBuilder(subQb, this.astBuilder.pg, {
        tableName: resource,
      });

      childAST.applySelect(select);

      // Add constraint condition
      if (shape === 'object') {
        subQb.limit(1);
      } else {
        subQb.limit(limit);
      }

      subQb.offset(offset);
      this._buildJoinConditionSQL(
        restConstraint,
        subQb
      );

      let lateralSelect: string;
      const subQuerySQL = subQb.toSQL();

      // TODO: improve the query to return only one object, to_jsonb & row_to_json dosen't return object as result
      if (shape === 'object') {
        if (shape === 'object') {
          lateralSelect = `
            SELECT to_jsonb(${joinAlias}.*) as ${this.astBuilder.pg.wrapIdentifier(joinAlias, undefined)}
            FROM (${subQuerySQL.sql}) as ${joinAlias}
          `;
        }
      } else {
        lateralSelect = `
        SELECT COALESCE(jsonb_agg(row_to_json(${joinAlias})), '[]'::jsonb) as ${this.astBuilder.pg.wrapIdentifier(joinAlias, undefined)}
        FROM (${subQuerySQL.sql}) as ${joinAlias}
      `;
      }

      const wrappedJoinAlias = this.astBuilder.pg.wrapIdentifier(
        joinAlias,
        undefined,
      );

      this.astBuilder.qb[joinType + 'Join'](
        this.astBuilder.pg.raw(
          `LATERAL (${lateralSelect}) as ${wrappedJoinAlias}`,
          subQuerySQL.bindings,
        ),
        this.astBuilder.pg.raw('TRUE'),
      );

      this.astBuilder.qb.select(joinAlias);
    }
  }

  private _buildJoinConditionSQL(
    expr: Expression,
    subQb: QueryBuilder
  ) {
    const ast = new ASTToQueryBuilder(subQb, this.astBuilder.pg)
    ast.applyFilters(expr, {})
    return subQb;
  }
}
