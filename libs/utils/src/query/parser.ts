import { Logger } from '@nestjs/common';
import { Exception } from '@nuvix/core/extend/exception';
import type {
  Condition,
  Expression,
  JsonFieldType,
  ParserConfig,
  ParserResult,
  ParsePosition,
  ParseError,
} from './types';
import { OrderParser } from './order';

export class ParserError extends Error implements ParseError {
  public position: ParsePosition;
  public statement: string;
  public expected?: string;
  public received?: string;
  public context?: string;

  constructor(
    message: string,
    position: ParsePosition,
    statement: string,
    options: {
      expected?: string;
      received?: string;
      context?: string;
    } = {},
  ) {
    const fullMessage = ParserError.formatErrorMessage(
      message,
      position,
      statement,
      options,
    );
    super(fullMessage);
    this.name = 'ParserError';
    this.position = position;
    this.statement = statement;
    this.expected = options.expected;
    this.received = options.received;
    this.context = options.context;
  }

  private static formatErrorMessage(
    message: string,
    position: ParsePosition,
    statement: string,
    options: { expected?: string; received?: string; context?: string },
  ): string {
    let formatted = `${message} at line ${position.line}, column ${position.column}\n`;
    formatted += `Statement: "${statement}"\n`;

    if (options.expected) {
      formatted += `Expected: ${options.expected}\n`;
    }

    if (options.received) {
      formatted += `Received: ${options.received}\n`;
    }

    if (options.context) {
      formatted += `Context: ${options.context}\n`;
    }

    // Add visual indicator of error position
    const indicator = ' '.repeat(Math.max(0, position.column - 1)) + '^';
    formatted += `${statement}\n${indicator}`;

    return formatted;
  }
}

// Parser context to track position and state
interface ParserContext {
  originalInput: string;
  currentInput: string;
  position: ParsePosition;
  callStack: string[];
}

export class Parser<T extends ParserResult = ParserResult> {
  private readonly logger = new Logger(Parser.name);

  private config: ParserConfig;
  private escapeChar: string;
  private tableName: string;
  private mainTable: string;
  private extraData: Record<string, any> = {};
  private context: ParserContext;

  constructor(config: ParserConfig, tableName: string, mainTable?: string) {
    this.config = config;
    this.tableName = tableName;
    this.mainTable = mainTable ?? tableName;
    this.escapeChar = '\\';
    this._validateConfig();
    this.context = {
      originalInput: '',
      currentInput: '',
      position: { line: 1, column: 1, offset: 0 },
      callStack: [],
    };
  }

  static create<T>({
    tableName,
    mainTable,
  }: {
    tableName: string;
    mainTable?: string;
  }) {
    return new Parser<T>(defaultConfig, tableName, mainTable);
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

    // Initialize parser context
    this.context = {
      originalInput: str,
      currentInput: str.trim(),
      position: { line: 1, column: 1, offset: 0 },
      callStack: [],
    };

    try {
      const result = {
        ...this._parseExpression(this.context.currentInput),
        ...(this.extraData as T),
      };

      return result;
    } catch (error) {
      if (error instanceof ParserError) {
        // throw new Exception(
        //   Exception.GENERAL_PARSER_ERROR,
        //   error.message,
        // );
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

  private _updatePosition(
    input: string,
    startOffset: number = 0,
  ): ParsePosition {
    let line = 1;
    let column = 1;

    for (let i = 0; i < startOffset && i < input.length; i++) {
      if (input[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }

    return { line, column, offset: startOffset };
  }

  private _getStatementContext(
    input: string,
    position: number,
    contextSize: number = 20,
  ): string {
    const start = Math.max(0, position - contextSize);
    const end = Math.min(input.length, position + contextSize);
    let context = input.slice(start, end);

    if (start > 0) context = '...' + context;
    if (end < input.length) context = context + '...';

    return context;
  }

  private _throwParseError(
    message: string,
    input: string,
    position: number = 0,
    options: {
      expected?: string;
      received?: string;
      context?: string;
      operation?: string;
    } = {},
  ): never {
    const pos = this._updatePosition(
      this.context.originalInput,
      this.context.originalInput.indexOf(input) + position,
    );

    const statement = this._getStatementContext(input, position);
    const contextInfo =
      options.context ||
      (options.operation ? `While parsing ${options.operation}` : undefined);

    throw new ParserError(message, pos, statement, {
      expected: options.expected,
      received: options.received,
      context: contextInfo,
    });
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
          context: 'Configuration validation',
        },
      );
    }

    // Validate matching brackets
    const bracketPairs = [
      ['{', '}'],
      ['(', ')'],
      ['[', ']'],
    ];
    const validPair = bracketPairs.find(
      ([open, close]) => open === OPEN && close === CLOSE,
    );

    if (!validPair) {
      this.logger.warn(
        `Warning: OPEN '${OPEN}' and CLOSE '${CLOSE}' are not standard bracket pairs`,
      );
    }
  }

  private _parseExpression(str: string): Expression {
    if (!str || str.length === 0) return null;

    // Add to call stack for better error context
    this.context.callStack.push(
      `_parseExpression("${str.substring(0, 30)}${str.length > 30 ? '...' : ''}")`,
    );

    try {
      // if (!this._isBalanced(str)) {
      //   this._throwParseError(
      //     'Unbalanced brackets in expression',
      //     str,
      //     0,
      //     {
      //       expected: 'balanced brackets',
      //       received: 'unbalanced brackets',
      //       operation: 'expression parsing'
      //     }
      //   );
      // }

      // Handle NOT expressions
      if (str.startsWith(this.config.groups.NOT)) {
        const remaining = str.slice(1).trim();
        if (!remaining) {
          this._throwParseError(
            'NOT operator requires an expression to negate',
            str,
            1,
            {
              expected: 'expression after NOT operator',
              received: 'empty expression',
              operation: 'NOT expression parsing',
            },
          );
        }

        // If the remaining starts with parentheses, remove them first
        let innerExpression = remaining;
        if (remaining.startsWith('(') && remaining.endsWith(')')) {
          innerExpression = remaining.slice(1, -1).trim();
        }

        const result = { not: this._parseExpression(innerExpression) };
        this.context.callStack.pop();
        return result;
      }

      // Handle groups
      if (this._isProperGroup(str)) {
        const content = str.slice(1, -1).trim();
        if (!content) {
          this._throwParseError(
            'Empty group expression is not allowed',
            str,
            1,
            {
              expected: 'non-empty group content',
              received: 'empty group',
              operation: 'group parsing',
            },
          );
        }
        const result = this._parseGroup(content);
        this.context.callStack.pop();
        return result;
      }

      // Handle OR separator at top level
      if (this._containsTopLevelOperator(str, this.config.groups.OR)) {
        const parts = this._splitByOperator(str, this.config.groups.OR);
        if (parts.length < 2) {
          this._throwParseError(
            'OR expression requires at least two operands',
            str,
            str.indexOf(this.config.groups.OR),
            {
              expected: 'at least two operands',
              received: `${parts.length} operand(s)`,
              operation: 'OR expression parsing',
            },
          );
        }
        const expressions = parts
          .map(p => this._parseExpression(p.trim()))
          .filter(Boolean) as Expression[];
        if (expressions.length === 0) {
          this._throwParseError(
            'OR expression contains no valid operands',
            str,
            0,
            {
              expected: 'valid operands',
              received: 'no valid operands',
              operation: 'OR expression parsing',
            },
          );
        }
        const result = { or: expressions };
        this.context.callStack.pop();
        return result;
      }

      // Handle explicit OR function
      if (str.startsWith('or(') && str.endsWith(')')) {
        const content = str.slice(3, -1).trim();
        if (!content) {
          this._throwParseError(
            'OR function requires at least one argument',
            str,
            3,
            {
              expected: 'at least one argument',
              received: 'empty arguments',
              operation: 'OR function parsing',
            },
          );
        }
        const result = { or: this._parseCommaList(content) };
        this.context.callStack.pop();
        return result;
      }

      // Handle explicit AND function
      if (str.startsWith('and(') && str.endsWith(')')) {
        const content = str.slice(4, -1).trim();
        if (!content) {
          this._throwParseError(
            'AND function requires at least one argument',
            str,
            4,
            {
              expected: 'at least one argument',
              received: 'empty arguments',
              operation: 'AND function parsing',
            },
          );
        }
        const result = { and: this._parseCommaList(content) };
        this.context.callStack.pop();
        return result;
      }

      // Handle explicit NOT function
      if (str.startsWith('not(') && str.endsWith(')')) {
        const content = str.slice(4, -1).trim();
        if (!content) {
          this._throwParseError(
            'NOT function requires an expression to negate',
            str,
            4,
            {
              expected: 'expression to negate',
              received: 'empty expression',
              operation: 'NOT function parsing',
            },
          );
        }
        const result = { not: this._parseExpression(content) };
        this.context.callStack.pop();
        return result;
      }

      // Handle comma-separated AND conditions
      if (this._containsTopLevelOperator(str, this.config.groups.SEP)) {
        const parts = this._splitByOperator(str, this.config.groups.SEP);

        if (parts.length < 2) {
          this._throwParseError(
            'AND expression requires at least two operands',
            str,
            str.indexOf(this.config.groups.SEP),
            {
              expected: 'at least two operands',
              received: `${parts.length} operand(s)`,
              operation: 'AND expression parsing',
            },
          );
        }
        const expressions = parts
          .map(p => this._parseExpression(p.trim()))
          .filter(Boolean) as Expression[];
        if (expressions.length === 0) {
          this._throwParseError(
            'AND expression contains no valid operands',
            str,
            0,
            {
              expected: 'valid operands',
              received: 'no valid operands',
              operation: 'AND expression parsing',
            },
          );
        }
        const result = { and: expressions };
        this.context.callStack.pop();
        return result;
      }

      // Handle individual condition
      const result = this._parseCondition(str);
      this.context.callStack.pop();
      return result;
    } catch (error) {
      this.context.callStack.pop();
      throw error;
    }
  }

  private _parseGroup(str: string): Expression {
    if (!str) {
      this._throwParseError('Group cannot be empty', str, 0, {
        expected: 'non-empty group content',
        received: 'empty string',
        operation: 'group parsing',
      });
    }

    this.context.callStack.push(
      `_parseGroup("${str.substring(0, 30)}${str.length > 30 ? '...' : ''}")`,
    );

    try {
      // Check for OR separator first
      if (this._containsTopLevelOperator(str, this.config.groups.OR)) {
        const parts = this._splitByOperator(str, this.config.groups.OR);
        const expressions = parts
          .map(p => this._parseExpression(p.trim()))
          .filter(Boolean) as Expression[];
        const result = { or: expressions };
        this.context.callStack.pop();
        return result;
      }

      // Check for explicit OR function
      if (str.startsWith('or(') && str.endsWith(')')) {
        const content = str.slice(3, -1).trim();
        const result = { or: this._parseCommaList(content) };
        this.context.callStack.pop();
        return result;
      }

      // Default to AND for comma-separated
      if (this._containsTopLevelOperator(str, this.config.groups.SEP)) {
        const parts = this._splitByOperator(str, this.config.groups.SEP);
        const expressions = parts
          .map(p => this._parseExpression(p.trim()))
          .filter(Boolean) as Expression[];
        const result = { and: expressions };
        this.context.callStack.pop();
        return result;
      }

      // Single condition group
      const result = this._parseExpression(str);
      this.context.callStack.pop();
      return result;
    } catch (error) {
      this.context.callStack.pop();
      throw error;
    }
  }

  private _parseCondition(str: string): Condition {
    if (!str || str.trim().length === 0) {
      this._throwParseError('Condition cannot be empty', str, 0, {
        expected: 'non-empty condition',
        received: 'empty string',
        operation: 'condition parsing',
      });
    }

    const trimmed = str.trim();
    this.context.callStack.push(
      `_parseCondition("${trimmed.substring(0, 30)}${trimmed.length > 30 ? '...' : ''}")`,
    );

    try {
      // Handle function-style: field.op(value) - supports complex field paths with JSON operators
      if (this.config.values.FUNCTION_STYLE) {
        // Find the last occurrence of .operator( pattern to handle complex field paths with parentheses
        // Look for the pattern: anything.operator(args) where operator doesn't contain dots or parentheses
        const match = trimmed.match(
          /^(.+)\.([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)$/,
        );
        if (match) {
          const [_, fieldPath, operator, args] = match;
          const _fieldPath = fieldPath.trim();

          if (_fieldPath === '$' || _fieldPath === 'this') {
            this._buidSpecialCase(_fieldPath, operator.trim(), args);
            this.context.callStack.pop();
            return undefined as any;
          }

          const result = this._buildCondition(
            fieldPath.trim(),
            operator.trim(),
            args,
          );
          this.context.callStack.pop();
          return result;
        }
      }

      // Handle list-style: field.op[value1,value2] - supports complex field paths
      if (this.config.values.LIST_STYLE) {
        const openChar = this.config.values.LIST_STYLE[0];
        const closeChar = this.config.values.LIST_STYLE[1];

        if (!openChar || !closeChar) {
          this._throwParseError(
            'Invalid LIST_STYLE configuration',
            trimmed,
            0,
            {
              expected: 'valid LIST_STYLE with open and close characters',
              received: `openChar: ${openChar}, closeChar: ${closeChar}`,
              operation: 'list-style parsing',
            },
          );
        }

        const openIndex = trimmed.lastIndexOf(openChar);
        const closeIndex = trimmed.lastIndexOf(closeChar);

        if (
          openIndex > 0 &&
          closeIndex > openIndex &&
          closeIndex === trimmed.length - 1
        ) {
          const fieldOpPath = trimmed.substring(0, openIndex);
          const args = trimmed.substring(openIndex + 1, closeIndex);

          // Extract the last dot-separated part as operator
          const lastDotIndex = fieldOpPath.lastIndexOf('.');
          if (lastDotIndex === -1) {
            this._throwParseError(
              'Invalid field.operator format',
              fieldOpPath,
              0,
              {
                expected: 'field.operator format',
                received: fieldOpPath,
                operation: 'field.operator parsing',
              },
            );
          }
          const fieldPath = fieldOpPath.substring(0, lastDotIndex);
          const operator = fieldOpPath.substring(lastDotIndex + 1);
          const result = this._buildCondition(
            fieldPath.trim(),
            operator.trim(),
            args,
          );
          this.context.callStack.pop();
          return result;
        }
      }

      this._throwParseError(
        'Unable to parse condition - check your syntax',
        trimmed,
        0,
        {
          expected:
            'valid condition syntax (field.operator(value) or field.operator[values])',
          received: trimmed,
          operation: 'condition parsing',
          context: `Available call stack: ${this.context.callStack.join(' → ')}`,
        },
      );
    } catch (error) {
      this.context.callStack.pop();
      throw error;
    }
  }

  private _buildCondition(
    _field: string | undefined,
    operator: string | undefined,
    args: string,
  ): Condition {
    if (!_field || !operator) {
      this._throwParseError(
        'Both field and operator must be specified',
        `${_field}.${operator}`,
        0,
        {
          expected: 'field.operator format',
          received: `field: "${_field}", operator: "${operator}"`,
          operation: 'condition building',
        },
      );
    }

    this.context.callStack.push(
      `_buildCondition("${_field}", "${operator}", "${args.substring(0, 20)}${args.length > 20 ? '...' : ''}")`,
    );

    try {
      const field = this._parseField(_field);
      const tableName = this.tableName;

      if (!args && args !== '') {
        const result = { field, operator, value: null, tableName };
        this.context.callStack.pop();
        return result;
      }

      const values = this._parseArgumentList(args);

      if (values.length === 0) {
        const result = { field, operator, value: null, tableName };
        this.context.callStack.pop();
        return result;
      }

      const result =
        values.length === 1
          ? { field, operator, value: values[0], tableName }
          : { field, operator, values, tableName };

      this.context.callStack.pop();
      return result;
    } catch (error) {
      this.context.callStack.pop();
      throw error;
    }
  }

  private _buidSpecialCase(
    _field: string | undefined,
    operator: string | undefined,
    args: string,
  ): void {
    if (!operator) {
      throw new Exception(
        Exception.GENERAL_PARSER_ERROR,
        `Operator must be specified for special case function: "${_field}.${operator}"`,
      );
    }

    this.context.callStack.push(
      `_buidSpecialCase("${_field}", "${operator}", "${args.substring(0, 20)}${args.length > 20 ? '...' : ''}")`,
    );

    try {
      switch (operator) {
        case 'limit':
          this.extraData['limit'] = this.integerOrThrow(args, operator);
          break;
        case 'offset':
          this.extraData['offset'] = this.integerOrThrow(args, operator);
          break;
        case 'join':
          const parsedJoinType = args.toLowerCase();
          if (['inner', 'left', 'right', 'full'].includes(parsedJoinType)) {
            this.extraData['joinType'] = parsedJoinType;
          } else {
            this._throwParseError('Unsupported join type', args, 0, {
              expected: 'one of: inner, left, right, full',
              received: args,
              operation: 'join type parsing',
            });
          }
          break;
        case 'shape':
          const parsedShape = args.toLowerCase();
          if (['object', 'array', '{}', '[]', 'true'].includes(parsedShape)) {
            // 'true' and '{}' map to 'object', '[]' maps to 'array'
            this.extraData['shape'] =
              parsedShape === 'object' ||
              parsedShape === '{}' ||
              parsedShape === 'true'
                ? 'object'
                : 'array';
          } else {
            this._throwParseError('Unsupported shape value', args, 0, {
              expected: 'one of: object, array, {}, [], true',
              received: args,
              operation: 'shape parsing',
            });
          }
          break;
        case 'group':
          const columns = this._parseGroupBy(args);
          if (columns && columns.length > 0) {
            this.extraData['group'] = columns;
          }
          break;
        case 'order':
          const orders = OrderParser.parse(args);
          if (orders && orders.length > 0) {
            this.extraData['order'] = orders;
          }
          break;
        default:
          this._throwParseError(
            'Unsupported special function',
            `$.${operator}`,
            0,
            {
              expected: 'one of: limit, offset, join, shape, group, order',
              received: operator,
              operation: 'special function parsing',
            },
          );
      }
      this.context.callStack.pop();
    } catch (error) {
      this.context.callStack.pop();
      throw error;
    }
  }

  private _parseGroupBy(args: string): Condition['field'][] {
    if (!args || args.trim().length === 0) {
      return [];
    }

    const rawFields = args.split(',');
    const processedFields: Condition['field'][] = [];

    for (const field of rawFields) {
      const trimmedField = field.trim();
      if (trimmedField) {
        let unquotedField = trimmedField;
        if (
          (unquotedField.startsWith('"') && unquotedField.endsWith('"')) ||
          (unquotedField.startsWith("'") && unquotedField.endsWith("'"))
        ) {
          unquotedField = unquotedField.slice(1, -1);
        }

        processedFields.push(this._parseField(unquotedField));
      }
    }

    return processedFields;
  }

  private integerOrThrow(value: string, field: string): number {
    const _value = Number(value);
    if (
      typeof _value !== 'number' ||
      isNaN(_value) ||
      !Number.isInteger(_value)
    ) {
      this._throwParseError(`${field} value should be an integer`, value, 0, {
        expected: 'integer value',
        received: value,
        operation: `${field} parsing`,
      });
    }
    return _value;
  }

  public _parseField(field: string): Condition['field'] {
    this.context.callStack.push(`_parseField("${field}")`);

    try {
      if (
        field.includes('->') ||
        field.includes('->>') ||
        field.includes('.')
      ) {
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
              this._throwParseError(
                'Invalid field name - dot (.) cannot be used after JSON operators (-> or ->>)',
                field,
                i,
                {
                  expected: 'field name without dots after JSON operators',
                  received: `dot at position ${i}`,
                  operation: 'field parsing',
                },
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

        this.context.callStack.pop();
        return parts;
      } else {
        this.context.callStack.pop();
        return field;
      }
    } catch (error) {
      this.context.callStack.pop();
      throw error;
    }
  }

  private _parseArgumentList(args: string): any[] {
    if (!args && args !== '') return [];

    this.context.callStack.push(
      `_parseArgumentList("${args.substring(0, 30)}${args.length > 30 ? '...' : ''}")`,
    );

    try {
      const values: any[] = [];
      let current = '';
      let depth = 0;
      let inQuotes = false;
      let quoteChar = '';
      let escaped = false;

      for (let i = 0; i < args.length; i++) {
        const char = args[i];

        if (escaped) {
          current += char;
          escaped = false;
          continue;
        }

        if (char === this.escapeChar) {
          escaped = true;
          continue;
        }

        if ((char === '"' || char === "'" || char === '`') && !inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar && inQuotes) {
          inQuotes = false;
          quoteChar = '';
        }

        if (!inQuotes) {
          if (char === '(' || char === '[' || char === '{') depth++;
          else if (char === ')' || char === ']' || char === '}') depth--;
        }

        if (char === ',' && depth === 0 && !inQuotes) {
          const trimmed = current.trim();
          if (trimmed) {
            try {
              values.push(this._parseValue(trimmed));
            } catch (error) {
              this._throwParseError(
                `Failed to parse argument value`,
                trimmed,
                0,
                {
                  expected: 'valid argument value',
                  received: trimmed,
                  operation: 'argument parsing',
                  context: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              );
            }
          }
          current = '';
        } else {
          current += char;
        }
      }

      const trimmed = current.trim();
      if (trimmed) {
        try {
          values.push(this._parseValue(trimmed));
        } catch (error) {
          this._throwParseError(
            `Failed to parse final argument value`,
            trimmed,
            0,
            {
              expected: 'valid argument value',
              received: trimmed,
              operation: 'argument parsing',
              context: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          );
        }
      }

      this.context.callStack.pop();
      return values;
    } catch (error) {
      this.context.callStack.pop();
      throw error;
    }
  }

  private _parseValue(val: string): any {
    if (!val && val !== '') return '';

    const trimmed = val.trim();

    // Quoted as column name
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      const columnName = trimmed.slice(1, -1);
      return {
        __type: 'column',
        name: columnName.includes('.')
          ? columnName
          : `${this.mainTable}.${columnName}`,
      };
    }

    // Quoted as string literal
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }

    // Quoted as raw literal (may contain reserved chars)
    if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
      return trimmed.slice(1, -1);
    }

    // Unquoted known literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;

    // Date-like values (could be enhanced further)
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(trimmed)) {
      return trimmed;
    }

    // PostgreSQL cast expressions
    if (trimmed.includes('::')) {
      return { __type: 'raw', value: trimmed };
    }

    // Number
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num) && isFinite(num)) return num;
    }

    return trimmed;
  }

  private _splitByOperator(str: string, operator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      // Handle escapes
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === this.escapeChar) {
        escaped = true;
        current += char;
        continue;
      }

      // Handle quotes
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      }

      // Handle all types of nested structures
      if (!inQuotes) {
        // Handle configured group brackets (usually ())
        if (char === this.config.groups.OPEN) depth++;
        if (char === this.config.groups.CLOSE) depth--;

        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth--;

        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
      }

      // Split at operator when not in any nested structure
      if (
        char === operator &&
        depth === 0 &&
        bracketDepth === 0 &&
        parenDepth === 0 &&
        !inQuotes
      ) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts.filter(part => part.length > 0);
  }

  private _parseCommaList(str: string): Expression[] {
    if (!str) return [];

    this.context.callStack.push(
      `_parseCommaList("${str.substring(0, 30)}${str.length > 30 ? '...' : ''}")`,
    );

    try {
      const parts = this._splitByOperator(str, ',');
      const expressions = parts
        .map(p => this._parseExpression(p.trim()))
        .filter(Boolean) as Expression[];

      if (expressions.length === 0) {
        this._throwParseError(
          'Comma-separated list contains no valid expressions',
          str,
          0,
          {
            expected: 'at least one valid expression',
            received: 'no valid expressions',
            operation: 'comma-separated list parsing',
          },
        );
      }

      this.context.callStack.pop();
      return expressions;
    } catch (error) {
      this.context.callStack.pop();
      throw error;
    }
  }

  private _isBalanced(str: string): boolean {
    let groupCount = 0;
    let bracketCount = 0;
    let parenCount = 0;
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === this.escapeChar) {
        escaped = true;
        continue;
      }

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      }

      if (!inQuotes) {
        // Handle configured group brackets (usually ())
        if (char === this.config.groups.OPEN) groupCount++;
        if (char === this.config.groups.CLOSE) groupCount--;

        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;

        if (char === '(') parenCount++;
        if (char === ')') parenCount--;

        // Check for negative counts (closing before opening)
        if (groupCount < 0 || bracketCount < 0 || parenCount < 0) return false;
      }
    }

    return groupCount === 0 && bracketCount === 0 && parenCount === 0;
  }

  private _containsTopLevelOperator(str: string, operator: string): boolean {
    let depth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === this.escapeChar) {
        escaped = true;
        continue;
      }

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      }

      if (!inQuotes) {
        // Handle configured group brackets (usually ())
        if (char === this.config.groups.OPEN) depth++;
        if (char === this.config.groups.CLOSE) depth--;

        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth--;

        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;

        // Check for operator at top level (not nested in any structure)
        if (
          char === operator &&
          depth === 0 &&
          bracketDepth === 0 &&
          parenDepth === 0
        )
          return true;
      }
    }

    return false;
  }

  private _isProperGroup(str: string): boolean {
    // Check if this is a proper group expression and not just a field with parentheses
    // A proper group should contain logical operators (commas, |) or be explicitly a group

    if (
      !str.startsWith(this.config.groups.OPEN) ||
      !str.endsWith(this.config.groups.CLOSE)
    ) {
      return false;
    }

    const content = str.slice(1, -1).trim();
    if (!content) return false;

    // Special case: PostgreSQL cast expressions like (field)::type.operator(value)
    // Check if this looks like a cast expression
    if (this._isPostgreSQLCastExpression(str)) {
      return false;
    }

    // If it contains top-level commas or OR operators, it's likely a group
    if (
      this._containsTopLevelOperator(content, this.config.groups.SEP) ||
      this._containsTopLevelOperator(content, this.config.groups.OR)
    ) {
      return true;
    }

    // If it starts with 'or(' it's definitely a function call, not a group
    if (content.startsWith('or(')) {
      return false;
    }

    // Check if it looks like a field expression with operators
    // Pattern: something.operator(value) or something[values] or something.operator.value
    const fieldPatterns = [
      /^.+\.[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)$/, // function style
      /^.+\.[a-zA-Z_][a-zA-Z0-9_]*\[[^\]]*\]$/, // list style
      /^.+\.[a-zA-Z_][a-zA-Z0-9_]*\..+$/, // operator style
    ];

    // If the content matches a field pattern, it's probably not a group
    for (const pattern of fieldPatterns) {
      if (pattern.test(content)) {
        return false;
      }
    }

    // If it's a simple field name or complex field path, it's not a group
    if (
      /^[a-zA-Z_][a-zA-Z0-9_\->.:\(\)]*$/.test(content) &&
      !content.includes(',') &&
      !content.includes('|')
    ) {
      return false;
    }

    return true;
  }

  private _isPostgreSQLCastExpression(str: string): boolean {
    // Check if this looks like a PostgreSQL cast expression: (field)::type.operator(value)
    // Pattern: (something)::type.operator OR (something)::type[values] OR (something)::type.operator.value

    if (!str.startsWith('(')) return false;

    // Find the first closing parenthesis
    let parenCount = 0;
    let closeParenIndex = -1;

    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(') parenCount++;
      if (str[i] === ')') {
        parenCount--;
        if (parenCount === 0) {
          closeParenIndex = i;
          break;
        }
      }
    }

    if (closeParenIndex === -1) return false;

    // Check if what follows looks like ::type.operator
    const remaining = str.slice(closeParenIndex + 1);

    // Must start with ::
    if (!remaining.startsWith('::')) return false;

    // Remove :: and check if it follows field.operator pattern
    const afterCast = remaining.slice(2);

    // Check for various operator patterns after the cast
    const castOperatorPatterns = [
      /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)$/, // type.operator(value)
      /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\[[^\]]*\]$/, // type.operator[values]
      /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\..+$/, // type.operator.value
    ];

    return castOperatorPatterns.some(pattern => pattern.test(afterCast));
  }
}

const defaultConfig: ParserConfig = {
  // Grouping syntax options
  groups: {
    OPEN: '(', // Can be '{' or '('
    CLOSE: ')', // Matching closing character
    SEP: ',', // Condition separator (for AND)
    OR: '|', // OR separator
    NOT: '!', // NOT operator
  },

  // Value syntax options
  values: {
    FUNCTION_STYLE: true, // Enable fn(value) syntax
    LIST_STYLE: '[]', // List format: '[]', '()', or '{}'
  },
};
