import { Logger } from '@nestjs/common';
import { DataSource, PG } from '@nuvix/pg';
import { EmbedNode, Expression, Condition } from './types';
import { ASTToQueryBuilder } from './builder';

type QueryBuilder = ReturnType<DataSource['queryBuilder']>;

export class JoinBuilder<T extends ASTToQueryBuilder<QueryBuilder>> {
  private readonly logger = new Logger(JoinBuilder.name);
  private readonly astBuilder: T;
  private readonly maxDepth = 10;

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
    this.logger.debug('Applying EmbedNode:', embed); // Use logger for better debug output
    const joinAlias = alias || resource;
    const conditionSQL = this._buildJoinConditionSQL(
      constraint,
      joinAlias,
      mainTable,
    );

    if (flatten) {
      // ➕ Flattened JOIN (leftJoin / innerJoin with direct field selections)
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
      // ⚠️ Safe nested result with array or object (LATERAL / subquery)
      // Build the subquery for the embedded resource
      const subQb = this.astBuilder.pg.qb(
        this.astBuilder.pg.alias(resource, joinAlias),
      );

      // Apply select statements to the subquery
      const childAST = new ASTToQueryBuilder(subQb, this.astBuilder.pg, {
        tableName: resource, // tableName for context in child AST, but subQb is aliased
      });
      childAST.applySelect(select);

      // Apply WHERE condition to subquery
      subQb.where(
        this.astBuilder.pg.raw(conditionSQL.sql, conditionSQL.bindings),
      );

      // Capture the SQL and bindings for the subquery before aggregation
      const subQuerySQL = subQb.toSQL();

      let wrapperSQL: string;
      let finalBindings: readonly any[] = []; // Bindings for the final wrapped query

      // Determine the final JSON output structure based on 'shape' and count
      // This is done via a nested SELECT within the main SELECT
      // For 'object' shape, we dynamically switch between object and array based on count
      if (shape === 'object') {
        // Here's the core change: use a subquery to count and then conditionally aggregate
        // We'll wrap the existing subQuerySQL
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
        finalBindings = subQuerySQL.bindings; // Bindings from the original subquery are passed to this new nested select
      } else {
        // Default to array (shape === 'array' or undefined)
        // Ensure jsonb_agg returns an empty array if no results, not NULL
        wrapperSQL = `
          (SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb)
          FROM (${subQuerySQL.sql}) as q)
        `;
        finalBindings = subQuerySQL.bindings; // Bindings from the original subquery
      }

      // Final SELECT AS alias
      // The wrapped SQL becomes a column in the main query's SELECT statement
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

  // Minor improvement in _conditionToSQL:
  // Consider if `value` could genuinely be a non-string that includes '.' but isn't a field.
  // The current logic `typeof value === 'string' && value.includes('.')` for `rightField`
  // seems to correctly imply it's a field reference. Your removed comment hints at this.
  // I've kept your current behavior.
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

    // if (typeof value === 'string' && value.includes('.')) {

    rightField = this.astBuilder._rawField(value, rightTable).toSQL().sql;

    // }

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
