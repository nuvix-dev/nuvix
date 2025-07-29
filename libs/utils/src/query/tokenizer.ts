import type { ParsePosition } from './types';

export enum TokenType {
  // Literals
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',
  UNDEFINED = 'UNDEFINED',

  // Identifiers and Operators
  IDENTIFIER = 'IDENTIFIER',
  DOT = 'DOT',

  // JSON Operators
  JSON_EXTRACT = 'JSON_EXTRACT', // ->
  JSON_EXTRACT_TEXT = 'JSON_EXTRACT_TEXT', // ->>

  // Cast Operator
  CAST = 'CAST', // ::

  // Grouping
  LPAREN = 'LPAREN', // (
  RPAREN = 'RPAREN', // )

  // Separators
  COMMA = 'COMMA', // ,

  // Logical
  PIPE = 'PIPE', // |
  NOT = 'NOT', // !

  // Special
  COLUMN_REF = 'COLUMN_REF', // "quoted"
  RAW_VALUE = 'RAW_VALUE', // `backticks`
  SPECIAL_FIELD = 'SPECIAL_FIELD', // $

  // End of input
  EOF = 'EOF',

  // Invalid token
  INVALID = 'INVALID',
}

export interface Token {
  type: TokenType;
  value: string;
  position: ParsePosition;
  length: number;
}

export class Tokenizer {
  protected input: string;
  protected position: number = 0;
  protected line: number = 1;
  protected column: number = 1;

  constructor(input: string) {
    this.input = input;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.position < this.input.length) {
      this.skipWhitespace();

      if (this.position >= this.input.length) {
        break;
      }

      const token = this.nextToken();
      if (token.type !== TokenType.INVALID) {
        tokens.push(token);
      } else {
        throw new Error(
          `Invalid token at ${this.line}:${this.column}: "${token.value}"`,
        );
      }
    }

    tokens.push({
      type: TokenType.EOF,
      value: '',
      position: this.getCurrentPosition(),
      length: 0,
    });

    return tokens;
  }

  protected nextToken(): Token {
    const start = this.getCurrentPosition();
    const char = this.current();

    // Handle multi-character operators first
    if (this.peek(3) === '->>') {
      this.advance(3);
      return this.createToken(TokenType.JSON_EXTRACT_TEXT, '->>', start);
    }

    if (this.peek(2) === '->') {
      this.advance(2);
      return this.createToken(TokenType.JSON_EXTRACT, '->', start);
    }

    if (this.peek(2) === '::') {
      this.advance(2);
      return this.createToken(TokenType.CAST, '::', start);
    }

    // Single character tokens
    switch (char) {
      case '.':
        this.advance();
        return this.createToken(TokenType.DOT, '.', start);
      case '(':
        this.advance();
        return this.createToken(TokenType.LPAREN, '(', start);
      case ')':
        this.advance();
        return this.createToken(TokenType.RPAREN, ')', start);
      case ',':
        this.advance();
        return this.createToken(TokenType.COMMA, ',', start);
      case '|':
        this.advance();
        return this.createToken(TokenType.PIPE, '|', start);
      case '!':
        this.advance();
        return this.createToken(TokenType.NOT, '!', start);
      case '"':
        return this.readQuotedString('"', TokenType.COLUMN_REF, start);
      case "'":
        return this.readQuotedString("'", TokenType.STRING, start);
      case '`':
        return this.readQuotedString('`', TokenType.RAW_VALUE, start);
      case '$':
        this.advance();
        return this.createToken(TokenType.SPECIAL_FIELD, '$', start);
      default:
        // Handle numbers
        if (
          this.isDigit(char) ||
          (char === '-' && this.isDigit(this.peek(1)))
        ) {
          return this.readNumber(start);
        }

        // Handle identifiers and keywords
        if (this.isAlpha(char) || char === '_') {
          return this.readIdentifier(start);
        }

        // Invalid character
        this.advance();
        return this.createToken(TokenType.INVALID, char, start);
    }
  }

  protected readQuotedString(
    quote: string,
    tokenType: TokenType,
    start: ParsePosition,
  ): Token {
    this.advance(); // Skip opening quote
    let value = '';
    let escaped = false;

    while (this.position < this.input.length) {
      const char = this.current();

      if (escaped) {
        // Handle escaped characters
        switch (char) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case quote:
            value += quote;
            break;
          case '`':
            value += '`'; // Handle escaped backticks properly
            break;
          default:
            value += char;
        }
        escaped = false;
        this.advance();
      } else if (char === '\\') {
        escaped = true;
        this.advance();
      } else if (char === quote) {
        this.advance(); // Skip closing quote
        break;
      } else {
        value += char;
        this.advance();
      }
    }

    return this.createToken(tokenType, value, start);
  }

  protected readNumber(start: ParsePosition): Token {
    let value = '';

    // Handle negative sign
    if (this.current() === '-') {
      value += '-';
      this.advance();
    }

    // Read integer part
    while (this.position < this.input.length && this.isDigit(this.current())) {
      value += this.current();
      this.advance();
    }

    // Read decimal part
    if (this.current() === '.') {
      value += '.';
      this.advance();

      while (
        this.position < this.input.length &&
        this.isDigit(this.current())
      ) {
        value += this.current();
        this.advance();
      }
    }

    // Read scientific notation
    if (this.current() === 'e' || this.current() === 'E') {
      value += this.current();
      this.advance();

      if (this.current() === '+' || this.current() === '-') {
        value += this.current();
        this.advance();
      }

      while (
        this.position < this.input.length &&
        this.isDigit(this.current())
      ) {
        value += this.current();
        this.advance();
      }
    }

    return this.createToken(TokenType.NUMBER, value, start);
  }

  protected readIdentifier(start: ParsePosition): Token {
    let value = '';

    while (
      this.position < this.input.length &&
      (this.isAlphaNumeric(this.current()) || this.current() === '_')
    ) {
      value += this.current();
      this.advance();
    }

    // Check for keywords first
    const keywordType = this.getKeywordType(value);
    if (keywordType !== TokenType.IDENTIFIER) {
      return this.createToken(keywordType, value, start);
    }

    return this.createToken(TokenType.IDENTIFIER, value, start);
  }

  protected getKeywordType(value: string): TokenType {
    switch (value.toLowerCase()) {
      case 'true':
      case 'false':
        return TokenType.BOOLEAN;
      case 'null':
        return TokenType.NULL;
      case 'undefined':
        return TokenType.UNDEFINED;
      default:
        return TokenType.IDENTIFIER;
    }
  }

  protected skipWhitespace(): void {
    while (
      this.position < this.input.length &&
      this.isWhitespace(this.current())
    ) {
      if (this.current() === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
  }

  protected current(): string {
    return this.position < this.input.length ? this.input[this.position] : '';
  }

  protected peek(offset: number = 1): string {
    const pos = this.position + offset - 1;
    return pos < this.input.length
      ? this.input.slice(this.position, this.position + offset)
      : '';
  }

  protected advance(count: number = 1): void {
    for (let i = 0; i < count && this.position < this.input.length; i++) {
      if (this.current() === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
  }

  protected getCurrentPosition(): ParsePosition {
    return {
      line: this.line,
      column: this.column,
      offset: this.position,
    };
  }

  protected createToken(
    type: TokenType,
    value: string,
    start: ParsePosition,
  ): Token {
    return {
      type,
      value,
      position: start,
      length: this.position - start.offset,
    };
  }

  protected isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r';
  }

  protected isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  protected isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  protected isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}
