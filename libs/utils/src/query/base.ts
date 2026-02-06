import { Exception } from '@nuvix/core/extend/exception'
import { Token, TokenType } from './tokenizer'
import type { Condition, JsonFieldType } from './types'

export abstract class BaseParser {
  protected tableName!: string
  protected mainTable!: string
  protected tokens: Token[] = []
  protected current = 0

  // Token navigation methods
  protected match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance()
        return true
      }
    }
    return false
  }

  protected check(type: TokenType): boolean {
    if (this.isAtEnd()) {
      return false
    }
    return this.peek().type === type
  }

  protected advance(): Token {
    if (!this.isAtEnd()) {
      this.current++
    }
    return this.previous()
  }

  protected isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF
  }

  protected peek(): Token {
    return this.tokens[this.current]! // Non-null assertion since we check isAtEnd() before calling this
  }

  protected peekNext(): Token | undefined {
    if (this.current + 1 >= this.tokens.length) {
      return undefined
    }
    return this.tokens[this.current + 1]
  }

  protected previous(): Token {
    return this.tokens[this.current - 1]!
  }

  protected consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance()
    }
    this.throwError(message, this.peek())
  }

  protected throwError(message: string, token?: Token): never {
    token =
      token ??
      ({
        type: TokenType.IDENTIFIER,
        value: undefined,
        position: { line: 0, offset: 0, column: 0 },
        length: 0,
      } as unknown as Token)
    const { line, column, offset } = token.position
    const contextRadius = 20
    const snippetStart = Math.max(0, offset - contextRadius)
    const snippetEnd = offset + token.length + contextRadius

    const context = this.tokens
      .slice(snippetStart, snippetEnd)
      .map(t => t.value)
      .join('')

    throw new Exception(Exception.GENERAL_PARSER_ERROR, message).addDetails({
      detail: `Unexpected token "${token.value}" of type ${TokenType[token.type]}.\nContext: ${context}`,
      hint: `Check syntax near line ${line}, column ${column}`,
    })
  }

  protected parseFieldPath(): string | (string | JsonFieldType)[] {
    const parts: (string | JsonFieldType)[] = []

    // First part must be an identifier
    const firstPart = this.consume(
      TokenType.IDENTIFIER,
      'Expected field name',
    ).value
    parts.push(firstPart)

    while (
      this.check(TokenType.DOT) ||
      this.check(TokenType.JSON_EXTRACT) ||
      this.check(TokenType.JSON_EXTRACT_TEXT)
    ) {
      if (this.match(TokenType.DOT)) {
        // Check if the next token is an operator (end of field path) or identifier (continue field path)
        const next = this.peekNext()
        if (
          this.check(TokenType.IDENTIFIER) &&
          next &&
          next.type === TokenType.LPAREN
        ) {
          // This dot is followed by an operator, so we're done with the field path
          // Put the dot back by moving current position back
          this.current--
          break
        }
        // Regular dot notation - continue building field path
        const part = this.consume(
          TokenType.IDENTIFIER,
          "Expected field name after '.'",
        ).value
        parts.push(part)
      } else if (this.match(TokenType.JSON_EXTRACT)) {
        // -> operator
        if (
          !(this.check(TokenType.IDENTIFIER) || this.check(TokenType.NUMBER))
        ) {
          this.throwError(
            "Expected field name or index after '->'",
            this.peek(),
          )
        }
        const partToken = this.advance()
        parts.push({ name: partToken.value, operator: '->', __type: 'json' })
      } else if (this.match(TokenType.JSON_EXTRACT_TEXT)) {
        // ->> operator
        if (
          !(this.check(TokenType.IDENTIFIER) || this.check(TokenType.NUMBER))
        ) {
          this.throwError(
            "Expected field name or index after '->>'",
            this.peek(),
          )
        }
        const partToken = this.advance()
        parts.push({ name: partToken.value, operator: '->>', __type: 'json' })
      }
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
  }

  public parseFieldString(field: string): Condition['field'] {
    // Parse regular field paths with JSON operators
    if (field.includes('->') || field.includes('->>') || field.includes('.')) {
      const parts: (string | JsonFieldType)[] = []
      let current = ''
      let i = 0

      while (i < field.length) {
        if (field.substring(i, i + 3) === '->>') {
          if (current) {
            parts.push({ name: current, operator: '->>', __type: 'json' })
            current = ''
          }
          i += 3
        } else if (field.substring(i, i + 2) === '->') {
          if (current) {
            parts.push({ name: current, operator: '->', __type: 'json' })
            current = ''
          }
          i += 2
        } else if (field[i] === '.') {
          if (parts.some(p => typeof p === 'object' && p.__type === 'json')) {
            this.throwError(
              'Invalid field name - dot (.) cannot be used after JSON operators (-> or ->>)',
              this.peek(),
            )
          }
          if (current) {
            parts.push(current)
            current = ''
          }
          i++
        } else {
          current += field[i]
          i++
        }
      }

      if (current) {
        parts.push(current)
      }

      return parts
    }

    return field
  }

  protected fieldToString(field: string | (string | JsonFieldType)[]): string {
    if (typeof field === 'string') {
      return field
    }

    let result = ''
    for (let i = 0; i < field.length; i++) {
      const part = field[i]!
      if (typeof part === 'string') {
        result += part
        if (i < field.length - 1 && typeof field[i + 1] === 'string') {
          result += '.' // Add a dot if the next part is also a string
        }
      } else {
        result += `${part.operator}${part.name}`
      }
    }
    return result
  }
}

export class GroupParser extends BaseParser {
  constructor(tokens: Token[]) {
    super()
    this.tokens = tokens
  }

  override parseFieldPath(): string | (string | JsonFieldType)[] {
    const parts: (string | JsonFieldType)[] = []

    // First part must be an identifier
    const firstPart = this.consume(
      TokenType.IDENTIFIER,
      'Expected field name',
    ).value
    parts.push(firstPart)

    while (
      this.check(TokenType.DOT) ||
      this.check(TokenType.JSON_EXTRACT) ||
      this.check(TokenType.JSON_EXTRACT_TEXT)
    ) {
      if (this.match(TokenType.DOT)) {
        const part = this.consume(
          TokenType.IDENTIFIER,
          "Expected field name after '.'",
        ).value
        parts.push(part)
      } else if (this.match(TokenType.JSON_EXTRACT)) {
        const part = this.consume(
          TokenType.IDENTIFIER,
          "Expected field name after '->'",
        ).value
        parts.push({ name: part, operator: '->', __type: 'json' })
      } else if (this.match(TokenType.JSON_EXTRACT_TEXT)) {
        const part = this.consume(
          TokenType.IDENTIFIER,
          "Expected field name after '->>'",
        ).value
        parts.push({ name: part, operator: '->>', __type: 'json' })
      }
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
  }

  parse(): Condition['field'][] {
    const fields: Condition['field'][] = []
    while (!this.isAtEnd()) {
      const field = this.fieldToString(this.parseFieldPath())
      fields.push(this.parseFieldString(field))
      if (this.match(TokenType.COMMA)) {
      } else {
        break
      }
    }
    return fields
  }
}

export const allowedOperators = [
  // Comparison operators
  'eq', // =
  'neq', // <> or !=
  'gt', // >
  'gte', // >=
  'lt', // <
  'lte', // <=

  // String operators
  'like', // LIKE
  'ilike', // ILIKE
  'match', // ~
  'imatch', // ~*

  // Array/List operators
  'in', // IN
  'notin', // NOT IN
  'ov', // &&
  'cs', // @>
  'cd', // <@

  // Range operators
  'between', // BETWEEN
  'sl', // <<
  'sr', // >>
  'nxr', // &<
  'nxl', // &>
  'adj', // -|-

  // Null operators
  'is', // IS
  'isnot', // IS NOT
  'null', // IS NULL
  'notnull', // IS NOT NULL
  'isdistinct', // IS DISTINCT FROM

  // Full-Text Search
  'fts', // @@ (to_tsquery)
  'plfts', // @@ (plainto_tsquery)
  'phfts', // @@ (phraseto_tsquery)
  'wfts', // @@ (websearch_to_tsquery)

  // Logical operators
  'and', // AND
  'or', // OR
  'not', // NOT

  // Misc operators
  'all', // ALL
  'any', // ANY
] as const

export type AllowedOperators = (typeof allowedOperators)[number]

export const specialOperators = [
  'limit',
  'group',
  'order',
  'offset',
  'join',
  'shape',
] as const
