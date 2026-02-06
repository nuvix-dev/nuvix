import { Exception } from '@nuvix/core/extend/exception'
import { Parser } from './parser'
import type {
  ColumnNode,
  EmbedNode,
  EmbedParserResult,
  SelectNode,
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
    maxDepth !== undefined && (this.maxDepth = maxDepth)
    this.depth = depth
  }

  parse(selectStr?: string): SelectNode[] {
    if (selectStr === null || selectStr === undefined) {
      return []
    }

    if (typeof selectStr !== 'string' || !selectStr.trim()) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        'Select string must be a non-empty string',
      )
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
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        'Unmatched quotes in select string',
      ).addDetails({
        hint: 'Ensure all quotes are properly closed.',
        detail: `Unmatched quote at position ${str.length - current.length}, context: "${current}"`,
      })
    }
    if (inParens !== 0) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        'Unmatched parentheses in select string',
      ).addDetails({
        hint: 'Ensure all parentheses are properly closed.',
        detail: `Unmatched parenthesis at position ${str.length - current.length}, context: "${current}"`,
      })
    }
    if (inBraces !== 0) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        'Unmatched braces in select string',
      ).addDetails({
        hint: 'Ensure all braces are properly closed.',
        detail: `Unmatched brace at position ${str.length - current.length}, context: "${current}"`,
      })
    }

    return tokens
  }

  private handleQuotes(
    char: string,
    inQuotes: boolean,
    quoteChar: string | null,
  ): boolean {
    return (
      (!inQuotes && this.QUOTE_CHARS.includes(char as any)) ||
      (inQuotes && char === quoteChar)
    )
  }

  private updateQuoteState(
    char: string,
    inQuotes: boolean,
    quoteChar: string | null,
  ) {
    if (!inQuotes && this.QUOTE_CHARS.includes(char as any)) {
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
    return (
      !inQuotes && inParens === 0 && inBraces === 0 && char === this.SEPARATOR
    )
  }

  private parseTokens(tokens: string[]): SelectNode[] {
    return tokens.map(token => {
      if (!token.trim()) {
        throw new Exception(
          Exception.GENERAL_PARSER_ERROR,
          'Empty token found in select string',
        ).addDetails({
          hint: 'Ensure all tokens are properly defined.',
          detail: `Empty token at position ${tokens.indexOf(token) + 1}`,
        })
      }
      return this.isEmbedToken(token)
        ? this.parseEmbed(token)
        : this.parseColumn(token)
    })
  }

  private isEmbedToken(token: string): boolean {
    return !!this.extractEmbedToken(token)
  }

  private extractEmbedToken(token: string): RegExpMatchArray | null {
    return token.match(
      /^(?:(\.{3})?)?(?:([^${:({]+):)?([^${:({]+){([^}]*)}(?:\((.*?)\))?$/s,
    )
  }

  private parseColumn(token: string): ColumnNode {
    let workingToken = token.trim()

    // Extract alias (e.g., alias:col), but only if not inside function parentheses
    const { value: tokenWithoutAlias, alias } = this.extractAlias(workingToken)
    workingToken = tokenWithoutAlias

    // Extract cast (e.g., col::int or sum(col)::int)
    const { value: tokenWithoutCast, cast: outerCast } =
      this.extractCast(workingToken)
    workingToken = tokenWithoutCast

    // Check for aggregation function (e.g., sum(col))
    // Allow aggregation functions with optional cast, e.g., avg(Stock::int)
    const fnMatch = workingToken.match(
      /^(\w+)\(([^()]*(?:\([^()]*\)[^()]*)*)\)$/,
    )
    let aggregate: { fn: string; cast?: string | null } | undefined
    let pathStr = workingToken
    let finalAlias: string | null = null
    let cast = outerCast

    if (fnMatch) {
      const fn = fnMatch[1]!
      if (!this.allowedAggregations.includes(fn)) {
        throw new Exception(
          Exception.GENERAL_PARSER_ERROR,
          `Unsupported aggregation function: ${fn}. Allowed functions are: ${this.allowedAggregations.join(', ')}`,
        )
      }
      const arg = fnMatch[2]?.trim()!

      // Support cast inside aggregation, e.g., sum(col::int)
      const { value: columnArg, cast: innerCast } = this.extractCast(arg)
      aggregate = { fn, cast: outerCast }
      cast = innerCast
      pathStr = fn === 'count' ? columnArg || '*' : columnArg
    } else {
      pathStr = workingToken
    }

    if (!pathStr) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        'Column path cannot be empty',
      ).addDetails({
        hint: 'Ensure the column path is correctly specified.',
        detail: `Invalid column path in token: "${token}"`,
      })
    }
    finalAlias = alias ?? finalAlias

    const path = Parser.create({ tableName: this.tableName }).parseFieldString(
      pathStr,
    )

    return {
      type: 'column',
      path,
      alias: finalAlias,
      tableName: this.tableName,
      cast,
      aggregate: aggregate as any,
    }
  }

  // Only extract alias if ':' is not inside parentheses
  private extractAlias(token: string): { value: string; alias: string | null } {
    let parenDepth = 0
    for (let i = 0; i < token.length; i++) {
      const char = token[i]
      if (char === '(') {
        parenDepth++
      } else if (char === ')') {
        parenDepth--
      } else if (char === this.ALIAS_DELIMITER && parenDepth === 0) {
        const alias = token.slice(0, i).trim()
        const value = token.slice(i + 1).trim()
        if (!alias || !value) {
          throw new Exception(
            Exception.GENERAL_PARSER_ERROR,
            `Invalid alias syntax: ${token}`,
          ).addDetails({
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
    // Only extract cast if '::' is not inside parentheses
    let parenDepth = 0
    for (let i = token.length - 1; i >= 0; i--) {
      const char = token[i]
      if (char === ')') {
        parenDepth++
      } else if (char === '(') {
        parenDepth--
      } else if (
        token.slice(i - this.CAST_DELIMITER.length + 1, i + 1) ===
          this.CAST_DELIMITER &&
        parenDepth === 0
      ) {
        const cast = token.substring(i + 1).trim()
        const value = token
          .substring(0, i - this.CAST_DELIMITER.length + 1)
          .trim()
        if (!cast) {
          throw new Exception(
            Exception.GENERAL_PARSER_ERROR,
            `Invalid cast syntax: ${token}`,
          ).addDetails({
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
      throw new Error(`Max depth limit reached. ${this.depth}`)
    }
    const match = this.extractEmbedToken(token)

    if (!match) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        `Invalid embed syntax: ${token}`,
      ).addDetails({
        hint: 'Ensure embed syntax is properly defined.',
        detail: `Invalid embed in token: "${token}"`,
      })
    }

    const [
      _,
      flatten,
      aliasRaw,
      fullResourceString,
      constraintPart,
      selectPart,
    ] = match

    let resource: string | undefined
    let cardinalityHint: 'one' | 'many' | undefined

    const parts = fullResourceString?.split('.')!
    const lastPart = parts[parts.length - 1]?.trim()

    if (
      parts.length > 1 &&
      parts.length <= 3 &&
      (lastPart === 'one' || lastPart === 'many')
    ) {
      cardinalityHint = lastPart
      // The actual table name is everything EXCEPT the last part
      resource = parts.slice(0, -1).join('.').trim()
      if (resource === '') {
        // Handle case like ".one" or just "one"
        throw new Exception(
          Exception.GENERAL_PARSER_ERROR,
          `Invalid resource name: "${fullResourceString}"`,
        ).addDetails({
          hint: 'Ensure the resource name is properly defined.',
          detail: `Invalid resource name in token: "${token}"`,
        })
      }
    } else if (parts.length > 2) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        `Invalid resource name: "${fullResourceString}"`,
      ).addDetails({
        hint: 'Resource name should not contain more than two dots.',
        detail: `Invalid resource name in token: "${token}"`,
      })
    } else {
      resource = fullResourceString?.trim()
      cardinalityHint = undefined
    }

    if (!resource) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        `Resource name cannot be empty in embed: ${token}`,
      ).addDetails({
        hint: 'Ensure the resource name is properly defined.',
        detail: `Invalid resource name in token: "${token}"`,
      })
    }

    const flattenFlag = !!flatten
    const alias = aliasRaw?.trim() || null
    let joinType = 'left' as EmbedParserResult['joinType']
    const shape = cardinalityHint === 'one' ? 'object' : 'array'

    if (!constraintPart?.trim()) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        `Filter constraint cannot be empty in embed: ${token}`,
      ).addDetails({
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
          } as SelectNode,
        ]

    return {
      type: 'embed',
      resource,
      mainTable: this.tableName,
      joinType: joinType!,
      alias: alias!,
      constraint,
      select,
      shape,
      flatten: flattenFlag,
    }
  }
}
