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
    JSON_EXTRACT = 'JSON_EXTRACT',     // ->
    JSON_EXTRACT_TEXT = 'JSON_EXTRACT_TEXT', // ->>

    // Cast Operator
    CAST = 'CAST',                     // ::

    // Grouping
    LPAREN = 'LPAREN',                 // (
    RPAREN = 'RPAREN',                 // )
    LBRACE = 'LBRACE',                 // {
    RBRACE = 'RBRACE',                 // }
    LBRACKET = 'LBRACKET',             // [
    RBRACKET = 'RBRACKET',             // ]

    // Separators
    COMMA = 'COMMA',                   // ,
    PIPE = 'PIPE',                     // |

    // Logical
    NOT = 'NOT',                       // !

    // Special
    COLUMN_REF = 'COLUMN_REF',         // "quoted"
    RAW_VALUE = 'RAW_VALUE',           // `backticks`
    SPECIAL_FIELD = 'SPECIAL_FIELD',   // $ or this

    // End of input
    EOF = 'EOF',

    // Invalid token
    INVALID = 'INVALID'
}

export interface Token {
    type: TokenType;
    value: string;
    position: ParsePosition;
    length: number;
}

export class Tokenizer {
    private input: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;

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
                throw new Error(`Invalid token at ${this.line}:${this.column}: "${token.value}"`);
            }
        }

        tokens.push({
            type: TokenType.EOF,
            value: '',
            position: this.getCurrentPosition(),
            length: 0
        });

        return tokens;
    }

    private nextToken(): Token {
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
            case '{':
                this.advance();
                return this.createToken(TokenType.LBRACE, '{', start);
            case '}':
                this.advance();
                return this.createToken(TokenType.RBRACE, '}', start);
            case '[':
                this.advance();
                return this.createToken(TokenType.LBRACKET, '[', start);
            case ']':
                this.advance();
                return this.createToken(TokenType.RBRACKET, ']', start);
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
                if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek(1)))) {
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

    private readQuotedString(quote: string, tokenType: TokenType, start: ParsePosition): Token {
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

    private readNumber(start: ParsePosition): Token {
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

            while (this.position < this.input.length && this.isDigit(this.current())) {
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

            while (this.position < this.input.length && this.isDigit(this.current())) {
                value += this.current();
                this.advance();
            }
        }

        return this.createToken(TokenType.NUMBER, value, start);
    }

    private readIdentifier(start: ParsePosition): Token {
        let value = '';

        while (this.position < this.input.length &&
            (this.isAlphaNumeric(this.current()) || this.current() === '_')) {
            value += this.current();
            this.advance();
        }

        // Check for keywords
        const tokenType = this.getKeywordType(value);

        // Special case for 'this'
        if (value === 'this') {
            return this.createToken(TokenType.SPECIAL_FIELD, value, start);
        }

        return this.createToken(tokenType, value, start);
    }

    private getKeywordType(value: string): TokenType {
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

    private skipWhitespace(): void {
        while (this.position < this.input.length && this.isWhitespace(this.current())) {
            if (this.current() === '\n') {
                this.line++;
                this.column = 1;
            } else {
                this.column++;
            }
            this.position++;
        }
    }

    private current(): string {
        return this.position < this.input.length ? this.input[this.position] : '';
    }

    private peek(offset: number = 1): string {
        const pos = this.position + offset - 1;
        return pos < this.input.length ? this.input.slice(this.position, this.position + offset) : '';
    }

    private advance(count: number = 1): void {
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

    private getCurrentPosition(): ParsePosition {
        return {
            line: this.line,
            column: this.column,
            offset: this.position
        };
    }

    private createToken(type: TokenType, value: string, start: ParsePosition): Token {
        return {
            type,
            value,
            position: start,
            length: this.position - start.offset
        };
    }

    private isWhitespace(char: string): boolean {
        return char === ' ' || char === '\t' || char === '\n' || char === '\r';
    }

    private isDigit(char: string): boolean {
        return char >= '0' && char <= '9';
    }

    private isAlpha(char: string): boolean {
        return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
    }

    private isAlphaNumeric(char: string): boolean {
        return this.isAlpha(char) || this.isDigit(char);
    }
}
