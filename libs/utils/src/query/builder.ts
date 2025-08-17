import { DataSource } from '@nuvix/pg';
import { Logger } from '@nestjs/common';
import { Exception } from '@nuvix/core/extend/exception';
import type {
  Expression,
  Condition,
  NotExpression,
  OrExpression,
  AndExpression,
  ColumnNode,
  EmbedNode,
  SelectNode,
  ParsedOrdering,
  ValueType,
  ParserResult,
} from './types';
import { PG } from '@nuvix/pg';
import { JoinBuilder } from './join-builder';

type QueryBuilder = ReturnType<DataSource['queryBuilder']>;

export interface ASTToQueryBuilderOptions {
  applyExtra?: boolean;
  tableName?: string;
  baseQuery?: QueryBuilder;
  allowUnsafeOperators?: boolean;
  maxNestingDepth?: number;
  throwOnEmpty?: boolean;
  throwOnEmptyError?: Exception;
}

export class ASTToQueryBuilder<T extends QueryBuilder> {
  private readonly logger = new Logger(ASTToQueryBuilder.name);
  public readonly qb: T;
  public readonly pg: DataSource;
  public readonly allowedSchemas: string[] = [];
  private readonly anyAllsupportedOperators = [
    'eq',
    'like',
    'ilike',
    'gt',
    'gte',
    'lt',
    'lte',
    'match',
    'imatch',
  ];

  constructor(qb: T, pg: DataSource, options: ASTToQueryBuilderOptions = {}) {
    this.qb = qb;
    this.pg = pg;
  }

  /**
   *apply AST expression to QueryBuilder conditions
   */
  applyFilters(
    {
      limit,
      offset,
      group,
      order,
      shape,
      ...expression
    }: Expression & ParserResult = {} as any,
    options: ASTToQueryBuilderOptions = {},
  ): QueryBuilder {
    try {
      if (options.applyExtra) {
        this.applyLimitOffset({
          limit,
          offset,
        });
        this.applyOrder(order, options.tableName);
        this.applyGroupBy(group, options.tableName);
      }

      if (!expression || Object.keys(expression).length === 0) {
        if (options.throwOnEmpty) {
          const error = options.throwOnEmptyError
            ? options.throwOnEmptyError
            : new Exception(
                Exception.GENERAL_PARSER_EMPTY_ERROR,
                'Empty expression provided',
              );
          throw error;
        }
        return this.qb;
      }

      return this._convertExpression(expression, this.qb);
    } catch (error) {
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error('Unknown query builder conversion error');
    }
  }

  /**
   *apply select nodes to QueryBuilder select clauses
   */
  applySelect(
    selectNodes: SelectNode[] = [],
    queryBuilder = this.qb,
  ): QueryBuilder {
    if (!selectNodes || selectNodes.length === 0) {
      return queryBuilder;
    }

    const selectColumns: any[] = [];
    const embeds: EmbedNode[] = [];

    selectNodes.forEach(node => {
      if (node.type === 'column') {
        selectColumns.push(this._buildColumnSelect(node));
      } else if (node.type === 'embed') {
        embeds.push(node);
      }
    });

    // Add column selections
    if (selectColumns.length > 0) {
      queryBuilder.select(selectColumns);
    }

    // Handle embeds (subqueries/joins)
    embeds.forEach(embed => {
      this._handleEmbedNode(embed);
    });

    return queryBuilder;
  }

  /**
   *apply ordering to QueryBuilder order clauses
   */
  applyOrder(orderings: ParsedOrdering[] = [], table: string = ''): T {
    if (!orderings || orderings.length === 0) {
      return this.qb;
    }

    orderings.forEach(ordering => {
      const { path, direction, nulls } = ordering;

      if (nulls) {
        // Handle NULLS FIRST/LAST
        const nullsClause =
          nulls === 'nullsfirst' ? 'nulls first' : 'nulls last';
        this.qb.orderByRaw(`?? ${direction.toLowerCase()} ${nullsClause}`, [
          this._rawField(path, table),
        ]);
      } else {
        this.qb.orderByRaw(`?? ${direction.toLowerCase()}`, [
          this._rawField(path, table),
        ]);
      }
    });

    return this.qb;
  }

  /**
   * Apply GROUP BY clauses to the QueryBuilder
   */
  applyGroupBy(columns?: Condition['field'][], tableName?: string) {
    if (columns && columns.length) {
      const _columns = columns.map(
        column => this._rawField(column, tableName).toSQL().sql,
      );
      this.qb.groupByRaw(_columns.join(', '));
    }
    return this.qb;
  }

  /**
   * Apply LIMIT and OFFSET to the QueryBuilder
   */
  applyLimitOffset({
    limit,
    offset,
  }: {
    limit?: number | string;
    offset?: number | string;
  }) {
    limit =
      typeof limit === 'number'
        ? limit
        : typeof limit === 'string'
          ? Number(limit)
          : undefined;
    offset =
      typeof offset === 'number'
        ? offset
        : typeof offset === 'string'
          ? Number(offset)
          : undefined;

    if (Number.isInteger(limit)) this.qb.limit(limit as number);
    if (Number.isInteger(offset)) this.qb.limit(offset as number);

    return this.qb;
  }

  /**
   * Apply returning select nodes to QueryBuilder
   */
  applyReturning(
    selectNodes: SelectNode[] = [],
    queryBuilder = this.qb,
  ): QueryBuilder {
    if (!selectNodes || selectNodes.length === 0) {
      queryBuilder.returning('*');
      return queryBuilder;
    }

    const selectColumns: any[] = [];

    selectNodes.forEach(node => {
      if (node.type === 'column') {
        selectColumns.push(this._buildColumnSelect(node));
      } else if (node.type === 'embed') {
        throw new Exception(
          Exception.GENERAL_PARSER_ERROR,
          'Embeds are not supported in returning clause',
        );
      }
    });

    if (selectColumns.length > 0) {
      queryBuilder.returning(selectColumns);
    } else {
      queryBuilder.returning('*');
    }

    return queryBuilder;
  }

  private _convertExpression(
    expression: Expression,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    if (!expression) {
      return queryBuilder;
    }

    if (ASTToQueryBuilder._isCondition(expression)) {
      return this._applyCondition(expression, queryBuilder);
    }

    if (ASTToQueryBuilder._isNotExpression(expression)) {
      return this._applyNotExpression(expression, queryBuilder);
    }

    if (ASTToQueryBuilder._isOrExpression(expression)) {
      return this._applyOrExpression(expression, queryBuilder);
    }

    if (ASTToQueryBuilder._isAndExpression(expression)) {
      return this._applyAndExpression(expression, queryBuilder);
    }

    throw new Error(
      `Unsupported expression type: ${JSON.stringify(expression)}`,
    );
  }

  private _applyCondition(
    condition: Condition,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    const { field: _field, operator, values = [], tableName } = condition;

    if (!_field || !operator) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        'Condition must have both column and operator',
      );
    }

    const field = this._rawField(_field, tableName) as unknown as ReturnType<
      PG['raw']
    >;

    // ANY/ALL modifiers
    if (
      Array.isArray(values) &&
      values.length >= 2 &&
      this.anyAllsupportedOperators.includes(operator)
    ) {
      const [modifier, ...restValues] = values;
      if (modifier === 'any' || modifier === 'all') {
        return this._applyAnyAllCondition(
          field,
          operator,
          modifier,
          restValues,
          queryBuilder,
        );
      }
    }

    const filteredValues = values.filter(v => !this._isValueColumnName(v));
    const right = this._valueTypeToPlaceholder(values);
    let value = values[0];

    if (
      typeof value === 'object' &&
      value !== null &&
      '__type' in value &&
      value.__type === 'column' &&
      right === '??'
    ) {
      value = value.name;
    }

    switch (operator) {
      case 'eq':
        return queryBuilder.whereRaw(`?? = ${right}`, [field, value]);
      case 'gt':
        return queryBuilder.whereRaw(`?? > ${right}`, [field, value]);
      case 'gte':
        return queryBuilder.whereRaw(`?? >= ${right}`, [field, value]);
      case 'lt':
        return queryBuilder.whereRaw(`?? < ${right}`, [field, value]);
      case 'lte':
        return queryBuilder.whereRaw(`?? <= ${right}`, [field, value]);
      case 'neq':
        return queryBuilder.whereRaw(`?? <> ${right}`, [field, value]);
      case 'like':
        return queryBuilder.whereRaw(`?? like ?`, [
          field,
          this._valueToPattern(value),
        ]);
      case 'ilike':
        return queryBuilder.whereRaw(`?? ilike ?`, [
          field,
          this._valueToPattern(value),
        ]);
      case 'match':
        return queryBuilder.whereRaw(`?? ~ ?`, [
          field,
          this._valueToPattern(value),
        ]);
      case 'imatch':
        return queryBuilder.whereRaw(`?? ~* ?`, [
          field,
          this._valueToPattern(value),
        ]);
      case 'in':
        return queryBuilder.whereRaw(`?? in (?)`, [field, filteredValues]);
      case 'notin':
        return queryBuilder.whereRaw(`?? not in (?)`, [field, filteredValues]);

      case 'is':
      case 'isnot':
        switch (String(value)) {
          case 'null':
            return queryBuilder.whereRaw(`?? is null`, [field]);
          case 'not_null':
            return queryBuilder.whereRaw(`?? is not null`, [field]);
          case 'true':
            return queryBuilder.whereRaw(`?? is true`, [field]);
          case 'false':
            return queryBuilder.whereRaw(`?? is false`, [field]);
          case 'unknown':
            return queryBuilder.whereRaw(`?? is unknown`, [field]);
          default:
            throw new Exception(
              Exception.GENERAL_PARSER_ERROR,
              `Unsupported IS condition: ${value}`,
            );
        }

      case 'null':
        return queryBuilder.whereRaw(`?? is null`, [field]);
      case 'notnull':
        return queryBuilder.whereRaw(`?? is not null`, [field]);
      case 'isdistinct':
        return queryBuilder.whereRaw(`?? is distinct from ${right}`, [
          field,
          value,
        ]);

      // Full-text search
      case 'fts':
        return this._applyFts(field, values, 'to_tsquery', queryBuilder);
      case 'plfts':
        return this._applyFts(field, values, 'plainto_tsquery', queryBuilder);
      case 'phfts':
        return this._applyFts(field, values, 'phraseto_tsquery', queryBuilder);
      case 'wfts':
        return this._applyFts(
          field,
          values,
          'websearch_to_tsquery',
          queryBuilder,
        );

      // Array/JSON
      case 'cs':
        return queryBuilder.whereRaw(`?? @> ?`, [
          field,
          JSON.stringify(values),
        ]);
      case 'cd':
        return queryBuilder.whereRaw(`?? <@ ?`, [
          field,
          JSON.stringify(values),
        ]);
      case 'ov':
        return queryBuilder.whereRaw(`?? && ?`, [
          field,
          JSON.stringify(values),
        ]);

      // Range
      case 'sl':
        return queryBuilder.whereRaw(`?? << ?`, [field, filteredValues]);
      case 'sr':
        return queryBuilder.whereRaw(`?? >> ?`, [field, filteredValues]);
      case 'nxl':
        return queryBuilder.whereRaw(`?? &> ?`, [field, filteredValues]);
      case 'nxr':
        return queryBuilder.whereRaw(`?? &< ?`, [field, filteredValues]);
      case 'adj':
        return queryBuilder.whereRaw(`?? -|- ?`, [field, filteredValues]);

      // Modifiers
      case 'all':
        return queryBuilder.whereRaw(`?? = all(?)`, [field, filteredValues]);
      case 'any':
        return queryBuilder.whereRaw(`?? = any(?)`, [field, filteredValues]);

      case 'between':
        if (values.length !== 2) {
          throw new Exception(
            Exception.GENERAL_PARSER_ERROR,
            `'between' operator expects exactly two values.`,
          );
        }
        return queryBuilder.whereRaw(`?? between ? and ?`, [
          field,
          values[0],
          values[1],
        ]);

      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  private _applyFts(
    field: ReturnType<PG['raw']>,
    values: any[],
    tsFunction:
      | 'to_tsquery'
      | 'plainto_tsquery'
      | 'phraseto_tsquery'
      | 'websearch_to_tsquery',
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    if (values.length >= 2) {
      const [language, query] = values;
      return queryBuilder.whereRaw(
        `to_tsvector(?, ??) @@ ${tsFunction}(?, ?)`,
        [language, field, language, query],
      );
    } else {
      return queryBuilder.whereRaw(`to_tsvector(??) @@ ${tsFunction}(?)`, [
        field,
        values[0],
      ]);
    }
  }

  private _valueToPattern(value: any): string {
    return String(value).replaceAll('*', '%');
  }

  private _isValueColumnName(
    value: Condition['values'][number],
  ): value is ValueType {
    if (
      value !== null &&
      typeof value === 'object' &&
      '__type' in value &&
      value.__type === 'column'
    )
      return true;
    else return false;
  }

  private _valueTypeToPlaceholder(values: Condition['values']): '?' | '??' {
    if (this._isValueColumnName(values[0])) {
      return '??';
    } else {
      return '?';
    }
  }

  public _rawField(
    _field: Condition['field'],
    table?: string,
  ): ReturnType<(typeof this.pg)['raw']> {
    if (typeof _field === 'string') {
      return this.pg.raw('??.??', [table, _field]);
    } else if (Array.isArray(_field)) {
      // Handle complex field paths with JSON operators
      const sqlParts: string[] = [];
      const bindings: any[] = [];

      for (let i = 0; i < _field.length; i++) {
        const part = _field[i];
        const isLastPart = i === _field.length - 1;
        const hasObjectPartsBefore = _field
          .slice(0, i)
          .some(p => typeof p === 'object' && 'operator' in p);

        if (typeof part === 'string' || typeof part === 'number') {
          const isAfterOperator =
            i > 0 &&
            _field
              .slice(0, i)
              .some(p => typeof p === 'object' && 'operator' in p);

          if (isAfterOperator) {
            // Try to convert to number if possible
            const numericValue = Number(part);
            if (!isNaN(numericValue) && isFinite(numericValue)) {
              sqlParts.push(part);
            } else {
              sqlParts.push(`'${part}'`);
            }
          } else {
            sqlParts.push(`"${part}"`);
          }

          // Add dot separator only if not last part
          if (!isLastPart) {
            sqlParts.push('.');
          }
        } else if (typeof part === 'object' && 'operator' in part) {
          // Handle JSON operators (->, ->>)
          if (isLastPart)
            throw new Exception(
              Exception.GENERAL_PARSER_ERROR,
              'Invalid syntax, should be string or number after `->` or `->>`',
            );
          if (!hasObjectPartsBefore) {
            sqlParts.push(`"${part.name}"`);
          } else {
            // Try to convert to number if possible when i > 0
            const numericValue = Number(part.name);
            if (!isNaN(numericValue) && isFinite(numericValue)) {
              sqlParts.push(part.name);
            } else {
              sqlParts.push(`'${part.name}'`);
            }
          }
          sqlParts.push(part.operator as string);
        }
      }

      return this.pg.raw(sqlParts.join(''), bindings);
    } else {
      throw new Error('Invalid field type: field must be string or array');
    }
  }

  private _applyNotExpression(
    notExpression: NotExpression,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    return queryBuilder.whereNot(builder => {
      this._convertExpression(notExpression.not, builder);
    });
  }

  private _applyOrExpression(
    orExpression: OrExpression,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    if (!orExpression.or || orExpression.or.length === 0) {
      return queryBuilder;
    }

    return queryBuilder.where(builder => {
      orExpression.or.forEach((expr, index) => {
        if (index === 0) {
          this._convertExpression(expr, builder);
        } else {
          builder.orWhere(subBuilder => {
            this._convertExpression(expr, subBuilder);
          });
        }
      });
    });
  }

  private _applyAndExpression(
    andExpression: AndExpression,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    if (!andExpression.and || andExpression.and.length === 0) {
      return queryBuilder;
    }

    andExpression.and.forEach(expr => {
      this._convertExpression(expr, queryBuilder);
    });

    return queryBuilder;
  }

  /**
   * Applies ANY/ALL conditions using supported operators.
   * Wraps the expression in the appropriate Postgres `any()` or `all()` syntax.
   */
  private _applyAnyAllCondition(
    field: ReturnType<PG['raw']>,
    operator: string,
    modifier: 'any' | 'all',
    operatorValues: any[],
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    modifier = modifier.toLowerCase() as typeof modifier;

    const operatorMap: Record<string, string> = {
      eq: '=',
      like: 'like',
      ilike: 'ilike',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
      match: '~',
      imatch: '~*',
    };

    const sqlOperator = operatorMap[operator];
    if (!sqlOperator) {
      throw new Error(`Unsupported operator for ANY/ALL: ${operator}`);
    }
    if (operator === 'like' || operator === 'ilike') {
      operatorValues.map(v => this._valueToPattern(v));
    }

    return queryBuilder.whereRaw(`?? ${sqlOperator} ${modifier}(?)`, [
      field,
      operatorValues,
    ]);
  }

  /**
   * Build column select string with alias and cast, supporting aggregates and JSON paths.
   */
  private _buildColumnSelect({
    path,
    tableName,
    alias,
    cast,
    aggregate,
  }: ColumnNode) {
    // Auto-generate alias for JSON paths if not provided
    if (!alias && Array.isArray(path)) {
      const firstJsonPartIndex = path.findIndex(
        p => typeof p === 'object' && (p.__type === 'json' || p.operator),
      );
      if (firstJsonPartIndex !== -1) {
        alias = path
          .slice(firstJsonPartIndex)
          .map(p =>
            typeof p === 'string'
              ? p
              : typeof p === 'object' && p.name
                ? p.name
                : '',
          )
          .filter(Boolean)
          .join('_');
      }
    }

    const rawPath =
      aggregate && aggregate.fn === 'count' && path === '*'
        ? '*'
        : this._rawField(path, tableName).toSQL().sql;
    let sql = cast ? `cast((${rawPath}) as ${cast})` : rawPath;

    // Apply aggregate function if present
    if (aggregate) {
      sql = `${aggregate.fn}(${sql})`;
      if (aggregate.cast) {
        sql = `cast((${sql}) as ${aggregate.cast})`;
      }
    }

    if (alias) {
      return this.pg.raw(`${sql} as ??`, [alias]);
    }
    return this.pg.raw(sql);
  }

  /**
   * Handle embed node (subqueries/joins)
   */
  private _handleEmbedNode(embed: EmbedNode): void {
    const { resource } = embed;

    try {
      const joinBuilder = new JoinBuilder(this);
      joinBuilder.applyEmbedNode(embed);
    } catch (error) {
      if (error instanceof Exception) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to handle embed node for ${resource}: ${errorMessage}`,
      );
      throw new Exception(
        Exception.GENERAL_QUERY_BUILDER_ERROR,
        `Failed to handle embed node for ${resource}`,
      );
    }
  }

  // Type guards
  public static _isCondition(expression: Expression): expression is Condition {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'field' in expression &&
      'operator' in expression
    );
  }

  public static _isNotExpression(
    expression: Expression,
  ): expression is NotExpression {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'not' in expression
    );
  }

  public static _isOrExpression(
    expression: Expression,
  ): expression is OrExpression {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'or' in expression &&
      Array.isArray(expression.or)
    );
  }

  public static _isAndExpression(
    expression: Expression,
  ): expression is AndExpression {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'and' in expression &&
      Array.isArray(expression.and)
    );
  }
}
