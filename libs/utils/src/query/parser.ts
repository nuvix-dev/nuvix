import { Logger } from '@nestjs/common';
import { Exception } from '@nuvix/core/extend/exception';
import type {
  Condition,
  Expression,
  ParserConfig,
  ParserResult,
} from './types';
import { OrderParser } from './order';
import { ParserError } from './error';
import { Tokenizer, TokenType } from './tokenizer';
import { BaseParser, specialOperators } from './base';

export class Parser<T extends ParserResult = ParserResult> extends BaseParser {
  private readonly logger = new Logger(Parser.name);

  private config: ParserConfig;
  private extraData: Record<string, any> = {};

  constructor(config: ParserConfig, tableName: string, mainTable?: string) {
    super();
    this.config = config;
    this.tableName = tableName;
    this.mainTable = mainTable ?? tableName;
    this._validateConfig();
  }

  static create<T>({
    tableName,
    mainTable,
  }: {
    tableName: string;
    mainTable?: string;
  }) {
    return new Parser<T>(defaultConfig, tableName, mainTable);
  }

  parse(str: string): T & Expression {
    if (typeof str !== 'string') {
      throw new ParserError(
        'Parser input must be a string',
        { line: 1, column: 1, offset: 0 },
        String(str),
        { expected: 'string', received: typeof str },
      );
    }

    try {
      const tokenizer = new Tokenizer(str.trim());
      const start = performance.now()
      this.tokens = tokenizer.tokenize();
      const end = performance.now()

      this.logger.debug('THIS IS TIME', end - start, { tokens: this.tokens })
      this.current = 0;
      const _start = performance.now()
      const result = {
        ...this.parseExpression(true),
        ...(this.extraData as T),
      };
      const _end = performance.now()
      this.logger.debug('Parser taken time', _end - _start, { result })
      return result;
    } catch (error) {
      if (error instanceof ParserError) {
        throw error;
      } else if (error instanceof Error) {
        throw new Exception(
          Exception.GENERAL_PARSER_ERROR,
          `Parse error: ${error.message}`,
        );
      }
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        'Unknown parsing error occurred',
      );
    }
  }

  private parseExpression(isTopLevel = false): Expression {
    return this.parseOrExpression(isTopLevel);
  }

  private parseOrExpression(isTopLevel = false): Expression {
    let left = this.parseAndExpression(isTopLevel);

    while (this.match(TokenType.PIPE)) {
      const expressions = [left];
      expressions.push(this.parseAndExpression(false));

      // Continue collecting OR expressions
      while (this.match(TokenType.PIPE)) {
        expressions.push(this.parseAndExpression(false));
      }

      left = { or: expressions.filter(Boolean) };
    }

    return left;
  }

  private parseAndExpression(isTopLevel = false): Expression {
    let left = this.parseNotExpression(isTopLevel);

    while (this.match(TokenType.COMMA)) {
      const expressions = [left];
      expressions.push(this.parseNotExpression(isTopLevel));

      // Continue collecting AND expressions
      while (this.match(TokenType.COMMA)) {
        expressions.push(this.parseNotExpression(isTopLevel));
      }

      left = { and: expressions.filter(Boolean) as Expression[] };
    }

    return left;
  }

  private parseNotExpression(isTopLevel = false): Expression {
    if (this.match(TokenType.NOT)) {
      const expr = this.parseNotExpression(false);
      return { not: expr };
    }

    return this.parsePrimaryExpression(isTopLevel);
  }

  private parsePrimaryExpression(isTopLevel = false): Expression {
    // Special fields can only be at the top level
    if (this.check(TokenType.SPECIAL_FIELD) && !isTopLevel) {
      this.throwError('Special fields (like $) can only be used at the top level, not nested inside logical expressions', this.peek());
    }

    // Handle function calls: or(...), and(...), not(...)
    if (this.check(TokenType.IDENTIFIER)) {
      const identifier = this.peek().value;

      if (identifier === 'or' && this.peekNext()?.type === TokenType.LPAREN) {
        this.advance(); // consume 'or'
        this.consume(TokenType.LPAREN, "Expected '(' after 'or'");
        const expressions = this.parseCommaSeparatedExpressions();
        this.consume(TokenType.RPAREN, "Expected ')' after or arguments");
        return { or: expressions };
      }

      if (identifier === 'and' && this.peekNext()?.type === TokenType.LPAREN) {
        this.advance(); // consume 'and'
        this.consume(TokenType.LPAREN, "Expected '(' after 'and'");
        const expressions = this.parseCommaSeparatedExpressions();
        this.consume(TokenType.RPAREN, "Expected ')' after and arguments");
        return { and: expressions };
      }

      if (identifier === 'not' && this.peekNext()?.type === TokenType.LPAREN) {
        this.advance(); // consume 'not'
        this.consume(TokenType.LPAREN, "Expected '(' after 'not'");
        const expr = this.parseExpression();
        this.consume(TokenType.RPAREN, "Expected ')' after not argument");
        return { not: expr };
      }
    }

    // Handle grouped expressions
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expected ')' after grouped expression");
      return expr;
    }

    // Handle regular conditions or special fields
    return this.parseCondition();
  }

  private parseCondition(): Condition {
    // Handle special fields: $
    if (this.check(TokenType.SPECIAL_FIELD)) {
      this.consume(TokenType.DOT, "Expected '.' after special field");
      const operator = this.consume(
        TokenType.IDENTIFIER,
        'Expected operator',
      ).value;

      if (!specialOperators.includes(operator as typeof specialOperators[number])) {
        throw new Error(`Unknown operator "${operator}" found.`)
      }

      let args: any[] = [];
      if (operator === 'order') {
        // Collect tokens between '(' and ')'
        if (this.match(TokenType.LPAREN)) {
          const orderTokens: any[] = [];
          while (!this.check(TokenType.RPAREN)) {
            orderTokens.push(this.peek());
            this.advance();
          }
          this.consume(TokenType.RPAREN, "Expected ')' after arguments");
          orderTokens.push({
            type: TokenType.EOF,
            value: '',
            position: 0,
            length: 0,
          })
          args = orderTokens;
        }
      } else if (this.match(TokenType.LPAREN)) {
        args = this.parseArgumentList();
        this.consume(TokenType.RPAREN, "Expected ')' after arguments");
      }

      this.handleSpecialCase(operator, args);
      return null as any; // Special cases don't return conditions
    }

    // Parse field path
    const field = this.parseFieldPath();
    this.consume(TokenType.DOT, "Expected '.' after field");
    const operator = this.consume(
      TokenType.IDENTIFIER,
      'Expected operator',
    ).value;

    // Parse arguments
    let args: any[] = [];
    if (this.match(TokenType.LPAREN)) {
      args = this.parseArgumentList();
      this.consume(TokenType.RPAREN, "Expected ')' after arguments");
    }

    return this.buildCondition(this.fieldToString(field), operator, args);
  }

  private parseArgumentList(): any[] {
    const args: any[] = [];

    if (this.check(TokenType.RPAREN)) {
      return args;
    }

    do {
      args.push(this.parseValue());
    } while (this.match(TokenType.COMMA));

    return args;
  }

  private parseCommaSeparatedExpressions(): Expression[] {
    const expressions: Expression[] = [];

    if (this.check(TokenType.RPAREN)) {
      return expressions;
    }

    do {
      const expr = this.parseExpression(false);
      if (expr) expressions.push(expr);
    } while (this.match(TokenType.COMMA));

    const filteredExpressions =
      expressions.length === 1 &&
        (expressions[0]['and'] || expressions[0]['or'])
        ? (expressions[0]['and'] ?? expressions[0]['or'])
        : expressions;
    return filteredExpressions;
  }

  private parseValue(): any {
    const token = this.peek();

    switch (token.type) {
      case TokenType.STRING:
        this.advance();
        return token.value;

      case TokenType.NUMBER:
        this.advance();
        const num = Number(token.value);
        return isNaN(num) ? token.value : num;

      case TokenType.BOOLEAN:
        this.advance();
        return token.value === 'true';

      case TokenType.NULL:
        this.advance();
        return null;

      case TokenType.UNDEFINED:
        this.advance();
        return undefined;

      case TokenType.COLUMN_REF:
        this.advance();
        const columnName = token.value;
        return {
          __type: 'column',
          name: columnName.includes('.')
            ? columnName
            : `${this.mainTable}.${columnName}`,
        };

      case TokenType.RAW_VALUE:
        this.advance();
        return { __type: 'raw', value: token.value };

      case TokenType.IDENTIFIER:
        this.advance();
        // Check for date-like patterns or cast expressions
        if (
          /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(token.value)
        ) {
          return token.value;
        }
        if (token.value.includes('::')) {
          return { __type: 'raw', value: token.value };
        }
        return token.value;

      default:
        this.throwError(
          `Unexpected token in value position: ${token.value}`,
          token,
        );
    }
  }

  private buildCondition(
    field: string,
    operator: string,
    args: any[],
  ): Condition {
    const parsedField =
      typeof field === 'string' ? this.parseFieldString(field) : field;

    if (args.length === 0) {
      return {
        field: parsedField,
        operator,
        value: null,
        tableName: this.tableName,
      };
    } else if (args.length === 1) {
      return {
        field: parsedField,
        operator,
        value: args[0],
        tableName: this.tableName,
      };
    } else {
      return {
        field: parsedField,
        operator,
        values: args,
        tableName: this.tableName,
      };
    }
  }

  private handleSpecialCase(
    operator: string,
    args: any[],
  ): void {
    switch (operator) {
      case 'limit':
        this.extraData['limit'] = this.integerOrThrow(args[0], operator);
        break;
      case 'offset':
        this.extraData['offset'] = this.integerOrThrow(args[0], operator);
        break;
      case 'join':
        const joinType = String(args[0]).toLowerCase();
        if (['inner', 'left', 'right', 'full'].includes(joinType)) {
          this.extraData['joinType'] = joinType;
        } else {
          this.throwError(`Unsupported join type: ${args[0]}`, this.peek());
        }
        break;
      case 'shape':
        const shape = String(args[0]).toLowerCase();
        if (['object', 'array', '{}', '[]', 'true'].includes(shape)) {
          this.extraData['shape'] =
            shape === 'object' || shape === '{}' || shape === 'true'
              ? 'object'
              : 'array';
        } else {
          this.throwError(`Unsupported shape value: ${args[0]}`, this.peek());
        }
        break;
      case 'group':
        if (args.length > 0) {
          this.extraData['group'] = (args[0] as string)
            .split(',')
            .map(arg => this.parseFieldString(String(arg)));
        }
        break;
      case 'order':
        if (args.length > 0) {
          this.logger.debug({ args })
          const orders = OrderParser.parse(args, this.tableName, this.mainTable);
          if (orders && orders.length > 0) {
            this.extraData['order'] = orders;
          }
        }
        break;
      default:
        this.throwError(
          `Unsupported special function: ${operator}`,
          this.peek(),
        );
    }
  }

  private integerOrThrow(value: any, field: string): number {
    const num = Number(value);
    if (typeof num !== 'number' || isNaN(num) || !Number.isInteger(num)) {
      this.throwError(
        `${field} value should be an integer: ${value}`,
        this.peek(),
      );
    }
    return num;
  }

  private _validateConfig(): void {
    if (!this.config?.groups) {
      throw new ParserError(
        'Config must include groups configuration',
        { line: 1, column: 1, offset: 0 },
        'config validation',
        {
          expected: 'valid ParserConfig with groups',
          received: 'invalid config',
        },
      );
    }

    const { OPEN, CLOSE, SEP, OR, NOT } = this.config.groups;
    if (!OPEN || !CLOSE || !SEP || !OR || !NOT) {
      throw new ParserError(
        'All group characters (OPEN, CLOSE, SEP, OR, NOT) must be defined',
        { line: 1, column: 1, offset: 0 },
        JSON.stringify(this.config.groups),
        {
          expected: 'all group characters defined',
          received: `OPEN: ${OPEN}, CLOSE: ${CLOSE}, SEP: ${SEP}, OR: ${OR}, NOT: ${NOT}`,
        },
      );
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
};
