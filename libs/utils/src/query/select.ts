import { Logger } from '@nestjs/common';
import { Expression, parser } from './parser';
import { JsonFieldType } from './types';

export interface ColumnNode {
    type: 'column';
    path: string | (string | JsonFieldType)[];
    alias: string | null;
    cast: string | null;
}

export interface EmbedNode {
    type: 'embed';
    resource: string;
    joinType?: 'left' | 'right' | 'inner';
    alias: string | null;
    constraint: Expression;
    select: SelectNode[];
}

export type SelectNode = ColumnNode | EmbedNode;

export class SelectParser {
    private static readonly QUOTE_CHARS = ['"', "'"] as const;
    private static readonly SEPARATOR = ',';
    private static readonly CAST_DELIMITER = '::';
    private static readonly ALIAS_DELIMITER = ':';
    private static logger = new Logger(SelectParser.name)

    private static readonly parser = parser;

    static parse(selectStr: string): SelectNode[] {
        if (typeof selectStr !== 'string' || !selectStr.trim()) {
            throw new Error('Select string cannot be empty');
        }

        const tokens = this.tokenize(selectStr);
        return this.parseTokens(tokens);
    }

    private static tokenize(str: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inQuotes = false;
        let inParens = 0;
        let inBraces = 0; // Track braces for constraints
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
        if (inParens !== 0) throw new Error('Unmatched parentheses in select string');
        if (inBraces !== 0) throw new Error('Unmatched braces in select string');

        this.logger.debug('TOKENS', tokens)
        return tokens;
    }

    private static handleQuotes(char: string, inQuotes: boolean, quoteChar: string | null): boolean {
        return (!inQuotes && this.QUOTE_CHARS.includes(char as any)) || (inQuotes && char === quoteChar);
    }

    private static updateQuoteState(char: string, inQuotes: boolean, quoteChar: string | null) {
        if (!inQuotes && this.QUOTE_CHARS.includes(char as any)) {
            return { inQuotes: true, quoteChar: char };
        }
        if (inQuotes && char === quoteChar) {
            return { inQuotes: false, quoteChar: null };
        }
        return { inQuotes, quoteChar };
    }

    private static handleParentheses(char: string, inQuotes: boolean): boolean {
        return !inQuotes && (char === '(' || char === ')');
    }

    private static handleBraces(char: string, inQuotes: boolean): boolean {
        return !inQuotes && (char === '{' || char === '}');
    }

    private static isSeparator(char: string, inQuotes: boolean, inParens: number, inBraces: number): boolean {
        return !inQuotes && inParens === 0 && inBraces === 0 && char === this.SEPARATOR;
    }

    private static parseTokens(tokens: string[]): SelectNode[] {
        return tokens.map(token => {
            if (!token.trim()) throw new Error('Empty token in select string');
            return this.isEmbedToken(token) ? this.parseEmbed(token) : this.parseColumn(token);
        });
    }

    private static isEmbedToken(token: string): boolean {
        return token.includes('{') && token.includes('}') && token.includes('(') && token.endsWith(')');
    }

    private static parseColumn(token: string): ColumnNode {
        let workingToken = token.trim();

        const { value: tokenWithoutCast, cast } = this.extractCast(workingToken);
        workingToken = tokenWithoutCast;

        const { value: _path, alias } = this.extractAlias(workingToken);

        if (!_path) throw new Error(`Invalid column specification: ${token}`);
        const path = parser._parseField(_path)

        return {
            type: 'column',
            path,
            alias,
            cast
        };
    }

    private static extractCast(token: string): { value: string; cast: string | null } {
        const castIndex = token.lastIndexOf(this.CAST_DELIMITER);
        if (castIndex === -1) return { value: token, cast: null };

        const cast = token.substring(castIndex + this.CAST_DELIMITER.length).trim();
        const value = token.substring(0, castIndex).trim();

        if (!cast) throw new Error(`Invalid cast specification: ${token}`);

        return { value, cast };
    }

    private static extractAlias(token: string): { value: string; alias: string | null } {
        const aliasIndex = token.indexOf(this.ALIAS_DELIMITER);
        if (aliasIndex !== -1) {
            const alias = token.slice(0, aliasIndex).trim();
            const value = token.slice(aliasIndex + 1).trim();

            if (!alias || !value) throw new Error(`Invalid alias specification: ${token}`);
            return { value, alias };
        }

        return { value: token, alias: null };
    }

    private static parseEmbed(token: string): EmbedNode {
        //format: resource$joinType{constraints}(select)
        const match = token.match(/^([^{$]+)(?:\$([^{]+))?{([^}]*)}?\((.+)\)$/s);
        if (!match) throw new Error(`Invalid embed syntax: ${token}`);

        const [_, resourceWithAlias, joinTypeRaw, constraintPart, selectPart] = match;

        // Parse resource and alias
        const { value: resource, alias } = this.extractAlias(resourceWithAlias.trim());

        // Parse join type
        const joinType = (joinTypeRaw?.trim() || 'inner') as 'left' | 'right' | 'inner';

        // Parse constraints
        let constraint: Expression;
        if (constraintPart && constraintPart.trim()) {
            constraint = this.parser.parse(constraintPart.trim());
        } else {
            throw new Error(`Missing constraint in embed: ${token}`);
        }

        // Parse inner select
        if (!selectPart.trim()) throw new Error(`Empty select in embed: ${token}`); // TODO

        const select = this.parse(selectPart);
        this.logger.debug({
            resource,
            joinType,
            alias,
            constraint,
            select
        })
        return {
            type: 'embed',
            resource,
            joinType,
            alias,
            constraint,
            select
        };
    }
}
