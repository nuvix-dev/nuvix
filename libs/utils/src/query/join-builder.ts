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

    const joinAlias = alias || resource;
    const conditionSQL = this._buildJoinConditionSQL(
      constraint,
      joinAlias,
      mainTable,
    );

    if (flatten) {
      // TODO: --
      //  Flattened JOIN (leftJoin / innerJoin with direct field selections)
      this.astBuilder.qb[joinType + 'Join'](
        this.astBuilder.pg.alias(resource, joinAlias),
        this.astBuilder.pg.raw(conditionSQL.sql, conditionSQL.bindings),
      );

      const childAST = new ASTToQueryBuilder(
        this.astBuilder.qb,
        this.astBuilder.pg,
        {
          tableName: joinAlias,
        },
      );

      childAST.applySelect(select);
    } else {
      // Build the subquery for the embedded resource
      const subQb = this.astBuilder.pg.qb(
        this.astBuilder.pg.alias(resource, joinAlias),
      );

      const childAST = new ASTToQueryBuilder(subQb, this.astBuilder.pg, {
        tableName: resource,
      });
      childAST.applySelect(select);

      subQb.where(
        this.astBuilder.pg.raw(conditionSQL.sql, conditionSQL.bindings),
      );

      const subQuerySQL = subQb.toSQL();

      let wrapperSQL: string;
      let finalBindings: readonly any[] = [];

      // Determine the final JSON output structure based on 'shape' and count
      // This is done via a nested SELECT within the main SELECT
      // For 'object' shape, we dynamically switch between object and array based on count
      if (shape === 'object') {
        wrapperSQL = `
          (SELECT
              CASE
                  WHEN jsonb_array_length(result_array) = 1 THEN result_array -> 0
                  ELSE result_array
              END
          FROM (
              SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb) AS result_array
              FROM (${subQuerySQL.sql}) as q
          ) as agg_q)
        `;
        finalBindings = subQuerySQL.bindings;
      } else {
        wrapperSQL = `
          (SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb)
          FROM (${subQuerySQL.sql}) as q)
        `;
        finalBindings = subQuerySQL.bindings;
      }

      this.astBuilder.qb.select(
        this.astBuilder.pg.raw(
          `${wrapperSQL} as ${this.astBuilder.pg.wrapIdentifier(joinAlias, undefined)}`,
          finalBindings,
        ),
      );
    }
  }

  private _buildJoinConditionSQL(
    expr: Expression,
    leftTable: string,
    rightTable: string,
  ): { sql: string; bindings: any[] } {
    const result = this._convertExpression(expr, leftTable, rightTable, 0);
    return result;
  }

  private _convertExpression(
    expr: Expression,
    leftTable: string,
    rightTable: string,
    depth: number,
  ): { sql: string; bindings: any[] } {
    if (depth > this.maxDepth)
      throw new Error(`Join condition nesting too deep`);

    if (ASTToQueryBuilder._isCondition(expr)) {
      return this._conditionToSQL(expr as Condition, leftTable, rightTable);
    }

    if ('and' in expr) {
      const parts = expr.and.map(e =>
        this._convertExpression(e, leftTable, rightTable, depth + 1),
      );

      return {
        sql: parts.map(p => `(${p.sql})`).join(' AND '),

        bindings: parts.flatMap(p => p.bindings),
      };
    }

    if ('or' in expr) {
      const parts = expr.or.map(e =>
        this._convertExpression(e, leftTable, rightTable, depth + 1),
      );

      return {
        sql: parts.map(p => `(${p.sql})`).join(' OR '),

        bindings: parts.flatMap(p => p.bindings),
      };
    }

    if ('not' in expr) {
      const sub = this._convertExpression(
        expr.not,
        leftTable,
        rightTable,
        depth + 1,
      );

      return {
        sql: `NOT (${sub.sql})`,

        bindings: sub.bindings,
      };
    }

    throw new Error(`Unknown join expression`);
  }

  private _conditionToSQL(
    cond: Condition,
    leftTable: string,
    rightTable: string,
  ): { sql: string; bindings: any[] } {
    const { field, operator, value, values } = cond;

    if (!field || !operator) {
      throw new Error('Invalid condition: missing field/operator');
    }

    const leftField = this.astBuilder._rawField(field, leftTable).toSQL().sql;

    let rightField: string | undefined;

    const bindings: any[] = [];

    // TODO: handle in better way
    rightField = this.astBuilder._rawField(value, rightTable).toSQL().sql;

    switch (operator) {
      case 'eq':
        return {
          sql: `${leftField} = ${rightField ?? '?'}`,
          bindings: rightField ? [] : [value],
        };

      case 'ne':

      case 'neq':
        return {
          sql: `${leftField} <> ${rightField ?? '?'}`,
          bindings: rightField ? [] : [value],
        };

      case 'gt':
        return {
          sql: `${leftField} > ${rightField ?? '?'}`,
          bindings: rightField ? [] : [value],
        };

      case 'gte':
        return {
          sql: `${leftField} >= ${rightField ?? '?'}`,
          bindings: rightField ? [] : [value],
        };

      case 'lt':
        return {
          sql: `${leftField} < ${rightField ?? '?'}`,
          bindings: rightField ? [] : [value],
        };

      case 'lte':
        return {
          sql: `${leftField} <= ${rightField ?? '?'}`,
          bindings: rightField ? [] : [value],
        };

      case 'in':
        if (!Array.isArray(values)) throw new Error('IN requires array');
        const placeholders = values.map(() => '?').join(', ');
        return { sql: `${leftField} IN (${placeholders})`, bindings: values };

      case 'is':
        if (value === 'null')
          return { sql: `${leftField} IS NULL`, bindings: [] };

        if (value === 'not_null')
          return { sql: `${leftField} IS NOT NULL`, bindings: [] };

        throw new Error(`Unsupported IS value: ${value}`);

      case 'like':
        return { sql: `${leftField} LIKE ?`, bindings: [value] };

      case 'ilike':
        return { sql: `${leftField} ILIKE ?`, bindings: [value] };

      case 'between':
        if (!Array.isArray(values) || values.length !== 2)
          throw new Error('BETWEEN requires two values');

        return { sql: `${leftField} BETWEEN ? AND ?`, bindings: values };

      default:
        throw new Error(`Unsupported join operator: ${operator}`);
    }
  }
}
