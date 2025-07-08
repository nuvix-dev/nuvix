import { ParseError, ParsePosition } from './types';

export class ParserError extends Error implements ParseError {
  public position: ParsePosition;
  public statement: string;
  public expected?: string;
  public received?: string;
  public context?: string;
  public hint?: string;
  public detail?: string;

  constructor(
    message: string,
    position: ParsePosition,
    statement: string,
    options: {
      expected?: string;
      received?: string;
      context?: string;
      hint?: string;
    } = {},
  ) {
    super(message);
    this.name = 'ParserError';
    this.position = position;
    this.statement = statement;
    this.expected = options.expected;
    this.received = options.received;
    this.context = options.context;
    this.hint = options.hint ?? ParserError.defaultHint(options);
    this.detail = ParserError.formatDetail(position, statement, options);
  }

  private static formatDetail(
    position: ParsePosition,
    statement: string,
    options: { expected?: string; received?: string },
  ): string {
    const parts: string[] = []; // [`Line ${position.line}, Column ${position.column}`];
    if (options.expected) parts.push(`Expected: ${options.expected}`);
    if (options.received) parts.push(`Received: ${options.received}`);
    return parts.join('\n');
  }

  private static defaultHint(options: {
    expected?: string;
    received?: string;
  }): string | undefined {
    if (!options.expected || !options.received) return undefined;
    return `Check the syntax of your condition. ${options.expected}`;
  }
}
