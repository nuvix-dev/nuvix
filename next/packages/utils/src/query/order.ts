import { BaseParser } from './base'
import { type Token, Tokenizer, TokenType } from './tokenizer'
import type { JsonFieldType, ParsedOrdering } from './types'

class OrderTokenizer extends Tokenizer {
  override nextToken(): Token {
    const start = this.getCurrentPosition()
    const char = this.current()

    // Handle multi-character operators first
    if (this.peek(3) === '->>') {
      this.advance(3)
      return this.createToken(TokenType.JSON_EXTRACT_TEXT, '->>', start)
    }

    if (this.peek(2) === '->') {
      this.advance(2)
      return this.createToken(TokenType.JSON_EXTRACT, '->', start)
    }

    // Single character tokens
    switch (char) {
      case '.':
        this.advance()
        return this.createToken(TokenType.DOT, '.', start)
      case ',':
        this.advance()
        return this.createToken(TokenType.COMMA, ',', start)
      default:
        if (this.isAlpha(char) || char === '_') {
          return this.readIdentifier(start)
        }

        this.advance()
        return this.createToken(TokenType.INVALID, char, start)
    }
  }
}

export class OrderParser extends BaseParser {
  private static readonly SORT_DIRECTIONS = ['asc', 'desc'] as const
  private static readonly NULL_HANDLING_OPTIONS = ['nullsfirst', 'nullslast'] as const

  constructor(tableName: string, mainTable?: string) {
    super()
    this.tableName = tableName
    this.mainTable = mainTable ?? tableName
  }

  static parse(
    ordering: string | null | undefined | Token[],
    tableName: string,
    mainTable?: string,
  ): ParsedOrdering[] {
    const parser = new OrderParser(tableName, mainTable)
    return parser.parse(ordering)
  }

  public parse(ordering: string | null | undefined | Token[]): ParsedOrdering[] {
    if (ordering === null || ordering === undefined) {
      return []
    }

    this.current = 0
    if (Array.isArray(ordering)) {
      this.tokens = ordering
      return this.parseOrderingClause()
    }
    const tokenizer = new OrderTokenizer(ordering)
    this.tokens = tokenizer.tokenize()
    return this.parseOrderingClause()
  }

  private parseOrderingClause(): ParsedOrdering[] {
    if (this.tokens.length === 0) {
      throw new Error('Empty ordering expression')
    }

    const results: ParsedOrdering[] = []
    while (!this.isAtEnd()) {
      while (this.match(TokenType.COMMA)) {}

      if (this.isAtEnd()) {
        break
      }

      const fieldPath = this.fieldToString(this.parseFieldPath())

      let direction: 'asc' | 'desc' = 'asc'
      let nulls: 'nullsfirst' | 'nullslast' | null = null

      for (let i = 0; i < 3 && !this.isAtEnd(); i++) {
        const token = this.peek()

        if (token.type === TokenType.IDENTIFIER) {
          if (OrderParser.SORT_DIRECTIONS.includes(token.value as 'asc' | 'desc')) {
            direction = token.value as 'asc' | 'desc'
            this.advance()
            continue
          }
          if (
            OrderParser.NULL_HANDLING_OPTIONS.includes(token.value as 'nullsfirst' | 'nullslast')
          ) {
            nulls = token.value as 'nullsfirst' | 'nullslast'
            this.advance()
            continue
          }
        } else if (token.type === TokenType.DOT) {
          if (this.peekNext()?.type !== TokenType.IDENTIFIER) {
            throw new Error(`Unexpected dot without identifier after: ${token.value}`)
          }
          this.advance()
          continue
        }
        break
      }

      results.push({
        path: this.parseFieldString(fieldPath),
        direction,
        nulls,
      })

      if (this.check(TokenType.COMMA)) {
        this.advance()
      } else if (!this.isAtEnd()) {
        throw new Error(`Unexpected token after ordering: ${this.peek().value}`)
      }
    }
    return results
  }

  override parseFieldPath(): string | (string | JsonFieldType)[] {
    const parts: (string | JsonFieldType)[] = []

    const firstPart = this.consume(TokenType.IDENTIFIER, 'Expected field name').value
    parts.push(firstPart)

    while (
      this.check(TokenType.DOT) ||
      this.check(TokenType.JSON_EXTRACT) ||
      this.check(TokenType.JSON_EXTRACT_TEXT)
    ) {
      if (this.match(TokenType.DOT)) {
        const token = this.peek()
        if (
          this.check(TokenType.IDENTIFIER) &&
          (OrderParser.SORT_DIRECTIONS.includes(token.value as 'asc' | 'desc') ||
            OrderParser.NULL_HANDLING_OPTIONS.includes(token.value as 'nullsfirst' | 'nullslast'))
        ) {
          break
        }

        const part = this.consume(TokenType.IDENTIFIER, "Expected field name after '.'").value
        parts.push(part)
      } else if (this.match(TokenType.JSON_EXTRACT)) {
        if (!(this.check(TokenType.IDENTIFIER) || this.check(TokenType.NUMBER))) {
          this.throwError("Expected field name or index after '->'", this.peek())
        }
        const partToken = this.advance()
        parts.push({ name: partToken.value, operator: '->', __type: 'json' })
      } else if (this.match(TokenType.JSON_EXTRACT_TEXT)) {
        if (!(this.check(TokenType.IDENTIFIER) || this.check(TokenType.NUMBER))) {
          this.throwError("Expected field name or index after '->>'", this.peek())
        }
        const partToken = this.advance()
        parts.push({ name: partToken.value, operator: '->>', __type: 'json' })
      }
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
  }
}
