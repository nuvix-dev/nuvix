import { Logger } from '@nestjs/common';
import { Exception } from '@nuvix/core/extend/exception';
import type {
    Condition,
    Expression,
    JsonFieldType,
    ParserConfig,
    ParserResult,
} from './types';
import { OrderParser } from './order';
import { ParserError } from './error';
import { Tokenizer, Token, TokenType } from './tokenizer';

export class NewParser<T extends ParserResult = ParserResult> {
    private readonly logger = new Logger(NewParser.name);

    private config: ParserConfig;
    private tableName: string;
    private mainTable: string;
    private extraData: Record<string, any> = {};
    private tokens: Token[] = [];
    private current: number = 0;

    constructor(config: ParserConfig, tableName: string, mainTable?: string) {
        this.config = config;
        this.tableName = tableName;
        this.mainTable = mainTable ?? tableName;
        this._validateConfig();
    }

    static create<T>({
        tableName,
        mainTable,
    }: {
        tableName: string;
        mainTable?: string;
    }) {
        return new NewParser<T>(defaultConfig, tableName, mainTable);
    }

    parse(str: string): T & Expression {
        if (typeof str !== 'string') {
            throw new ParserError(
                'Parser input must be a string',
                { line: 1, column: 1, offset: 0 },
                String(str),
                { expected: 'string', received: typeof str },
            );
        }

        try {
            // Tokenize the input
            const tokenizer = new Tokenizer(str.trim());
            this.tokens = tokenizer.tokenize();
            this.current = 0;

            // Debug: Log tokens for development
            this.logger.debug('Tokenized input:', this.tokens);

            // Parse the expression
            const result = {
                ...this.parseExpression(),
                ...(this.extraData as T),
            };

            return result;
        } catch (error) {
            if (error instanceof ParserError) {
                throw error;
            } else if (error instanceof Error) {
                throw new Exception(
                    Exception.GENERAL_PARSER_ERROR,
                    `Parse error: ${error.message}`,
                );
            }
            throw new Exception(
                Exception.GENERAL_PARSER_ERROR,
                'Unknown parsing error occurred',
            );
        }
    }

    private parseExpression(): Expression {
        return this.parseOrExpression();
    }

    private parseOrExpression(): Expression {
        let left = this.parseAndExpression();

        while (this.match(TokenType.PIPE)) {
            const expressions = [left];
            expressions.push(this.parseAndExpression());

            // Continue collecting OR expressions
            while (this.match(TokenType.PIPE)) {
                expressions.push(this.parseAndExpression());
            }

            left = { or: expressions.filter(Boolean) as Expression[] };
        }

        return left;
    }

    private parseAndExpression(): Expression {
        let left = this.parseNotExpression();

        while (this.match(TokenType.COMMA)) {
            const expressions = [left];
            expressions.push(this.parseNotExpression());

            // Continue collecting AND expressions
            while (this.match(TokenType.COMMA)) {
                expressions.push(this.parseNotExpression());
            }

            left = { and: expressions.filter(Boolean) as Expression[] };
        }

        return left;
    }

    private parseNotExpression(): Expression {
        if (this.match(TokenType.NOT)) {
            const expr = this.parseNotExpression();
            return { not: expr };
        }

        return this.parsePrimaryExpression();
    }

    private parsePrimaryExpression(): Expression {
        // Handle function calls: or(...), and(...), not(...)
        if (this.check(TokenType.IDENTIFIER)) {
            const identifier = this.peek().value;

            if (identifier === 'or' && this.peekNext()?.type === TokenType.LPAREN) {
                this.advance(); // consume 'or'
                this.consume(TokenType.LPAREN, "Expected '(' after 'or'");
                const expressions = this.parseCommaSeparatedExpressions();
                this.consume(TokenType.RPAREN, "Expected ')' after or arguments");
                return { or: expressions };
            }

            if (identifier === 'and' && this.peekNext()?.type === TokenType.LPAREN) {
                this.advance(); // consume 'and'
                this.consume(TokenType.LPAREN, "Expected '(' after 'and'");
                const expressions = this.parseCommaSeparatedExpressions();
                this.consume(TokenType.RPAREN, "Expected ')' after and arguments");
                return { and: expressions };
            }

            if (identifier === 'not' && this.peekNext()?.type === TokenType.LPAREN) {
                this.advance(); // consume 'not'
                this.consume(TokenType.LPAREN, "Expected '(' after 'not'");
                const expr = this.parseExpression();
                this.consume(TokenType.RPAREN, "Expected ')' after not argument");
                return { not: expr };
            }
        }

        // Handle grouped expressions
        if (this.match(TokenType.LPAREN)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RPAREN, "Expected ')' after grouped expression");
            return expr;
        }

        // Handle cast expressions: {field}::type.operator(value)
        if (this.match(TokenType.LBRACE)) {
            return this.parseCastExpression();
        }

        // Handle regular conditions
        return this.parseCondition();
    }

    private parseCastExpression(): Expression {
        // Parse field inside braces
        const field = this.parseFieldPath();
        this.consume(TokenType.RBRACE, "Expected '}' after cast field");
        this.consume(TokenType.CAST, "Expected '::' after cast expression");

        // Parse type.operator
        const typeName = this.consume(TokenType.IDENTIFIER, "Expected type name after '::'").value;
        this.consume(TokenType.DOT, "Expected '.' after type name");
        const operator = this.consume(TokenType.OPERATOR, "Expected operator after type").value;

        // Parse arguments
        let args: any[] = [];
        if (this.match(TokenType.LPAREN)) {
            args = this.parseArgumentList();
            this.consume(TokenType.RPAREN, "Expected ')' after cast arguments");
        } else if (this.match(TokenType.LBRACKET)) {
            args = this.parseArgumentList();
            this.consume(TokenType.RBRACKET, "Expected ']' after cast arguments");
        }

        // Create condition with cast
        const castField = `{${this.fieldToString(field)}}::${typeName}`;
        return this.buildCondition(castField, operator, args);
    }

    private parseCondition(): Condition {
        // Handle special fields: $ or this
        if (this.check(TokenType.SPECIAL_FIELD)) {
            const specialField = this.advance().value;
            this.consume(TokenType.DOT, "Expected '.' after special field");
            const operator = this.consume(TokenType.OPERATOR, "Expected operator").value;

            let args: any[] = [];
            if (this.match(TokenType.LPAREN)) {
                args = this.parseArgumentList();
                this.consume(TokenType.RPAREN, "Expected ')' after arguments");
            }

            this.handleSpecialCase(specialField, operator, args);
            return null as any; // Special cases don't return conditions
        }

        // Parse field path
        const field = this.parseFieldPath();
        this.consume(TokenType.DOT, "Expected '.' after field");
        const operator = this.consume(TokenType.OPERATOR, "Expected operator").value;

        // Parse arguments
        let args: any[] = [];
        if (this.match(TokenType.LPAREN)) {
            args = this.parseArgumentList();
            this.consume(TokenType.RPAREN, "Expected ')' after arguments");
        } else if (this.match(TokenType.LBRACKET)) {
            args = this.parseArgumentList();
            this.consume(TokenType.RBRACKET, "Expected ']' after arguments");
        }

        return this.buildCondition(this.fieldToString(field), operator, args);
    }

    private parseFieldPath(): string | (string | JsonFieldType)[] {
        const parts: (string | JsonFieldType)[] = [];

        // First part must be an identifier
        const firstPart = this.consume(TokenType.IDENTIFIER, "Expected field name").value;
        parts.push(firstPart);

        while (this.check(TokenType.DOT) || this.check(TokenType.JSON_EXTRACT) || this.check(TokenType.JSON_EXTRACT_TEXT)) {
            if (this.match(TokenType.DOT)) {
                // Check if the next token is an operator (end of field path) or identifier (continue field path)
                if (this.check(TokenType.OPERATOR)) {
                    // This dot is followed by an operator, so we're done with the field path
                    // Put the dot back by moving current position back
                    this.current--;
                    break;
                }
                // Regular dot notation - continue building field path
                const part = this.consume(TokenType.IDENTIFIER, "Expected field name after '.'").value;
                parts.push(part);
            } else if (this.match(TokenType.JSON_EXTRACT)) {
                // -> operator
                const part = this.consume(TokenType.IDENTIFIER, "Expected field name after '->'").value;
                parts.push({ name: part, operator: '->', __type: 'json' });
            } else if (this.match(TokenType.JSON_EXTRACT_TEXT)) {
                // ->> operator
                const part = this.consume(TokenType.IDENTIFIER, "Expected field name after '->>'").value;
                parts.push({ name: part, operator: '->>', __type: 'json' });
            }
        }

        return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
    }

    private parseArgumentList(): any[] {
        const args: any[] = [];

        if (this.check(TokenType.RPAREN) || this.check(TokenType.RBRACKET)) {
            return args;
        }

        do {
            args.push(this.parseValue());
        } while (this.match(TokenType.COMMA));

        return args;
    }

    private parseCommaSeparatedExpressions(): Expression[] {
        const expressions: Expression[] = [];

        if (this.check(TokenType.RPAREN)) {
            return expressions;
        }

        do {
            const expr = this.parseExpression();
            if (expr) expressions.push(expr);
        } while (this.match(TokenType.COMMA));

        return expressions;
    }

    private parseValue(): any {
        const token = this.peek();

        switch (token.type) {
            case TokenType.STRING:
                this.advance();
                return token.value;

            case TokenType.NUMBER:
                this.advance();
                const num = Number(token.value);
                return isNaN(num) ? token.value : num;

            case TokenType.BOOLEAN:
                this.advance();
                return token.value === 'true';

            case TokenType.NULL:
                this.advance();
                return null;

            case TokenType.UNDEFINED:
                this.advance();
                return undefined;

            case TokenType.COLUMN_REF:
                this.advance();
                const columnName = token.value;
                return {
                    __type: 'column',
                    name: columnName.includes('.') ? columnName : `${this.mainTable}.${columnName}`,
                };

            case TokenType.RAW_VALUE:
                this.advance();
                return { __type: 'raw', value: token.value };

            case TokenType.IDENTIFIER:
                this.advance();
                // Check for date-like patterns or cast expressions
                if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(token.value)) {
                    return token.value;
                }
                if (token.value.includes('::')) {
                    return { __type: 'raw', value: token.value };
                }
                return token.value;

            default:
                this.throwError(`Unexpected token in value position: ${token.value}`, token);
        }
    }

    private buildCondition(field: string, operator: string, args: any[]): Condition {
        const parsedField = typeof field === 'string' ? this.parseFieldString(field) : field;

        if (args.length === 0) {
            return { field: parsedField, operator, value: null, tableName: this.tableName };
        } else if (args.length === 1) {
            return { field: parsedField, operator, value: args[0], tableName: this.tableName };
        } else {
            return { field: parsedField, operator, values: args, tableName: this.tableName };
        }
    }

    public parseFieldString(field: string): Condition['field'] {
        // Handle cast expressions
        if (field.startsWith('{') && field.includes('}::')) {
            return field; // Return as-is for cast expressions
        }

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
                            this.peek()
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

    private fieldToString(field: string | (string | JsonFieldType)[]): string {
        if (typeof field === 'string') {
            return field;
        }

        return field.map(part => {
            if (typeof part === 'string') {
                return part;
            } else {
                return `${part.operator}${part.name}`;
            }
        }).join('');
    }

    private handleSpecialCase(field: string, operator: string, args: any[]): void {
        switch (operator) {
            case 'limit':
                this.extraData['limit'] = this.integerOrThrow(args[0], operator);
                break;
            case 'offset':
                this.extraData['offset'] = this.integerOrThrow(args[0], operator);
                break;
            case 'join':
                const joinType = String(args[0]).toLowerCase();
                if (['inner', 'left', 'right', 'full'].includes(joinType)) {
                    this.extraData['joinType'] = joinType;
                } else {
                    this.throwError(`Unsupported join type: ${args[0]}`, this.peek());
                }
                break;
            case 'shape':
                const shape = String(args[0]).toLowerCase();
                if (['object', 'array', '{}', '[]', 'true'].includes(shape)) {
                    this.extraData['shape'] =
                        shape === 'object' || shape === '{}' || shape === 'true' ? 'object' : 'array';
                } else {
                    this.throwError(`Unsupported shape value: ${args[0]}`, this.peek());
                }
                break;
            case 'group':
                if (args.length > 0) {
                    this.extraData['group'] = args.map(arg => this.parseFieldString(String(arg)));
                }
                break;
            case 'order':
                if (args.length > 0) {
                    const orders = OrderParser.parse(String(args[0]));
                    if (orders && orders.length > 0) {
                        this.extraData['order'] = orders;
                    }
                }
                break;
            default:
                this.throwError(`Unsupported special function: ${operator}`, this.peek());
        }
    }

    private integerOrThrow(value: any, field: string): number {
        const num = Number(value);
        if (typeof num !== 'number' || isNaN(num) || !Number.isInteger(num)) {
            this.throwError(`${field} value should be an integer: ${value}`, this.peek());
        }
        return num;
    }

    // Token navigation methods
    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    private isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }

    private peek(): Token {
        return this.tokens[this.current];
    }

    private peekNext(): Token | undefined {
        if (this.current + 1 >= this.tokens.length) return undefined;
        return this.tokens[this.current + 1];
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        this.throwError(message, this.peek());
    }

    private throwError(message: string, token: Token): never {
        throw new ParserError(
            message,
            token.position,
            token.value,
            {
                expected: 'valid syntax',
                received: token.value,
            }
        );
    }

    private _validateConfig(): void {
        if (!this.config?.groups) {
            throw new ParserError(
                'Config must include groups configuration',
                { line: 1, column: 1, offset: 0 },
                'config validation',
                {
                    expected: 'valid ParserConfig with groups',
                    received: 'invalid config',
                },
            );
        }

        const { OPEN, CLOSE, SEP, OR, NOT } = this.config.groups;
        if (!OPEN || !CLOSE || !SEP || !OR || !NOT) {
            throw new ParserError(
                'All group characters (OPEN, CLOSE, SEP, OR, NOT) must be defined',
                { line: 1, column: 1, offset: 0 },
                JSON.stringify(this.config.groups),
                {
                    expected: 'all group characters defined',
                    received: `OPEN: ${OPEN}, CLOSE: ${CLOSE}, SEP: ${SEP}, OR: ${OR}, NOT: ${NOT}`,
                },
            );
        }
    }
}

const defaultConfig: ParserConfig = {
    groups: {
        OPEN: '(',
        CLOSE: ')',
        SEP: ',',
        OR: '|',
        NOT: '!',
    },
    values: {
        FUNCTION_STYLE: true,
        LIST_STYLE: '[]',
    },
    cast: {
        OPEN: '{',
        CLOSE: '}',
    },
};
