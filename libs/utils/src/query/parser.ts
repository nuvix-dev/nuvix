import { Logger } from '@nestjs/common';
import { Exception } from '@nuvix/core/extend/exception';
import type { Condition, Expression, JsonFieldType, ParserConfig } from './types';

export class Parser {
  private readonly logger = new Logger(Parser.name);

  private config: ParserConfig;
  private escapeChar: string;

  constructor(config: ParserConfig) {
    this.config = config;
    this.escapeChar = '\\';
    this._validateConfig();
  }

  parse(str: string): Expression {
    if (typeof str !== 'string') {
      throw new Error('Parser input must be a string');
    }
    try {
      return this._parseExpression(str.trim());
    } catch (error) {
      if (error instanceof Error) {
        throw new Exception(
          Exception.GENERAL_PARSER_ERROR,
          `Parse error: ${error.message}`,
        );
      }
      throw new Error('Unknown parsing error occurred');
    }
  }

  private _validateConfig(): void {
    if (!this.config?.groups) {
      throw new Error('Config must include groups configuration');
    }

    const { OPEN, CLOSE, SEP, OR, NOT } = this.config.groups;
    if (!OPEN || !CLOSE || !SEP || !OR || !NOT) {
      throw new Error(
        'All group characters (OPEN, CLOSE, SEP, OR, NOT) must be defined',
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

    // Validate parentheses balance
    if (!this._isBalanced(str)) {
      throw new Error(`Unbalanced brackets in expression: "${str}"`);
    }

    // Handle NOT expressions
    if (str.startsWith(this.config.groups.NOT)) {
      const remaining = str.slice(1).trim();
      if (!remaining) {
        throw new Error('NOT operator requires an expression to negate');
      }

      // If the remaining starts with parentheses, remove them first
      let innerExpression = remaining;
      if (remaining.startsWith('(') && remaining.endsWith(')')) {
        innerExpression = remaining.slice(1, -1).trim();
      }

      return { not: this._parseExpression(innerExpression) };
    }

    // Handle groups
    if (this._isProperGroup(str)) {
      const content = str.slice(1, -1).trim();
      if (!content) {
        throw new Error('Empty group expression is not allowed');
      }
      return this._parseGroup(content);
    }

    // Handle OR separator at top level
    if (this._containsTopLevelOperator(str, this.config.groups.OR)) {
      const parts = this._splitByOperator(str, this.config.groups.OR);
      if (parts.length < 2) {
        throw new Error('OR expression requires at least two operands');
      }
      const expressions = parts
        .map(p => this._parseExpression(p.trim()))
        .filter(Boolean) as Expression[];
      if (expressions.length === 0) {
        throw new Error('OR expression contains no valid operands');
      }
      return { or: expressions };
    }

    // Handle explicit OR function
    if (str.startsWith('or(') && str.endsWith(')')) {
      const content = str.slice(3, -1).trim();
      if (!content) {
        throw new Error('OR function requires at least one argument');
      }
      return { or: this._parseCommaList(content) };
    }

    // Handle explicit AND function
    if (str.startsWith('and(') && str.endsWith(')')) {
      const content = str.slice(4, -1).trim();
      if (!content) {
        throw new Error('AND function requires at least one argument');
      }
      return { and: this._parseCommaList(content) };
    }

    // Handle explicit NOT function
    if (str.startsWith('not(') && str.endsWith(')')) {
      const content = str.slice(4, -1).trim();
      if (!content) {
        throw new Error('NOT function requires an expression to negate');
      }
      return { not: this._parseExpression(content) };
    }

    // Handle comma-separated AND conditions
    if (this._containsTopLevelOperator(str, this.config.groups.SEP)) {
      const parts = this._splitByOperator(str, this.config.groups.SEP);

      if (parts.length < 2) {
        throw new Error('AND expression requires at least two operands');
      }
      const expressions = parts
        .map(p => this._parseExpression(p.trim()))
        .filter(Boolean) as Expression[];
      if (expressions.length === 0) {
        throw new Error('AND expression contains no valid operands');
      }
      return { and: expressions };
    }

    // Handle individual condition
    return this._parseCondition(str);
  }

  private _parseGroup(str: string): Expression {
    if (!str) {
      throw new Error('Group cannot be empty');
    }

    // Check for OR separator first
    if (this._containsTopLevelOperator(str, this.config.groups.OR)) {
      const parts = this._splitByOperator(str, this.config.groups.OR);
      const expressions = parts
        .map(p => this._parseExpression(p.trim()))
        .filter(Boolean) as Expression[];
      return { or: expressions };
    }

    // Check for explicit OR function
    if (str.startsWith('or(') && str.endsWith(')')) {
      const content = str.slice(3, -1).trim();
      return { or: this._parseCommaList(content) };
    }

    // Default to AND for comma-separated
    if (this._containsTopLevelOperator(str, this.config.groups.SEP)) {
      const parts = this._splitByOperator(str, this.config.groups.SEP);
      const expressions = parts
        .map(p => this._parseExpression(p.trim()))
        .filter(Boolean) as Expression[];
      return { and: expressions };
    }

    // Single condition group
    return this._parseExpression(str);
  }

  private _parseCondition(str: string): Condition {
    if (!str || str.trim().length === 0) {
      throw new Error('Condition cannot be empty');
    }

    const trimmed = str.trim();

    // Handle function-style: field.op(value) - supports complex field paths with JSON operators
    if (this.config.values.FUNCTION_STYLE) {
      // Find the last occurrence of .operator( pattern to handle complex field paths with parentheses
      // Look for the pattern: anything.operator(args) where operator doesn't contain dots or parentheses
      const match = trimmed.match(
        /^(.+)\.([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)$/,
      );
      if (match) {
        const [_, fieldPath, operator, args] = match;
        return this._buildCondition(
          fieldPath.trim(),
          operator.trim(),
          args,
        );
      }
    }

    // Handle list-style: field.op[value1,value2] - supports complex field paths
    if (this.config.values.LIST_STYLE) {
      const openChar = this.config.values.LIST_STYLE[0];
      const closeChar = this.config.values.LIST_STYLE[1];

      if (!openChar || !closeChar) {
        throw new Error('Invalid LIST_STYLE configuration');
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
          throw new Error(`Invalid field.operator format: "${fieldOpPath}"`);
        }
        const fieldPath = fieldOpPath.substring(0, lastDotIndex);
        const operator = fieldOpPath.substring(lastDotIndex + 1);
        return this._buildCondition(fieldPath.trim(), operator.trim(), args);
      }
    }

    throw new Error(
      `Unable to parse condition: "${trimmed}". Check your syntax.`,
    );
  }

  private _buildCondition(_field: string | undefined, operator: string | undefined, args: string): Condition {
    if (!_field || !operator) {
      throw new Error(
        `Both field and operator must be specified: "${_field}.${operator}"`,
      );
    }

    const field = this._parseField(_field)

    if (!args && args !== '') {
      return { field, operator, value: null, };
    }

    const values = this._parseArgumentList(args);

    if (values.length === 0) {
      return { field, operator, value: null, };
    }

    return values.length === 1
      ? { field, operator, value: values[0] }
      : { field, operator, values };
  }

  public _parseField(field: string): Condition['field'] {
    if (field.includes('->') || field.includes('->>') || field.includes('.')) {
      const parts: (string | JsonFieldType)[] = [];
      let current = '';
      let i = 0;

      while (i < field.length) {
        if (field.substring(i, i + 3) === '->>') {
          if (current) {
            parts.push({ name: current, operator: '->>' });
            current = '';
          }
          i += 3;
        } else if (field.substring(i, i + 2) === '->') {
          if (current) {
            parts.push({ name: current, operator: '->' });
            current = '';
          }
          i += 2;
        } else if (field[i] === '.') {
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
    } else {
      return field;
    }
  }

  private _parseArgumentList(args: string): any[] {
    if (!args && args !== '') return [];

    const values: any[] = [];
    let current = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < args.length; i++) {
      const char = args[i];

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

      // Handle nested structures
      if (!inQuotes) {
        if (char === '(' || char === '[' || char === '{') depth++;
        if (char === ')' || char === ']' || char === '}') depth--;
      }

      // Split at comma when not in nested structure
      if (char === ',' && depth === 0 && !inQuotes) {
        const trimmed = current.trim();
        if (trimmed) {
          values.push(this._parseValue(trimmed));
        }
        current = '';
      } else {
        current += char;
      }
    }

    // Add the last value
    const trimmed = current.trim();
    if (trimmed) {
      values.push(this._parseValue(trimmed));
    }

    return values.filter(v => v !== '');
  }

  private _parseValue(val: string): any {
    if (!val && val !== '') return '';

    const trimmed = val.trim();

    // Handle quoted strings
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }

    // Handle boolean values
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;

    // Handle ISO date strings (common in PostgreSQL)
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(trimmed)) {
      return trimmed;
    }

    // Handle PostgreSQL cast expressions like (field)::type
    if (trimmed.includes('::')) {
      return trimmed;
    }

    // Handle numbers (including scientific notation)
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num) && isFinite(num)) {
        return num;
      }
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
        // Handle configured group brackets (usually {})
        if (char === this.config.groups.OPEN) depth++;
        if (char === this.config.groups.CLOSE) depth--;

        // Handle square brackets []
        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth--;

        // Handle parentheses ()
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

    const parts = this._splitByOperator(str, ',');
    const expressions = parts
      .map(p => this._parseExpression(p.trim()))
      .filter(Boolean) as Expression[];

    if (expressions.length === 0) {
      throw new Error('Comma-separated list contains no valid expressions');
    }

    return expressions;
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
        // Handle configured group brackets (usually {})
        if (char === this.config.groups.OPEN) groupCount++;
        if (char === this.config.groups.CLOSE) groupCount--;

        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;

        // Handle parentheses ()
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
        // Handle configured group brackets (usually {})
        if (char === this.config.groups.OPEN) depth++;
        if (char === this.config.groups.CLOSE) depth--;

        // Handle square brackets []
        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth--;

        // Handle parentheses ()
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

export const parser = new Parser(defaultConfig);
