
import { Logger } from '@nestjs/common';
import { PG } from '@nuvix/pg';
import { AndExpression, Condition, Expression, NotExpression, OrExpression } from './types';
import { Exception } from '@nuvix/core/extend/exception';
import { ASTToQueryBuilder } from './builder';

export class JoinBuilder<T extends ASTToQueryBuilder<any>> {
    private readonly logger = new Logger(JoinBuilder.name);
    private qb: PG.JoinClause;
    private astToBuilder: T;
    private nestingDepth = 0;
    private readonly maxNestingDepth: number;

    constructor(qb: PG.JoinClause, ast: T) {
        this.qb = qb;
        this.astToBuilder = ast
    }


    public applyJoin(
        expression?: Expression,
    ): PG.JoinClause {
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
                    `Join builder conversion error: ${error.message}`,
                );
            }
            throw new Error('Unknown join builder conversion error');
        }
    }

    private _applyNotExpression(
        notExpression: NotExpression,
        queryBuilder: PG.JoinClause,
    ): PG.JoinClause {
        return queryBuilder.on((builder) => {
            this._convertExpression(notExpression.not, builder);
        });
    }

    private _applyOrExpression(
        orExpression: OrExpression,
        queryBuilder: PG.JoinClause,
    ): PG.JoinClause {
        if (!orExpression.or || orExpression.or.length === 0) {
            return queryBuilder;
        }

        return queryBuilder.on((builder) => {
            orExpression.or.forEach((expr, index) => {
                if (index === 0) {
                    this._convertExpression(expr, builder);
                } else {
                    builder.orOn((subBuilder) => {
                        this._convertExpression(expr, subBuilder);
                    });
                }
            });
        });
    }

    private _applyAndExpression(
        andExpression: AndExpression,
        queryBuilder: PG.JoinClause,
    ): PG.JoinClause {
        if (!andExpression.and || andExpression.and.length === 0) {
            return queryBuilder;
        }

        andExpression.and.forEach((expr, index) => {
            if (index === 0) {
                this._convertExpression(expr, queryBuilder);
            } else {
                queryBuilder.andOn((subBuilder) => {
                    this._convertExpression(expr, subBuilder);
                });
            }
        });

        return queryBuilder;
    }

    private _convertExpression(
        expression: Expression,
        queryBuilder: PG.JoinClause,
    ): PG.JoinClause {
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
        queryBuilder: PG.JoinClause,
    ): PG.JoinClause {
        const { field: _field, operator, value, values } = condition;

        if (!_field || !operator) {
            throw new Error('Condition must have both field and operator');
        }

        // Validate operator if safety is enabled
        if (!this._isKnownOperator(operator)) {
            this.logger.warn(`Unknown operator: ${operator}, proceeding with caution`);
        }

        const field = this.astToBuilder._rawField(_field) as unknown as ReturnType<PG['raw']>;
        const fieldSql = _field as string // field.toSQL().sql;

        switch (operator) {
            // Basic comparisons
            case 'eq':
                return queryBuilder.on(fieldSql, '=', value);
            case 'gt':
                return queryBuilder.on(fieldSql, '>', value);
            case 'gte':
                return queryBuilder.on(fieldSql, '>=', value);
            case 'lt':
                return queryBuilder.on(fieldSql, '<', value);
            case 'lte':
                return queryBuilder.on(fieldSql, '<=', value);
            case 'ne':
            case 'neq':
                return queryBuilder.on(fieldSql, '<>', value);

            // Pattern matching
            case 'like':
                return queryBuilder.on(fieldSql, 'like', value);
            case 'ilike':
                return queryBuilder.on(fieldSql, 'ilike', value);

            // IN operator
            case 'in':
                if (!values || !Array.isArray(values)) {
                    throw new Error('IN operator requires an array of values');
                }
                return queryBuilder.onIn(fieldSql, values);

            // IS operator
            case 'is':
                if (value === null || value === 'null') {
                    return queryBuilder.onNull(fieldSql);
                } else if (value === 'not_null') {
                    return queryBuilder.onNotNull(fieldSql);
                } else if (value === true || value === 'true') {
                    return queryBuilder.onVal(fieldSql, true);
                } else if (value === false || value === 'false') {
                    return queryBuilder.onVal(fieldSql, false);
                }
                return queryBuilder.on(fieldSql, values ? this.astToBuilder.pg.raw(
                    values.map((_, i) => `??${i > values.length ? '.' : ''}`).join(''), values) : value);

            case 'between':
                if (!values || !Array.isArray(values) || values.length !== 2) {
                    throw new Error('BETWEEN operator requires exactly 2 values');
                }
                return queryBuilder.onBetween(fieldSql, values as any);
            default:
                throw new Error(`Unsupported operator: ${operator}`);
        }
    }

    private _isKnownOperator(operator: string): boolean {
        const knownOperators = [
            'eq', 'gt', 'gte', 'lt', 'lte', 'neq', 'ne',
            'like', 'ilike',
            'in', 'is',
            'not', 'or', 'and',
            'between'
        ];
        return knownOperators.includes(operator);
    }
}
