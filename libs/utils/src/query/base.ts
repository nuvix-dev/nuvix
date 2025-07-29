import type {
    Condition,
    JsonFieldType,
} from './types';
import { ParserError } from './error';
import { Token, TokenType } from './tokenizer';


export abstract class BaseParser {
    protected tableName: string;
    protected mainTable: string;
    protected tokens: Token[] = [];
    protected current: number = 0;

    // Token navigation methods
    protected match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    protected check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    protected advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    protected isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }

    protected peek(): Token {
        return this.tokens[this.current];
    }

    protected peekNext(): Token | undefined {
        if (this.current + 1 >= this.tokens.length) return undefined;
        return this.tokens[this.current + 1];
    }

    protected previous(): Token {
        return this.tokens[this.current - 1];
    }

    protected consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        this.throwError(message, this.peek());
    }

    protected throwError(message: string, token: Token): never {
        throw new ParserError(message, token.position, token.value, {
            expected: 'valid syntax',
            received: token.value,
        });
    }

    protected parseFieldPath(): string | (string | JsonFieldType)[] {
        const parts: (string | JsonFieldType)[] = [];

        // First part must be an identifier
        const firstPart = this.consume(
            TokenType.IDENTIFIER,
            'Expected field name',
        ).value;
        parts.push(firstPart);

        while (
            this.check(TokenType.DOT) ||
            this.check(TokenType.JSON_EXTRACT) ||
            this.check(TokenType.JSON_EXTRACT_TEXT)
        ) {
            if (this.match(TokenType.DOT)) {
                // Check if the next token is an operator (end of field path) or identifier (continue field path)
                const next = this.peekNext();
                if (this.check(TokenType.IDENTIFIER) && next && next.type === TokenType.LPAREN) {
                    // This dot is followed by an operator, so we're done with the field path
                    // Put the dot back by moving current position back
                    this.current--;
                    break;
                }
                // Regular dot notation - continue building field path
                const part = this.consume(
                    TokenType.IDENTIFIER,
                    "Expected field name after '.'",
                ).value;
                parts.push(part);
            } else if (this.match(TokenType.JSON_EXTRACT)) {
                // -> operator
                const part = this.consume(
                    TokenType.IDENTIFIER,
                    "Expected field name after '->'",
                ).value;
                parts.push({ name: part, operator: '->', __type: 'json' });
            } else if (this.match(TokenType.JSON_EXTRACT_TEXT)) {
                // ->> operator
                const part = this.consume(
                    TokenType.IDENTIFIER,
                    "Expected field name after '->>'",
                ).value;
                parts.push({ name: part, operator: '->>', __type: 'json' });
            }
        }

        return parts.length === 1 && typeof parts[0] === 'string'
            ? parts[0]
            : parts;
    }


    public parseFieldString(field: string): Condition['field'] {
        // Parse regular field paths with JSON operators
        if (field.includes('->') || field.includes('->>') || field.includes('.')) {
            const parts: (string | JsonFieldType)[] = [];
            let current = '';
            let i = 0;

            while (i < field.length) {
                if (field.substring(i, i + 3) === '->>') {
                    if (current) {
                        parts.push({ name: current, operator: '->>', __type: 'json' });
                        current = '';
                    }
                    i += 3;
                } else if (field.substring(i, i + 2) === '->') {
                    if (current) {
                        parts.push({ name: current, operator: '->', __type: 'json' });
                        current = '';
                    }
                    i += 2;
                } else if (field[i] === '.') {
                    if (parts.some(p => typeof p === 'object' && p.__type === 'json')) {
                        this.throwError(
                            'Invalid field name - dot (.) cannot be used after JSON operators (-> or ->>)',
                            this.peek(),
                        );
                    }
                    if (current) {
                        parts.push(current);
                        current = '';
                    }
                    i++;
                } else {
                    current += field[i];
                    i++;
                }
            }

            if (current) {
                parts.push(current);
            }

            return parts;
        }

        return field;
    }

    protected fieldToString(field: string | (string | JsonFieldType)[]): string {
        if (typeof field === 'string') {
            return field;
        }

        let result = '';
        for (let i = 0; i < field.length; i++) {
            const part = field[i];
            if (typeof part === 'string') {
                result += part;
                if (i < field.length - 1 && typeof field[i + 1] === 'string') {
                    result += '.'; // Add a dot if the next part is also a string
                }
            } else {
                result += `${part.operator}${part.name}`;
            }
        }
        return result;
    }

}

export const allowedOperators = [
    // Comparison operators
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',

    // String operators
    'like',
    'ilike',
    'match',
    'imatch',
    'startswith',
    'endswith',
    'contains',
    'icontains',
    'istartswith',
    'iendswith',

    // Array/List operators
    'in',
    'notin',
    'overlap',
    'contains',
    'containedby',

    // Range operators
    'between',
    'notbetween',

    // Null operators
    'is',
    'isnot',
    'null',
    'notnull',

    // JSON operators
    'cs',
    'cd',
    'sl',
    'sr',
    'nxr',
    'nxl',

    // Logical operators
    'and',
    'or',
    'not',

    // misc operators
    'all',
    'any',
    'exists',
    'notexists',
] as const;

export const specialOperators = [
    'limit',
    'group',
    'order',
    'offset',
    'join',
    'shape',
] as const;
