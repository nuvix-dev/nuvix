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
} from './types';
import { PG } from '@nuvix/pg';
import { JoinBuilder } from './join-builder';

type QueryBuilder = ReturnType<DataSource['queryBuilder']>;

export interface ASTToQueryBuilderOptions {
  tableName?: string;
  baseQuery?: QueryBuilder;
  allowUnsafeOperators?: boolean;
  maxNestingDepth?: number;
}

export class ASTToQueryBuilder<T extends QueryBuilder> {
  private readonly logger = new Logger(ASTToQueryBuilder.name);
  public qb: T;
  public pg: DataSource;
  private nestingDepth = 0;
  private readonly maxNestingDepth: number;
  private readonly allowUnsafeOperators: boolean;
  private anyAllsupportedOperators = [
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
    qb.debug(true); // Enable debug mode for query logging
    this.pg = pg;
    this.maxNestingDepth = options.maxNestingDepth || 10;
    this.allowUnsafeOperators = options.allowUnsafeOperators || false;
  }

  /**
   *apply AST expression to QueryBuilder conditions
   */
  applyFilters(
    expression?: Expression,
    options: ASTToQueryBuilderOptions = {},
  ): QueryBuilder {
    if (!expression) {
      return this.qb;
    }

    try {
      this.nestingDepth = 0;
      return this._convertExpression(expression, this.qb);
    } catch (error) {
      if (error instanceof Error) {
        throw new Exception(
          Exception.GENERAL_QUERY_BUILDER_ERROR,
          `Query builder conversion error: ${error.message}`,
        );
      }
      throw new Error('Unknown query builder conversion error');
    }
  }

  /**
   *apply select nodes to QueryBuilder select clauses
   */
  applySelect(selectNodes: SelectNode[], queryBuilder = this.qb): QueryBuilder {
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
      this._handleEmbedNode(embed, queryBuilder);
    });

    return queryBuilder;
  }

  /**
   *apply ordering to QueryBuilder order clauses
   */
  applyOrder(orderings: ParsedOrdering[], table: string): T {
    if (!orderings || orderings.length === 0) {
      return this.qb;
    }

    orderings.forEach(ordering => {
      const { path, direction, nulls } = ordering;

      if (nulls) {
        // Handle NULLS FIRST/LAST
        const nullsClause =
          nulls === 'nullsfirst' ? 'NULLS FIRST' : 'NULLS LAST';
        this.qb.orderByRaw(`?? ${direction.toUpperCase()} ${nullsClause}`, [
          path,
        ]);
      } else {
        this.qb.orderBy(this._rawField(path, table).toSQL().sql, direction);
      }
    });

    return this.qb;
  }

  private _convertExpression(
    expression: Expression,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    if (!expression) {
      return queryBuilder;
    }

    // Check nesting depth to prevent stack overflow
    if (this.nestingDepth > this.maxNestingDepth) {
      throw new Error(
        `Maximum nesting depth of ${this.maxNestingDepth} exceeded`,
      );
    }

    this.nestingDepth++;

    try {
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

      throw new Error(`Unknown expression type: ${JSON.stringify(expression)}`);
    } finally {
      this.nestingDepth--;
    }
  }

  private _applyCondition(
    condition: Condition,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    const { field: _field, operator, value, values, tableName } = condition;

    if (!_field || !operator) {
      throw new Error('Condition must have both field and operator');
    }

    // Validate operator if safety is enabled
    if (!this.allowUnsafeOperators && !this._isKnownOperator(operator)) {
      this.logger.warn(
        `Unknown operator: ${operator}, proceeding with caution`,
      );
    }

    const field = this._rawField(_field, tableName) as unknown as ReturnType<
      PG['raw']
    >;
    const fieldSql = field.toSQL().sql;

    // Check for ANY/ALL pattern with 3 values
    if (
      values &&
      Array.isArray(values) &&
      values.length >= 2 &&
      this.anyAllsupportedOperators.includes(operator)
    ) {
      const [modifier, ...operatorValues] = values;
      if (modifier === 'any' || modifier === 'all') {
        return this._applyAnyAllCondition(
          field,
          operator,
          modifier,
          operatorValues,
          queryBuilder,
        );
      }
    }

    switch (operator) {
      // Basic comparisons
      case 'eq':
        return queryBuilder.where(field, '=', value);
      case 'gt':
        return queryBuilder.where(field, '>', value);
      case 'gte':
        return queryBuilder.where(field, '>=', value);
      case 'lt':
        return queryBuilder.where(field, '<', value);
      case 'lte':
        return queryBuilder.where(field, '<=', value);
      case 'ne':
      case 'neq':
        return queryBuilder.where(field, '<>', value);

      // Pattern matching
      case 'like':
        return queryBuilder.where(field, 'like', value);
      case 'ilike':
        return queryBuilder.where(field, 'ilike', value);
      case 'match':
        return queryBuilder.whereRaw(`?? ~ ?`, [field, value]);
      case 'imatch':
        return queryBuilder.whereRaw(`?? ~* ?`, [field, value]);

      // IN operator
      case 'in':
        if (!values || !Array.isArray(values)) {
          throw new Error('IN operator requires an array of values');
        }
        return queryBuilder.whereIn(fieldSql, values);

      // IS operator
      case 'is':
        if (value === null || value === 'null') {
          return queryBuilder.whereNull(fieldSql);
        } else if (value === 'not_null') {
          return queryBuilder.whereNotNull(fieldSql);
        } else if (value === true || value === 'true') {
          return queryBuilder.where(fieldSql, true);
        } else if (value === false || value === 'false') {
          return queryBuilder.where(fieldSql, false);
        } else if (value === 'unknown') {
          return queryBuilder.whereRaw(`?? IS UNKNOWN`, [fieldSql]);
        }
        return queryBuilder.where(fieldSql, value);

      // IS DISTINCT FROM
      case 'isdistinct':
        return queryBuilder.whereRaw(`?? IS DISTINCT FROM ?`, [
          fieldSql,
          value,
        ]);

      // Full-Text Search operators
      case 'fts':
        if (Array.isArray(values) && values.length >= 2) {
          // Support language specification: [language, query] or [language, query, config]
          const [language, query, config] = values;
          return queryBuilder.whereRaw(`to_tsvector(?, ??) @@ to_tsquery(?)`, [
            language,
            field,
            query,
          ]);
        }
        return queryBuilder.whereRaw(`to_tsvector(??) @@ to_tsquery(?)`, [
          field,
          value,
        ]);
      case 'plfts':
        if (Array.isArray(values) && values.length >= 2) {
          // Support language specification: [language, query]
          const [language, query] = values;
          return queryBuilder.whereRaw(
            `to_tsvector(?, ??) @@ plainto_tsquery(?, ?)`,
            [language, field, language, query],
          );
        }
        return queryBuilder.whereRaw(`to_tsvector(??) @@ plainto_tsquery(?)`, [
          field,
          value,
        ]);
      case 'phfts':
        if (Array.isArray(values) && values.length >= 2) {
          // Support language specification: [language, query]
          const [language, query] = values;
          return queryBuilder.whereRaw(
            `to_tsvector(?, ??) @@ phraseto_tsquery(?, ?)`,
            [language, field, language, query],
          );
        }
        return queryBuilder.whereRaw(`to_tsvector(??) @@ phraseto_tsquery(?)`, [
          field,
          value,
        ]);
      case 'wfts':
        if (Array.isArray(values) && values.length >= 2) {
          // Support language specification: [language, query]
          const [language, query] = values;
          return queryBuilder.whereRaw(
            `to_tsvector(?, ??) @@ websearch_to_tsquery(?, ?)`,
            [language, field, language, query],
          );
        }
        return queryBuilder.whereRaw(
          `to_tsvector(??) @@ websearch_to_tsquery(?)`,
          [field, value],
        );

      // Array/JSON operators
      case 'cs': // contains
        return queryBuilder.whereRaw(`?? @> ?`, [
          field,
          JSON.stringify(values || value),
        ]);
      case 'cd': // contained in
        return queryBuilder.whereRaw(`?? <@ ?`, [
          field,
          JSON.stringify(values || value),
        ]);
      case 'ov': // overlaps
        return queryBuilder.whereRaw(`?? && ?`, [
          field,
          JSON.stringify(values || value),
        ]);

      // Range operators
      case 'sl': // strictly left of
        return queryBuilder.whereRaw(`?? << ?`, [field, value]);
      case 'sr': // strictly right of
        return queryBuilder.whereRaw(`?? >> ?`, [field, value]);
      case 'nxr': // does not extend to the right of
        return queryBuilder.whereRaw(`?? &< ?`, [field, value]);
      case 'nxl': // does not extend to the left of
        return queryBuilder.whereRaw(`?? &> ?`, [field, value]);
      case 'adj': // is adjacent to
        return queryBuilder.whereRaw(`?? -|- ?`, [field, value]);

      // Operator modifiers
      case 'all':
        if (!values || !Array.isArray(values)) {
          throw new Error('ALL operator requires an array of values');
        }
        return queryBuilder.whereRaw(`?? = ALL(?)`, [field, values]);
      case 'any':
        if (!values || !Array.isArray(values)) {
          throw new Error('ANY operator requires an array of values');
        }
        return queryBuilder.whereRaw(`?? = ANY(?)`, [field, values]);

      case 'between':
        if (!values || !Array.isArray(values) || values.length !== 2) {
          throw new Error('BETWEEN operator requires exactly 2 values');
        }
        return queryBuilder.whereBetween(fieldSql, values as any);
      case 'regex':
        return queryBuilder.whereRaw(`?? ~ ?`, [field, value]);
      case 'iregex':
        return queryBuilder.whereRaw(`?? ~* ?`, [field, value]);
      case 'not_regex':
        return queryBuilder.whereRaw(`?? !~ ?`, [field, value]);
      case 'not_iregex':
        return queryBuilder.whereRaw(`?? !~* ?`, [field, value]);

      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  public _rawField(
    _field: Condition['field'],
    table: string,
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

        if (typeof part === 'string') {
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
          sqlParts.push(part.operator);
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

  private _isKnownOperator(operator: string): boolean {
    const knownOperators = [
      // Basic comparisons
      'eq',
      'gt',
      'gte',
      'lt',
      'lte',
      'neq',
      'ne',
      // Pattern matching
      'like',
      'ilike',
      'match',
      'imatch',
      // List operations
      'in',
      'is',
      'isdistinct',
      // Full-text search
      'fts',
      'plfts',
      'phfts',
      'wfts',
      // Array/JSON operations
      'cs',
      'cd',
      'ov',
      // Range operations
      'sl',
      'sr',
      'nxr',
      'nxl',
      'adj',
      // Logical operators
      'not',
      'or',
      'and',
      // Legacy operators
      'between',
      'regex',
      'iregex',
      'not_regex',
      'not_iregex',
    ];
    return knownOperators.includes(operator);
  }

  /**
   * Handle ANY/ALL conditions for specific operators
   * Creates OR conditions for 'any' and AND conditions for 'all'
   */
  private _applyAnyAllCondition(
    field: ReturnType<PG['raw']>,
    operator: string,
    modifier: 'any' | 'all',
    operatorValues: any[],
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    if (modifier === 'any') {
      // ANY creates OR conditions
      return queryBuilder.where(builder => {
        operatorValues.forEach((val, index) => {
          if (index === 0) {
            this._applySingleOperatorCondition(field, operator, val, builder);
          } else {
            builder.orWhere(subBuilder => {
              this._applySingleOperatorCondition(
                field,
                operator,
                val,
                subBuilder,
              );
            });
          }
        });
      });
    } else {
      // ALL creates AND conditions
      return queryBuilder.where(builder => {
        operatorValues.forEach(val => {
          this._applySingleOperatorCondition(field, operator, val, builder);
        });
      });
    }
  }

  /**
   * Apply a single operator condition (helper for ANY/ALL)
   */
  private _applySingleOperatorCondition(
    field: ReturnType<PG['raw']>,
    operator: string,
    value: any,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    switch (operator) {
      case 'eq':
        return queryBuilder.where(field, '=', value);
      case 'like':
        return queryBuilder.where(field, 'like', value);
      case 'ilike':
        return queryBuilder.where(field, 'ilike', value);
      case 'gt':
        return queryBuilder.where(field, '>', value);
      case 'gte':
        return queryBuilder.where(field, '>=', value);
      case 'lt':
        return queryBuilder.where(field, '<', value);
      case 'lte':
        return queryBuilder.where(field, '<=', value);
      case 'match':
        return queryBuilder.whereRaw(`?? ~ ?`, [field, value]);
      case 'imatch':
        return queryBuilder.whereRaw(`?? ~* ?`, [field, value]);
      default:
        throw new Error(`Unsupported operator for ANY/ALL: ${operator}`);
    }
  }

  /**
   * Build column select string with alias and cast
   */
  private _buildColumnSelect(node: ColumnNode) {
    const rawPath = this._rawField(node.path, node.tableName).toSQL().sql;
    const casted = node.cast ? `CAST((${rawPath}) AS ${node.cast})` : rawPath;
    return this.pg.raw(`${casted}${node.alias ? ` as "${node.alias}"` : ''}`);
  }

  /**
   * Handle embed node (subqueries/joins)
   */
  private _handleEmbedNode(embed: EmbedNode, qb: QueryBuilder): void {
    const { resource, alias, flatten } = embed;

    try {
      const joinBuilder = new JoinBuilder(this);
      joinBuilder.applyEmbedNode(embed);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to handle embed node for ${resource}: ${errorMessage}`,
      );
      throw new Exception(
        Exception.GENERAL_QUERY_BUILDER_ERROR,
        `Embed node processing failed: ${errorMessage}`,
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
