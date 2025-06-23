import { type DataSource } from '@nuvix/pg';
import { Logger } from '@nestjs/common';
import { Exception } from '@nuvix/core/extend/exception';
import {
  Expression,
  Condition,
  NotExpression,
  OrExpression,
  AndExpression,
} from './parser';

type QueryBuilder = ReturnType<DataSource['queryBuilder']>;

interface ParsedOrdering {
  path: string;
  direction: 'asc' | 'desc';
  nulls: 'nullsfirst' | 'nullslast' | null;
}

interface ColumnNode {
  type: 'column';
  path: string;
  alias: string | null;
  cast: string | null;
}

interface EmbedNode {
  type: 'embed';
  resource: string;
  constraint: string | null;
  alias: string | null;
  select: SelectNode[];
}

type SelectNode = ColumnNode | EmbedNode;

export interface ASTToQueryBuilderOptions {
  tableName?: string;
  baseQuery?: QueryBuilder;
  allowUnsafeOperators?: boolean;
  maxNestingDepth?: number;
}

export class ASTToQueryBuilder {
  private readonly logger = new Logger(ASTToQueryBuilder.name);
  private nestingDepth = 0;
  private readonly maxNestingDepth: number;
  private readonly allowUnsafeOperators: boolean;
  private anyAllsupportedOperators = ['eq', 'like', 'ilike', 'gt', 'gte', 'lt', 'lte', 'match', 'imatch'];


  constructor(options: ASTToQueryBuilderOptions = {}) {
    this.maxNestingDepth = options.maxNestingDepth || 10;
    this.allowUnsafeOperators = options.allowUnsafeOperators || false;
  }

  /**
   *apply AST expression to QueryBuilder conditions
   */
 applyFilters(
    expression: Expression,
    queryBuilder: QueryBuilder,
    options: ASTToQueryBuilderOptions = {},
  ): QueryBuilder {
    if (!expression) {
      return queryBuilder;
    }

    try {
      this.nestingDepth = 0;
      return this._convertExpression(expression, queryBuilder);
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
 applySelect(
    selectNodes: SelectNode[],
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    if (!selectNodes || selectNodes.length === 0) {
      return queryBuilder;
    }

    const selectColumns: string[] = [];
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
 applyOrder(
    orderings: ParsedOrdering[],
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    if (!orderings || orderings.length === 0) {
      return queryBuilder;
    }

    orderings.forEach(ordering => {
      const { path, direction, nulls } = ordering;

      if (nulls) {
        // Handle NULLS FIRST/LAST
        const nullsClause = nulls === 'nullsfirst' ? 'NULLS FIRST' : 'NULLS LAST';
        queryBuilder.orderByRaw(`?? ${direction.toUpperCase()} ${nullsClause}`, [path]);
      } else {
        queryBuilder.orderBy(path, direction);
      }
    });

    return queryBuilder;
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
      if (this._isCondition(expression)) {
        return this._applyCondition(expression, queryBuilder);
      }

      if (this._isNotExpression(expression)) {
        return this._applyNotExpression(expression, queryBuilder);
      }

      if (this._isOrExpression(expression)) {
        return this._applyOrExpression(expression, queryBuilder);
      }

      if (this._isAndExpression(expression)) {
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
    const { field, operator, value, values } = condition;

    if (!field || !operator) {
      throw new Error('Condition must have both field and operator');
    }

    // Validate operator if safety is enabled
    if (!this.allowUnsafeOperators && !this._isKnownOperator(operator)) {
      this.logger.warn(`Unknown operator: ${operator}, proceeding with caution`);
    }

    // Check for ANY/ALL pattern with 3 values
    if (values && Array.isArray(values) && values.length === 3 && this.anyAllsupportedOperators.includes(operator)) {
      const [modifier, ...operatorValues] = values;
      if (modifier === 'any' || modifier === 'all') {
        return this._applyAnyAllCondition(field, operator, modifier, operatorValues, queryBuilder);
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
        return queryBuilder.whereIn(field, values);

      // IS operator
      case 'is':
        if (value === null || value === 'null') {
          return queryBuilder.whereNull(field);
        } else if (value === 'not_null') {
          return queryBuilder.whereNotNull(field);
        } else if (value === true || value === 'true') {
          return queryBuilder.where(field, true);
        } else if (value === false || value === 'false') {
          return queryBuilder.where(field, false);
        } else if (value === 'unknown') {
          return queryBuilder.whereRaw(`?? IS UNKNOWN`, [field]);
        }
        return queryBuilder.where(field, value);

      // IS DISTINCT FROM
      case 'isdistinct':
        return queryBuilder.whereRaw(`?? IS DISTINCT FROM ?`, [field, value]);

      // Full-Text Search operators
      case 'fts':
        if (Array.isArray(values) && values.length >= 2) {
          // Support language specification: [language, query] or [language, query, config]
          const [language, query, config] = values;
          return queryBuilder.whereRaw(`to_tsvector(?, ??) @@ to_tsquery(?)`, [language, field, query]);
        }
        return queryBuilder.whereRaw(`to_tsvector(??) @@ to_tsquery(?)`, [field, value]);
      case 'plfts':
        if (Array.isArray(values) && values.length >= 2) {
          // Support language specification: [language, query]
          const [language, query] = values;
          return queryBuilder.whereRaw(`to_tsvector(?, ??) @@ plainto_tsquery(?, ?)`, [language, field, language, query]);
        }
        return queryBuilder.whereRaw(`to_tsvector(??) @@ plainto_tsquery(?)`, [field, value]);
      case 'phfts':
        if (Array.isArray(values) && values.length >= 2) {
          // Support language specification: [language, query]
          const [language, query] = values;
          return queryBuilder.whereRaw(`to_tsvector(?, ??) @@ phraseto_tsquery(?, ?)`, [language, field, language, query]);
        }
        return queryBuilder.whereRaw(`to_tsvector(??) @@ phraseto_tsquery(?)`, [field, value]);
      case 'wfts':
        if (Array.isArray(values) && values.length >= 2) {
          // Support language specification: [language, query]
          const [language, query] = values;
          return queryBuilder.whereRaw(`to_tsvector(?, ??) @@ websearch_to_tsquery(?, ?)`, [language, field, language, query]);
        }
        return queryBuilder.whereRaw(`to_tsvector(??) @@ websearch_to_tsquery(?)`, [field, value]);

      // Array/JSON operators
      case 'cs': // contains
        return queryBuilder.whereRaw(`?? @> ?`, [field, JSON.stringify(values || value)]);
      case 'cd': // contained in
        return queryBuilder.whereRaw(`?? <@ ?`, [field, JSON.stringify(values || value)]);
      case 'ov': // overlaps
        return queryBuilder.whereRaw(`?? && ?`, [field, JSON.stringify(values || value)]);

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
        return queryBuilder.whereBetween(field, values as any);
      case '->':
      case '->>':
        return queryBuilder.whereRaw(`?? ${operator} ?`, [field, value]);
      case 'not_in':
        if (!values || !Array.isArray(values)) {
          throw new Error('NOT IN operator requires an array of values');
        }
        return queryBuilder.whereNotIn(field, values);
      case 'not_like':
        return queryBuilder.where(field, 'not like', value);
      case 'not_ilike':
        return queryBuilder.where(field, 'not ilike', value);
      case 'is_null':
        return queryBuilder.whereNull(field);
      case 'is_not_null':
        return queryBuilder.whereNotNull(field);
      case 'regex':
        return queryBuilder.whereRaw(`?? ~ ?`, [field, value]);
      case 'iregex':
        return queryBuilder.whereRaw(`?? ~* ?`, [field, value]);
      case 'not_regex':
        return queryBuilder.whereRaw(`?? !~ ?`, [field, value]);
      case 'not_iregex':
        return queryBuilder.whereRaw(`?? !~* ?`, [field, value]);
      case 'json_extract':
        return queryBuilder.whereRaw(`?? -> ? = ?`, [field, value.path, value.value]);
      case 'json_extract_text':
        return queryBuilder.whereRaw(`?? ->> ? = ?`, [field, value.path, value.value]);
      case 'json_contains':
        return queryBuilder.whereRaw(`?? ? ?`, [field, value]);

      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  private _applyNotExpression(
    notExpression: NotExpression,
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    return queryBuilder.whereNot((builder) => {
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

    return queryBuilder.where((builder) => {
      orExpression.or.forEach((expr, index) => {
        if (index === 0) {
          this._convertExpression(expr, builder);
        } else {
          builder.orWhere((subBuilder) => {
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

    andExpression.and.forEach((expr) => {
      this._convertExpression(expr, queryBuilder);
    });

    return queryBuilder;
  }

  private _isKnownOperator(operator: string): boolean {
    const knownOperators = [
      // Basic comparisons
      'eq', 'gt', 'gte', 'lt', 'lte', 'neq',
      // Pattern matching
      'like', 'ilike', 'match', 'imatch',
      // List operations
      'in', 'is', 'isdistinct',
      // Full-text search
      'fts', 'plfts', 'phfts', 'wfts',
      // Array/JSON operations
      'cs', 'cd', 'ov',
      // Range operations
      'sl', 'sr', 'nxr', 'nxl', 'adj',
      // Logical operators
      'not', 'or', 'and',
      // Operator modifiers
      'all', 'any',
      // Legacy operators
      'between', '->', '->>', 'not_in', 'not_like', 'not_ilike',
      'is_null', 'is_not_null', 'regex', 'iregex', 'not_regex', 'not_iregex',
      'json_extract', 'json_extract_text', 'json_contains'
    ];
    return knownOperators.includes(operator);
  }

  /**
   * Handle ANY/ALL conditions for specific operators
   * Creates OR conditions for 'any' and AND conditions for 'all'
   */
  private _applyAnyAllCondition(
    field: string,
    operator: string,
    modifier: 'any' | 'all',
    operatorValues: any[],
    queryBuilder: QueryBuilder,
  ): QueryBuilder {
    if (modifier === 'any') {
      // ANY creates OR conditions
      return queryBuilder.where((builder) => {
        operatorValues.forEach((val, index) => {
          if (index === 0) {
            this._applySingleOperatorCondition(field, operator, val, builder);
          } else {
            builder.orWhere((subBuilder) => {
              this._applySingleOperatorCondition(field, operator, val, subBuilder);
            });
          }
        });
      });
    } else {
      // ALL creates AND conditions
      return queryBuilder.where((builder) => {
        operatorValues.forEach((val) => {
          this._applySingleOperatorCondition(field, operator, val, builder);
        });
      });
    }
  }

  /**
   * Apply a single operator condition (helper for ANY/ALL)
   */
  private _applySingleOperatorCondition(
    field: string,
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
  private _buildColumnSelect(node: ColumnNode): string {
    let columnSelect = node.path;

    // Apply cast if specified
    if (node.cast) {
      columnSelect = `${columnSelect}::${node.cast}`;
    }

    // Apply alias if specified
    if (node.alias) {
      columnSelect = `${columnSelect} as ${node.alias}`;
    }

    return columnSelect;
  }

  /**
   * Handle embed node (subqueries/joins)
   */
  private _handleEmbedNode(embed: EmbedNode, queryBuilder: QueryBuilder): void {
    const { resource, constraint, alias, select } = embed;

    // TODO: AI GENERATED
    // This is a simplified implementation - you may need to expand based on your needs
    if (select && select.length > 0) {
      // Create a subquery for the embed
      const subQuery = queryBuilder.clone().from(resource);

      // Apply constraint if provided
      if (constraint) {
        // Parse and apply the constraint - this would need proper parsing
        // For now, assuming it's a simple field=value constraint
        const [field, value] = constraint.split('=');
        if (field && value) {
          subQuery.where(field.trim(), value.trim());
        }
      }

      // Apply select for the embed
      this.applySelect(select, subQuery);

      // Join or handle the embed based on your requirements
      // This is where you'd implement the actual join logic
      const joinAlias = alias || resource;
      queryBuilder.leftJoin(`${resource} as ${joinAlias}`, function () {
        // Add join conditions here based on your schema
        // This is a placeholder - you'll need to implement proper join logic
      });
    }
  }

  // Type guards
  private _isCondition(expression: Expression): expression is Condition {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'field' in expression &&
      'operator' in expression
    );
  }

  private _isNotExpression(expression: Expression): expression is NotExpression {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'not' in expression
    );
  }

  private _isOrExpression(expression: Expression): expression is OrExpression {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'or' in expression &&
      Array.isArray(expression.or)
    );
  }

  private _isAndExpression(expression: Expression): expression is AndExpression {
    return (
      expression !== null &&
      typeof expression === 'object' &&
      'and' in expression &&
      Array.isArray(expression.and)
    );
  }
}
