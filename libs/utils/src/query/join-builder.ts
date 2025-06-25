import { Logger } from '@nestjs/common';
import { PG } from '@nuvix/pg';
import {
  Condition,
  Expression,
} from './types';
import { Exception } from '@nuvix/core/extend/exception';
import { ASTToQueryBuilder } from './builder';

export class JoinBuilder<T extends ASTToQueryBuilder<any>> {
  private readonly logger = new Logger(JoinBuilder.name);
  private readonly astBuilder: T;
  private nestingDepth = 0;
  private readonly maxDepth = 10;
  private tableName: string;
  private mainTable: string;

  constructor(astBuilder: T, tableName: string, mainTable: string) {
    this.astBuilder = astBuilder;
    this.tableName = tableName;
    this.mainTable = mainTable;
  }

  public buildJoinSQL(expression?: Expression): ReturnType<PG['raw']> {
    if (!expression) return this.astBuilder.pg.raw('TRUE') as any;

    try {
      this.nestingDepth = 0;
      const { sql, bindings } = this._convert(expression);
      return this.astBuilder.pg.raw(sql, bindings) as any;
    } catch (error) {
      if (error instanceof Error) {
        throw new Exception(
          Exception.GENERAL_QUERY_BUILDER_ERROR,
          `JoinBuilder error: ${error.message}`,
        );
      }
      throw new Error('Unknown JoinBuilder error');
    }
  }

  private _convert(expr: Expression): { sql: string; bindings: any[] } {
    if (this.nestingDepth++ > this.maxDepth) {
      throw new Error(`Exceeded max nesting depth (${this.maxDepth})`);
    }

    let result: { sql: string; bindings: any[] };

    if (ASTToQueryBuilder._isCondition(expr)) {
      result = this._conditionToSQL(expr);
    } else if (ASTToQueryBuilder._isAndExpression(expr)) {
      result = this._logicToSQL(expr.and, 'AND');
    } else if (ASTToQueryBuilder._isOrExpression(expr)) {
      result = this._logicToSQL(expr.or, 'OR');
    } else if (ASTToQueryBuilder._isNotExpression(expr)) {
      const inner = this._convert(expr.not);
      result = { sql: `NOT (${inner.sql})`, bindings: inner.bindings };
    } else {
      throw new Error(`Unknown expression: ${JSON.stringify(expr)}`);
    }

    this.nestingDepth--;
    return result;
  }

  private _logicToSQL(expressions: Expression[], operator: 'AND' | 'OR') {
    const parts: string[] = [];
    const bindings: any[] = [];

    for (const expr of expressions) {
      const converted = this._convert(expr);
      parts.push(`(${converted.sql})`);
      bindings.push(...converted.bindings);
    }

    return {
      sql: parts.join(` ${operator} `),
      bindings,
    };
  }

  private _conditionToSQL(cond: Condition): { sql: string; bindings: any[] } {
    const { field, operator, value, values, tableName } = cond;

    if (!field || !operator) {
      throw new Error('Invalid condition: missing field/operator');
    }

    const left = this.astBuilder._rawField(field, tableName).toSQL().sql;
    const right = (values.length === 2 && values[0] === '?') ? '?' : this.astBuilder._rawField(values.length ? values.slice(1) : value, values.length ? values[0] : this.mainTable).toSQL().sql;
    const bindings = (values.length === 2 && values[0] === '?') ? [value] : [];
    switch (operator) {
      case 'eq':
        return { sql: `${left} = ${right}`, bindings };
      case 'ne':
      case 'neq':
        return { sql: `${left} <> ${right}`, bindings };
      case 'gt':
        return { sql: `${left} > ${right}`, bindings };
      case 'gte':
        return { sql: `${left} >= ${right}`, bindings };
      case 'lt':
        return { sql: `${left} < ${right}`, bindings };
      case 'lte':
        return { sql: `${left} <= ${right}`, bindings };

      case 'like':
        return { sql: `${left} LIKE ?`, bindings: [value] };
      case 'ilike':
        return { sql: `${left} ILIKE ?`, bindings: [value] };

      case 'in':
        if (!Array.isArray(values)) throw new Error('IN requires an array');
        const placeholders = values.map(() => '?').join(', ');
        return { sql: `${left} IN (${placeholders})`, bindings: values };

      case 'between':
        if (!Array.isArray(values) || values.length !== 2) {
          throw new Error('BETWEEN requires exactly 2 values');
        }
        return { sql: `${left} BETWEEN ? AND ?`, bindings: values };

      case 'is':
        if (value === 'null') return { sql: `${left} IS NULL`, bindings: [] };
        if (value === 'not_null')
          return { sql: `${left} IS NOT NULL`, bindings: [] };
        if (value === 'true') return { sql: `${left} IS TRUE`, bindings: [] };
        if (value === 'false') return { sql: `${left} IS FALSE`, bindings: [] };
        throw new Error(`Unsupported IS value: ${value}`);

      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }
}
