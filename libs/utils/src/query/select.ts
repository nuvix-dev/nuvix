interface ColumnNode {
    type: 'column';
    path: string;
    alias: string | null;
    cast: string | null;
}

interface EmbedNode {
    type: 'embed';
    resource: string;
    constraint: string | null;
    alias: string | null;
    select: SelectNode[];
}

export type SelectNode = ColumnNode | EmbedNode;

export class SelectParser {
    private static readonly QUOTE_CHARS = ['"', "'"] as const;
    private static readonly SEPARATOR = ',';
    private static readonly CAST_DELIMITER = '::';
    private static readonly ALIAS_DELIMITER = ':';
    private static readonly CONSTRAINT_DELIMITER = '!';

    static parse(selectStr: string): SelectNode[] {
        if (!selectStr?.trim()) {
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
            } else if (this.isSeparator(char, inQuotes, inParens)) {
                if (current.trim()) {
                    tokens.push(current.trim());
                }
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            tokens.push(current.trim());
        }

        if (inQuotes) {
            throw new Error('Unclosed quote in select string');
        }

        if (inParens !== 0) {
            throw new Error('Unmatched parentheses in select string');
        }

        return tokens;
    }

    private static handleQuotes(char: string, inQuotes: boolean, quoteChar: string | null): boolean {
        return (this.QUOTE_CHARS.includes(char as any) && !inQuotes) ||
            (inQuotes && char === quoteChar);
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

    private static isSeparator(char: string, inQuotes: boolean, inParens: number): boolean {
        return !inQuotes && inParens === 0 && char === this.SEPARATOR;
    }

    private static parseTokens(tokens: string[]): SelectNode[] {
        return tokens.map(token => {
            if (!token.trim()) {
                throw new Error('Empty token in select string');
            }

            return this.isEmbedToken(token)
                ? this.parseEmbed(token)
                : this.parseColumn(token);
        });
    }

    private static isEmbedToken(token: string): boolean {
        return token.includes('(') && token.endsWith(')');
    }

    private static parseColumn(token: string): ColumnNode {
        let workingToken = token.trim();

        // Extract cast
        const { value: tokenWithoutCast, cast } = this.extractCast(workingToken);
        workingToken = tokenWithoutCast;

        // Extract alias
        const { value: path, alias } = this.extractAlias(workingToken);

        if (!path) {
            throw new Error(`Invalid column specification: ${token}`);
        }

        return {
            type: 'column',
            path,
            alias,
            cast
        };
    }

    private static extractCast(token: string): { value: string; cast: string | null } {
        const castIndex = token.indexOf(this.CAST_DELIMITER);
        if (castIndex === -1) {
            return { value: token, cast: null };
        }

        const cast = token.substring(castIndex + this.CAST_DELIMITER.length).trim();
        const value = token.substring(0, castIndex).trim();

        if (!cast) {
            throw new Error(`Invalid cast specification: ${token}`);
        }

        return { value, cast };
    }

    private static extractAlias(token: string): { value: string; alias: string | null } {
        const parts = token.split(this.ALIAS_DELIMITER);
        if (parts.length === 2) {
            const [alias, value] = parts.map(p => p.trim());
            if (!alias || !value) {
                throw new Error(`Invalid alias specification: ${token}`);
            }
            return { value, alias };
        }
        if (parts.length > 2) {
            throw new Error(`Multiple alias delimiters in: ${token}`);
        }
        return { value: token, alias: null };
    }

    private static parseEmbed(token: string): EmbedNode {
        const match = token.match(/^([\w!:]+)\((.*)\)$/);
        if (!match) {
            throw new Error(`Invalid embed syntax: ${token}`);
        }

        const [_, resourceSpec, innerSelect] = match;

        // Parse resource specification
        const { resource, constraint, alias } = this.parseResourceSpec(resourceSpec);

        // Parse inner select
        if (!innerSelect.trim()) {
            throw new Error(`Empty select in embed: ${token}`);
        }

        const innerTokens = this.tokenize(innerSelect);
        const select = this.parseTokens(innerTokens);

        return {
            type: 'embed',
            resource,
            constraint,
            alias,
            select
        };
    }

    private static parseResourceSpec(resourceSpec: string): {
        resource: string;
        constraint: string | null;
        alias: string | null;
    } {
        let workingSpec = resourceSpec.trim();

        // Extract alias first
        const { value: specWithoutAlias, alias } = this.extractAlias(workingSpec);
        workingSpec = specWithoutAlias;

        // Extract constraint
        const constraintIndex = workingSpec.indexOf(this.CONSTRAINT_DELIMITER);
        let resource: string;
        let constraint: string | null = null;

        if (constraintIndex !== -1) {
            resource = workingSpec.substring(0, constraintIndex).trim();
            constraint = workingSpec.substring(constraintIndex + 1).trim();

            if (!resource || !constraint) {
                throw new Error(`Invalid constraint specification: ${resourceSpec}`);
            }
        } else {
            resource = workingSpec;
        }

        if (!resource) {
            throw new Error(`Invalid resource specification: ${resourceSpec}`);
        }

        return { resource, constraint, alias };
    }
}
