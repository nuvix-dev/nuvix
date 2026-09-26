import { Parser } from './parser'
import {
  type ColumnNode,
  type EmbedNode,
  type EmbedParserResult,
  QueryParserError,
  type SelectNode,
} from './types'

export class SelectParser {
  private readonly QUOTE_CHARS = ['"', "'"] as const
  private readonly SEPARATOR = ','
  private readonly CAST_DELIMITER = '::'
  private readonly ALIAS_DELIMITER = ':'
  private depth = 0
  private readonly maxDepth: number = 2
  private readonly allowedAggregations = ['sum', 'count', 'min', 'max', 'avg']

  private tableName: string

  constructor({
    tableName,
    depth = 0,
    maxDepth,
  }: {
    tableName: string
    depth?: number
    maxDepth?: number
  }) {
    this.tableName = tableName
    if (depth < 0) {
      throw new Error('Depth cannot be negative')
    }
    if (maxDepth !== undefined) {
      this.maxDepth = maxDepth
    }
    this.depth = depth
  }

  parse(selectStr?: string): SelectNode[] {
    if (selectStr === null || selectStr === undefined) {
      return []
    }

    if (typeof selectStr !== 'string' || !selectStr.trim()) {
      throw new QueryParserError('Select string must be a non-empty string', {
        code: 'general_parser_error',
      })
    }

    const tokens = this.tokenize(selectStr)
    return this.parseTokens(tokens)
  }

  private tokenize(str: string): string[] {
    const tokens: string[] = []
    let current = ''
    let inQuotes = false
    let inParens = 0
    let inBraces = 0
    let quoteChar: string | null = null

    for (let i = 0; i < str.length; i++) {
      const char = str[i]!

      if (this.handleQuotes(char, inQuotes, quoteChar)) {
        const result = this.updateQuoteState(char, inQuotes, quoteChar)
        inQuotes = result.inQuotes
        quoteChar = result.quoteChar
        current += char
      } else if (this.handleParentheses(char, inQuotes)) {
        inParens += char === '(' ? 1 : -1
        current += char
      } else if (this.handleBraces(char, inQuotes)) {
        inBraces += char === '{' ? 1 : -1
        current += char
      } else if (this.isSeparator(char, inQuotes, inParens, inBraces)) {
        if (current.trim()) {
          tokens.push(current.trim())
        }
        current = ''
      } else {
        current += char
      }
    }

    if (current.trim()) {
      tokens.push(current.trim())
    }

    if (inQuotes) {
      throw new QueryParserError('Unmatched quotes in select string', {
        code: 'general_parser_error',
        hint: 'Ensure all quotes are properly closed.',
        detail: `Unmatched quote at position ${str.length - current.length}, context: "${current}"`,
      })
    }
    if (inParens !== 0) {
      throw new QueryParserError('Unmatched parentheses in select string', {
        code: 'general_parser_error',
        hint: 'Ensure all parentheses are properly closed.',
        detail: `Unmatched parenthesis at position ${str.length - current.length}, context: "${current}"`,
      })
    }
    if (inBraces !== 0) {
      throw new QueryParserError('Unmatched braces in select string', {
        code: 'general_parser_error',
        hint: 'Ensure all braces are properly closed.',
        detail: `Unmatched brace at position ${str.length - current.length}, context: "${current}"`,
      })
    }

    return tokens
  }

  private handleQuotes(char: string, inQuotes: boolean, quoteChar: string | null): boolean {
    return (
      (!inQuotes && (this.QUOTE_CHARS as readonly string[]).includes(char)) ||
      (inQuotes && char === quoteChar)
    )
  }

  private updateQuoteState(
    char: string,
    inQuotes: boolean,
    quoteChar: string | null,
  ): { inQuotes: boolean; quoteChar: string | null } {
    if (!inQuotes && (this.QUOTE_CHARS as readonly string[]).includes(char)) {
      return { inQuotes: true, quoteChar: char }
    }
    if (inQuotes && char === quoteChar) {
      return { inQuotes: false, quoteChar: null }
    }
    return { inQuotes, quoteChar }
  }

  private handleParentheses(char: string, inQuotes: boolean): boolean {
    return !inQuotes && (char === '(' || char === ')')
  }

  private handleBraces(char: string, inQuotes: boolean): boolean {
    return !inQuotes && (char === '{' || char === '}')
  }

  private isSeparator(
    char: string,
    inQuotes: boolean,
    inParens: number,
    inBraces: number,
  ): boolean {
    return !inQuotes && inParens === 0 && inBraces === 0 && char === this.SEPARATOR
  }

  private parseTokens(tokens: string[]): SelectNode[] {
    return tokens.map((token) => {
      if (!token.trim()) {
        throw new QueryParserError('Empty token found in select string', {
          code: 'general_parser_error',
          hint: 'Ensure all tokens are properly defined.',
          detail: `Empty token at position ${tokens.indexOf(token) + 1}`,
        })
      }
      return this.isEmbedToken(token) ? this.parseEmbed(token) : this.parseColumn(token)
    })
  }

  private isEmbedToken(token: string): boolean {
    return !!this.extractEmbedToken(token)
  }

  private extractEmbedToken(token: string): RegExpMatchArray | null {
    return token.match(/^(?:(\.{3})?)?(?:([^${:({]+):)?([^${:({]+){([^}]*)}(?:\((.*?)\))?$/s)
  }

  private parseColumn(token: string): ColumnNode {
    let workingToken = token.trim()

    const { value: tokenWithoutAlias, alias } = this.extractAlias(workingToken)
    workingToken = tokenWithoutAlias

    const { value: tokenWithoutCast, cast: outerCast } = this.extractCast(workingToken)
    workingToken = tokenWithoutCast

    const fnMatch = workingToken.match(/^(\w+)\(([^()]*(?:\([^()]*\)[^()]*)*)\)$/)
    let aggregate: { fn: 'sum' | 'count' | 'min' | 'max' | 'avg'; cast?: string } | undefined
    let pathStr = workingToken
    let finalAlias: string | null = null
    let cast = outerCast

    if (fnMatch) {
      const fn = fnMatch[1]!
      if (!this.allowedAggregations.includes(fn)) {
        throw new QueryParserError(
          `Unsupported aggregation function: ${fn}. Allowed functions are: ${this.allowedAggregations.join(', ')}`,
          { code: 'general_parser_error' },
        )
      }
      const arg = fnMatch[2]?.trim() ?? ''

      const { value: columnArg, cast: innerCast } = this.extractCast(arg)
      aggregate = {
        fn: fn as 'sum' | 'count' | 'min' | 'max' | 'avg',
        cast: outerCast ?? undefined,
      }
      cast = innerCast
      pathStr = fn === 'count' ? columnArg || '*' : columnArg
    } else {
      pathStr = workingToken
    }

    if (!pathStr) {
      throw new QueryParserError('Column path cannot be empty', {
        code: 'general_parser_error',
        hint: 'Ensure the column path is correctly specified.',
        detail: `Invalid column path in token: "${token}"`,
      })
    }
    finalAlias = alias ?? finalAlias

    const path = Parser.create({ tableName: this.tableName }).parseFieldString(pathStr)

    return {
      type: 'column',
      path,
      alias: finalAlias,
      tableName: this.tableName,
      cast,
      aggregate,
    }
  }

  private extractAlias(token: string): { value: string; alias: string | null } {
    let parenDepth = 0
    for (let i = 0; i < token.length; i++) {
      const char = token[i]
      if (char === '(') {
        parenDepth++
      } else if (char === ')') {
        parenDepth--
      } else if (
        char === this.ALIAS_DELIMITER &&
        parenDepth === 0 &&
        token[i + 1] !== this.ALIAS_DELIMITER &&
        token[i - 1] !== this.ALIAS_DELIMITER
      ) {
        const alias = token.slice(0, i).trim()
        const value = token.slice(i + 1).trim()
        if (!alias || !value) {
          throw new QueryParserError(`Invalid alias syntax: ${token}`, {
            code: 'general_parser_error',
            hint: 'Ensure alias and value are properly defined.',
            detail: `Invalid alias in token: "${token}"`,
          })
        }
        return { value, alias }
      }
    }
    return { value: token, alias: null }
  }

  private extractCast(token: string): { value: string; cast: string | null } {
    let parenDepth = 0
    for (let i = token.length - 1; i >= 0; i--) {
      const char = token[i]
      if (char === ')') {
        parenDepth++
      } else if (char === '(') {
        parenDepth--
      } else if (
        token.slice(i - this.CAST_DELIMITER.length + 1, i + 1) === this.CAST_DELIMITER &&
        parenDepth === 0
      ) {
        const cast = token.substring(i + 1).trim()
        const value = token.substring(0, i - this.CAST_DELIMITER.length + 1).trim()
        if (!cast) {
          throw new QueryParserError(`Invalid cast syntax: ${token}`, {
            code: 'general_parser_error',
            hint: 'Ensure cast is properly defined.',
            detail: `Invalid cast in token: "${token}"`,
          })
        }
        return { value, cast }
      }
    }
    return { value: token, cast: null }
  }

  private parseEmbed(token: string): EmbedNode {
    if (this.depth > this.maxDepth) {
      throw new QueryParserError(`Max depth limit reached. ${this.depth}`, {
        code: 'general_parser_error',
      })
    }
    const match = this.extractEmbedToken(token)

    if (!match) {
      throw new QueryParserError(`Invalid embed syntax: ${token}`, {
        code: 'general_parser_error',
        hint: 'Ensure embed syntax is properly defined.',
        detail: `Invalid embed in token: "${token}"`,
      })
    }

    const [_, flatten, aliasRaw, fullResourceString, constraintPart, selectPart] = match

    let resource: string | undefined
    let cardinalityHint: 'one' | 'many' | undefined

    const parts = (fullResourceString ?? '').split('.')
    const lastPart = parts[parts.length - 1]?.trim()

    if (parts.length > 1 && parts.length <= 3 && (lastPart === 'one' || lastPart === 'many')) {
      cardinalityHint = lastPart
      resource = parts.slice(0, -1).join('.').trim()
      if (resource === '') {
        throw new QueryParserError(`Invalid resource name: "${fullResourceString}"`, {
          code: 'general_parser_error',
          hint: 'Ensure the resource name is properly defined.',
          detail: `Invalid resource name in token: "${token}"`,
        })
      }
    } else if (parts.length > 2) {
      throw new QueryParserError(`Invalid resource name: "${fullResourceString}"`, {
        code: 'general_parser_error',
        hint: 'Resource name should not contain more than two dots.',
        detail: `Invalid resource name in token: "${token}"`,
      })
    } else {
      resource = fullResourceString?.trim()
      cardinalityHint = undefined
    }

    if (!resource) {
      throw new QueryParserError(`Resource name cannot be empty in embed: ${token}`, {
        code: 'general_parser_error',
        hint: 'Ensure the resource name is properly defined.',
        detail: `Invalid resource name in token: "${token}"`,
      })
    }

    const flattenFlag = !!flatten
    const alias = aliasRaw?.trim() || undefined
    let joinType: 'left' | 'right' | 'inner' | 'full' | 'cross' = 'left'
    const shape: 'array' | 'object' = cardinalityHint === 'one' ? 'object' : 'array'

    if (!constraintPart?.trim()) {
      throw new QueryParserError(`Filter constraint cannot be empty in embed: ${token}`, {
        code: 'general_parser_error',
        hint: 'Ensure the constraint part is properly defined.',
        detail: `Invalid constraint in token: "${token}"`,
      })
    }
    const constraint = Parser.create<EmbedParserResult>({
      tableName: alias || resource,
      mainTable: this.tableName,
    }).parse(constraintPart.trim())

    if (constraint.joinType) {
      joinType = constraint.joinType
    }

    const select = selectPart?.trim()
      ? new SelectParser({
          tableName: alias || resource,
          depth: ++this.depth,
        }).parse(selectPart.trim())
      : [
          {
            type: 'column',
            tableName: alias || resource,
            path: '*',
            alias: null,
            cast: null,
          } as SelectNode,
        ]

    return {
      type: 'embed',
      resource,
      mainTable: this.tableName,
      joinType,
      alias,
      constraint,
      select,
      shape,
      flatten: flattenFlag,
    }
  }
}
