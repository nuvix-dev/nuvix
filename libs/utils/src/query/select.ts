import { Logger } from '@nestjs/common';
import { Parser } from './parser';
import type {
  ColumnNode,
  EmbedNode,
  EmbedParserResult,
  SelectNode,
} from './types';

export class SelectParser {
  private readonly QUOTE_CHARS = ['"', "'"] as const;
  private readonly SEPARATOR = ',';
  private readonly CAST_DELIMITER = '::';
  private readonly ALIAS_DELIMITER = ':';
  private logger = new Logger(SelectParser.name);
  private depth: number = 0;
  private maxDepth: number = 3;

  private tableName: string;

  constructor({ tableName, depth = 0 }: { tableName: string; depth?: number }) {
    this.tableName = tableName;
    this.depth = depth;
  }

  parse(selectStr: string): SelectNode[] {
    if (typeof selectStr !== 'string' || !selectStr.trim()) {
      throw new Error('Select string cannot be empty');
    }

    const tokens = this.tokenize(selectStr);
    return this.parseTokens(tokens);
  }

  private tokenize(str: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let inParens = 0;
    let inBraces = 0;
    let quoteChar: string | null = null;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (this.handleQuotes(char, inQuotes, quoteChar)) {
        const result = this.updateQuoteState(char, inQuotes, quoteChar);
        inQuotes = result.inQuotes;
        quoteChar = result.quoteChar;
        current += char;
      } else if (this.handleParentheses(char, inQuotes)) {
        inParens += char === '(' ? 1 : -1;
        current += char;
      } else if (this.handleBraces(char, inQuotes)) {
        inBraces += char === '{' ? 1 : -1;
        current += char;
      } else if (this.isSeparator(char, inQuotes, inParens, inBraces)) {
        if (current.trim()) tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) tokens.push(current.trim());

    if (inQuotes) throw new Error('Unclosed quote in select string');
    if (inParens !== 0)
      throw new Error('Unmatched parentheses in select string');
    if (inBraces !== 0) throw new Error('Unmatched braces in select string');

    return tokens;
  }

  private handleQuotes(
    char: string,
    inQuotes: boolean,
    quoteChar: string | null,
  ): boolean {
    return (
      (!inQuotes && this.QUOTE_CHARS.includes(char as any)) ||
      (inQuotes && char === quoteChar)
    );
  }

  private updateQuoteState(
    char: string,
    inQuotes: boolean,
    quoteChar: string | null,
  ) {
    if (!inQuotes && this.QUOTE_CHARS.includes(char as any)) {
      return { inQuotes: true, quoteChar: char };
    }
    if (inQuotes && char === quoteChar) {
      return { inQuotes: false, quoteChar: null };
    }
    return { inQuotes, quoteChar };
  }

  private handleParentheses(char: string, inQuotes: boolean): boolean {
    return !inQuotes && (char === '(' || char === ')');
  }

  private handleBraces(char: string, inQuotes: boolean): boolean {
    return !inQuotes && (char === '{' || char === '}');
  }

  private isSeparator(
    char: string,
    inQuotes: boolean,
    inParens: number,
    inBraces: number,
  ): boolean {
    return (
      !inQuotes && inParens === 0 && inBraces === 0 && char === this.SEPARATOR
    );
  }

  private parseTokens(tokens: string[]): SelectNode[] {
    return tokens.map(token => {
      if (!token.trim()) throw new Error('Empty token in select string');
      return this.isEmbedToken(token)
        ? this.parseEmbed(token)
        : this.parseColumn(token);
    });
  }

  private isEmbedToken(token: string): boolean {
    return !!this.extractEmbedToken(token);
  }

  private extractEmbedToken(token: string): string[] {
    return token.match(
      /^(?:(\.{3})?)?(?:([^${:({]+):)?([^${:({]+){([^}]*)}(?:\((.*?)\))?$/s,
    );
  }

  private parseColumn(token: string): ColumnNode {
    let workingToken = token.trim();

    const { value: tokenWithoutCast, cast } = this.extractCast(workingToken);
    workingToken = tokenWithoutCast;

    const { value: _path, alias } = this.extractAlias(workingToken);

    if (!_path) throw new Error(`Invalid column specification: ${token}`);
    const path = Parser.create({ tableName: this.tableName }).parseFieldString(
      _path,
    );

    return {
      type: 'column',
      path,
      alias,
      tableName: this.tableName,
      cast,
    };
  }

  private extractCast(token: string): { value: string; cast: string | null } {
    const castIndex = token.lastIndexOf(this.CAST_DELIMITER);
    if (castIndex === -1) return { value: token, cast: null };

    const cast = token.substring(castIndex + this.CAST_DELIMITER.length).trim();
    const value = token.substring(0, castIndex).trim();

    if (!cast) throw new Error(`Invalid cast specification: ${token}`);

    return { value, cast };
  }

  private extractAlias(token: string): { value: string; alias: string | null } {
    const aliasIndex = token.indexOf(this.ALIAS_DELIMITER);
    if (aliasIndex !== -1) {
      const alias = token.slice(0, aliasIndex).trim();
      const value = token.slice(aliasIndex + 1).trim();

      if (!alias || !value)
        throw new Error(`Invalid alias specification: ${token}`);
      return { value, alias };
    }

    return { value: token, alias: null };
  }

  private parseEmbed(token: string): EmbedNode {
    if (this.depth > this.maxDepth) {
      throw new Error('Max depth limit reached.');
    }
    const match = this.extractEmbedToken(token);

    const [
      _,
      flatten,
      aliasRaw,
      fullResourceString,
      constraintPart,
      selectPart,
    ] = match;

    let resource: string;
    let cardinalityHint: 'one' | 'many' | undefined;

    const parts = fullResourceString.split('.');
    const lastPart = parts[parts.length - 1].trim();

    if (lastPart === 'one' || lastPart === 'many') {
      cardinalityHint = lastPart;
      // The actual table name is everything EXCEPT the last part
      resource = parts.slice(0, -1).join('.').trim();
      if (resource === '') {
        // Handle case like ".one" or just "one"
        throw new Error(
          `Invalid resource name for cardinality hint: ${fullResourceString}`,
        );
      }
    } else {
      resource = fullResourceString.trim();
      cardinalityHint = undefined;
    }

    if (!resource) {
      throw new Error(`Invalid resource name: "${fullResourceString}"`);
    }

    const flattenFlag = !!flatten;
    const alias = aliasRaw?.trim() || null;
    let joinType = 'left' as EmbedParserResult['joinType'];
    const shape = cardinalityHint === 'one' ? 'object' : 'array';

    // Constraints (required)
    if (!constraintPart?.trim())
      throw new Error(`Missing constraint in embed: ${token}`);
    const constraint = Parser.create<EmbedParserResult>({
      tableName: alias || resource,
      mainTable: this.tableName,
    }).parse(constraintPart.trim());

    if (constraint.joinType) {
      joinType = constraint.joinType;
    }

    // Select (optional if shaping is indicated)
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
        ];

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
    };
  }
}
