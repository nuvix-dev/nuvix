import { Exception } from '@nuvix/core/extend/exception'
import {
  AllowedOperators,
  BaseParser,
  GroupParser,
  specialOperators,
} from './base'
import { OrderParser } from './order'
import { Tokenizer, TokenType } from './tokenizer'
import type {
  AndExpression,
  Condition,
  Expression,
  OrExpression,
  ParserConfig,
  ParserResult,
} from './types'

export class Parser<T extends ParserResult = ParserResult> extends BaseParser {
  private config: ParserConfig
  private extraData: Record<string, any> = {}

  constructor(config: ParserConfig, tableName: string, mainTable?: string) {
    super()
    this.config = config
    this.tableName = tableName
    this.mainTable = mainTable ?? tableName
    this._validateConfig()
  }

  static create<T extends ParserResult>({
    tableName,
    mainTable,
  }: {
    tableName: string
    mainTable?: string
  }) {
    return new Parser<T>(defaultConfig, tableName, mainTable)
  }

  parse(str: string): T & Expression {
    if (typeof str !== 'string') {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        'Input must be a string',
      )
    }

    try {
      const tokenizer = new Tokenizer(str.trim())
      this.tokens = tokenizer.tokenize()

      this.current = 0
      const result = {
        ...this.parseExpression(true),
        ...(this.extraData as T),
      }
      return result as T & Expression
    } catch (error) {
      if (error instanceof Exception) {
        throw error
      }
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        'Unknown parsing error occurred',
      )
    }
  }

  private parseExpression(isTopLevel = false): Expression {
    return this.parseOrExpression(isTopLevel)
  }

  private parseOrExpression(isTopLevel = false): Expression {
    let left = this.parseAndExpression(isTopLevel)

    while (this.match(TokenType.PIPE)) {
      const expressions = [left]
      expressions.push(this.parseAndExpression(false))

      // Continue collecting OR expressions
      while (this.match(TokenType.PIPE)) {
        expressions.push(this.parseAndExpression(false))
      }

      left = { or: expressions.filter(Boolean) }
    }

    return left
  }

  private parseAndExpression(isTopLevel = false): Expression {
    let left = this.parseNotExpression(isTopLevel)

    while (this.match(TokenType.COMMA)) {
      const expressions = [left]
      expressions.push(this.parseNotExpression(isTopLevel))

      // Continue collecting AND expressions
      while (this.match(TokenType.COMMA)) {
        expressions.push(this.parseNotExpression(isTopLevel))
      }

      left = { and: expressions.filter(Boolean) as Expression[] }
    }

    return left
  }

  private parseNotExpression(isTopLevel = false): Expression {
    if (this.match(TokenType.NOT)) {
      const expr = this.parseNotExpression(false)
      return { not: expr }
    }

    return this.parsePrimaryExpression(isTopLevel)
  }

  private parsePrimaryExpression(isTopLevel = false): Expression {
    // Special fields can only be at the top level
    if (this.check(TokenType.SPECIAL_FIELD) && !isTopLevel) {
      this.throwError(
        'Special fields (like $) can only be used at the top level, not nested inside logical expressions',
        this.peek(),
      )
    }

    // Handle function calls: or(...), and(...), not(...)
    if (this.check(TokenType.IDENTIFIER)) {
      const identifier = this.peek().value

      if (identifier === 'or' && this.peekNext()?.type === TokenType.LPAREN) {
        this.advance() // consume 'or'
        this.consume(TokenType.LPAREN, "Expected '(' after 'or'")
        const expressions = this.parseCommaSeparatedExpressions()
        this.consume(TokenType.RPAREN, "Expected ')' after or arguments")
        if (expressions.length < 2) {
          this.throwError(
            "Logical 'or' requires at least two expressions",
            this.peek(),
          )
        }
        return { or: expressions }
      }

      if (identifier === 'and' && this.peekNext()?.type === TokenType.LPAREN) {
        this.advance() // consume 'and'
        this.consume(TokenType.LPAREN, "Expected '(' after 'and'")
        const expressions = this.parseCommaSeparatedExpressions()
        this.consume(TokenType.RPAREN, "Expected ')' after and arguments")
        return { and: expressions }
      }

      if (identifier === 'not' && this.peekNext()?.type === TokenType.LPAREN) {
        this.advance() // consume 'not'
        this.consume(TokenType.LPAREN, "Expected '(' after 'not'")
        const expr = this.parseExpression()
        this.consume(TokenType.RPAREN, "Expected ')' after not argument")
        return { not: expr }
      }
    }

    // Handle grouped expressions
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression()
      this.consume(TokenType.RPAREN, "Expected ')' after grouped expression")
      return expr
    }

    // Handle regular conditions or special fields
    return this.parseCondition()
  }

  private parseCondition(): Condition {
    // Handle special fields: $
    if (this.check(TokenType.SPECIAL_FIELD)) {
      this.advance() // consume '$'
      this.consume(TokenType.DOT, "Expected '.' after special field")
      const operator = this.consume(
        TokenType.IDENTIFIER,
        'Expected operator',
      ).value

      if (
        !specialOperators.includes(
          operator as (typeof specialOperators)[number],
        )
      ) {
        this.throwError(`Unknown operator "${operator}" found.`, this.peek())
      }

      let args: any[] = []
      if (operator === 'order' || operator === 'group') {
        // Collect tokens between '(' and ')'
        if (this.match(TokenType.LPAREN)) {
          const orderTokens: any[] = []
          while (!this.check(TokenType.RPAREN)) {
            orderTokens.push(this.peek())
            this.advance()
          }
          this.consume(TokenType.RPAREN, "Expected ')' after arguments")
          orderTokens.push({
            type: TokenType.EOF,
            value: '',
            position: 0,
            length: 0,
          })
          args = orderTokens
        }
      } else if (this.match(TokenType.LPAREN)) {
        args = this.parseArgumentList()
        this.consume(TokenType.RPAREN, "Expected ')' after arguments")
      }

      this.handleSpecialCase(operator, args)
      return null as any // Special cases don't return conditions
    }

    // Parse field path
    const field = this.parseFieldPath()
    this.consume(TokenType.DOT, "Expected '.' after field")
    const operator = this.consume(
      TokenType.IDENTIFIER,
      'Expected operator',
    ).value

    // Parse arguments
    let args: any[] = []
    if (this.match(TokenType.LPAREN)) {
      args = this.parseArgumentList()
      this.consume(TokenType.RPAREN, "Expected ')' after arguments")
    }

    this.validateOperator(operator, args)
    // TODO: we have to direct pass the field to the buildCondition method
    return this.buildCondition(
      this.fieldToString(field),
      operator as AllowedOperators,
      args,
    )
  }

  private parseArgumentList(): any[] {
    const args: any[] = []

    if (this.check(TokenType.RPAREN)) {
      return args
    }

    do {
      args.push(this.parseValue())
    } while (this.match(TokenType.COMMA))

    return args
  }

  private parseCommaSeparatedExpressions(): Expression[] {
    const expressions: Expression[] = []

    if (this.check(TokenType.RPAREN)) {
      return expressions
    }

    do {
      const expr = this.parseExpression(false)
      if (expr) {
        expressions.push(expr)
      }
    } while (this.match(TokenType.COMMA))

    const filteredExpressions =
      expressions.length === 1 &&
      ((expressions[0] as AndExpression).and ||
        (expressions[0] as OrExpression).or)
        ? ((expressions[0] as AndExpression).and ??
          (expressions[0] as OrExpression).or)
        : expressions

    return filteredExpressions
  }

  private parseValue(): any {
    const token = this.peek()

    switch (token.type) {
      case TokenType.STRING:
        this.advance()
        return token.value

      case TokenType.NUMBER: {
        this.advance()
        const num = Number(token.value)
        return Number.isNaN(num) ? token.value : num
      }

      case TokenType.BOOLEAN:
        this.advance()
        return token.value === 'true'

      case TokenType.NULL:
        this.advance()
        return null

      case TokenType.UNDEFINED:
        this.advance()
        return undefined

      case TokenType.COLUMN_REF: {
        this.advance()
        const columnName = token.value
        return {
          __type: 'column',
          name: columnName.includes('.')
            ? columnName
            : `${this.mainTable}.${columnName}`,
        }
      }

      case TokenType.RAW_VALUE:
        this.advance()
        return { __type: 'raw', value: token.value }

      case TokenType.IDENTIFIER:
        this.advance()
        // Check for date-like patterns or cast expressions
        // if (
        //   /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(token.value)
        // ) {
        //   return token.value;
        // }
        // if (token.value.includes('::')) {
        //   return { __type: 'raw', value: token.value };
        // }
        return token.value

      default:
        this.throwError(
          `Unexpected token in value position: ${token.value}`,
          token,
        )
    }
  }

  private buildCondition(
    field: string,
    operator: AllowedOperators,
    args: any[],
  ): Condition {
    const _field =
      typeof field === 'string' ? this.parseFieldString(field) : field

    return {
      field: _field,
      operator,
      values: args,
      tableName: this.tableName,
    }
  }

  private handleSpecialCase(operator: string, args: any[]): void {
    switch (operator) {
      case 'limit':
        this.extraData.limit = this.integerOrThrow(args[0], operator)
        break
      case 'offset':
        this.extraData.offset = this.integerOrThrow(args[0], operator)
        break
      case 'join': {
        const joinType = String(args[0]).toLowerCase()
        if (['inner', 'left', 'right'].includes(joinType)) {
          // 'full'
          this.extraData.joinType = joinType
        } else {
          this.throwError(`Unsupported join type: ${args[0]}`, this.peek())
        }
        break
      }
      case 'shape': {
        const shape = String(args[0]).toLowerCase()
        if (['object', 'array', '{}', '[]', 'true'].includes(shape)) {
          this.extraData.shape =
            shape === 'object' || shape === '{}' || shape === 'true'
              ? 'object'
              : 'array'
        } else {
          this.throwError(`Unsupported shape value: ${args[0]}`, this.peek())
        }
        break
      }
      case 'group':
        if (args.length > 0) {
          const parser = new GroupParser(args)
          this.extraData.group = parser.parse()
        }
        break
      case 'order':
        if (args.length > 0) {
          const orders = OrderParser.parse(args, this.tableName, this.mainTable)
          if (orders && orders.length > 0) {
            this.extraData.order = orders
          }
        }
        break
      default:
        this.throwError(
          `Unsupported special function: ${operator}`,
          this.peek(),
        )
    }
  }

  private integerOrThrow(value: any, field: string): number {
    const num = Number(value)
    if (
      typeof num !== 'number' ||
      Number.isNaN(num) ||
      !Number.isInteger(num)
    ) {
      this.throwError(
        `${field} value should be an integer: ${value}`,
        this.peek(),
      )
    }
    return num
  }

  private validateOperator(operator: string, args: any[]) {
    const count = args.length

    const expect = (expected: string, condition: boolean) => {
      if (!condition) {
        this.throwError(
          `Operator "${operator}" expects ${expected}, but got ${count} value${count !== 1 ? 's' : ''}.`,
          this.peek(),
        )
      }
    }

    if (
      !['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(
        operator as AllowedOperators,
      )
    ) {
      args.forEach(arg => {
        if (
          typeof arg === 'object' &&
          arg !== null &&
          '__type' in arg &&
          arg.__type === 'column'
        ) {
          this.throwError(
            `Operator "${operator}" does not support column references as arguments.`,
            this.peek(),
          )
        }
      })
    }

    switch (operator as AllowedOperators) {
      // Simple binary comparison
      case 'eq':
      case 'neq':
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
      case 'like':
      case 'ilike':
      case 'match':
      case 'imatch':
        expect(
          'a single value (unless using `any` or `all`)',
          count === 1 || (count > 1 && ['any', 'all'].includes(args[0])),
        )
        break

      // Multi-value conditions
      case 'in':
      case 'notin':
      case 'ov': // overlap
      case 'cs': // contains
      case 'cd': // contained in
      case 'all':
      case 'any':
        expect('at least one value', count >= 1)
        break

      // Between range
      case 'between':
        expect('exactly two values', count === 2)
        break

      // IS / IS NOT comparisons
      case 'is':
      case 'isnot':
        expect('exactly one value', count === 1)
        break

      // NULL check (no values)
      case 'null':
      case 'notnull':
        expect('no values', count === 0)
        break

      // Range and adjacency (PostgreSQL-specific range operators)
      case 'sl': // strictly left
      case 'sr': // strictly right
      case 'nxl': // not extend left
      case 'nxr': // not extend right
      case 'adj': // adjacent
        expect('exactly two values', count === 2)
        break

      // Logical operators
      case 'and':
      case 'or':
        expect('at least two values', count >= 2)
        break

      case 'not':
        expect('exactly one value', count === 1)
        break

      // Full-text search operators
      case 'fts':
      case 'plfts':
      case 'phfts':
      case 'wfts':
        expect(
          'one or two values: (search term) or (language, search term)',
          count === 1 || count === 2,
        )
        break

      // Distinct check
      case 'isdistinct':
        expect('zero or one value', count === 0 || count === 1)
        break

      default:
        this.throwError(
          `Unknown or unsupported operator "${operator}".`,
          this.peek(),
        )
    }
  }

  private _validateConfig(): void {
    if (!this.config?.groups) {
      throw new Error('Config must include groups configuration')
    }

    const { OPEN, CLOSE, SEP, OR, NOT } = this.config.groups
    if (!OPEN || !CLOSE || !SEP || !OR || !NOT) {
      throw new Error(
        'All group characters (OPEN, CLOSE, SEP, OR, NOT) must be defined',
      )
    }
  }
}

const defaultConfig: ParserConfig = {
  groups: {
    OPEN: '(',
    CLOSE: ')',
    SEP: ',',
    OR: '|',
    NOT: '!',
  },
  values: {
    FUNCTION_STYLE: true,
    LIST_STYLE: '[]',
  },
  cast: {
    OPEN: '{',
    CLOSE: '}',
  },
}
