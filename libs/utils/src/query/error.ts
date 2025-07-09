import { ParseError, ParsePosition } from './types';

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
    super(message);
    this.name = 'ParserError';
    this.position = position;
    this.statement = statement;
    this.expected = options.expected;
    this.received = options.received;
    this.context = options.context;
  }

  public toString(): string {
    const pos = `Line ${this.position.line}, Column ${this.position.column}`;
    const parts = [this.message, `at ${pos}`, `in: "${this.statement}"`];

    if (this.expected) parts.push(`Expected: ${this.expected}`);
    if (this.received) parts.push(`Received: ${this.received}`);

    return parts.join('\n');
  }
}
