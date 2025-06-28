import { ParsedOrdering } from './types';

class OrderParser {
  private static readonly SORT_DIRECTIONS = ['asc', 'desc'] as const;
  private static readonly NULL_HANDLING_OPTIONS = [
    'nullsfirst',
    'nullslast',
  ] as const;

  static parse(orderingString: string | null | undefined): ParsedOrdering[] {
    if (!orderingString?.trim()) return [];

    return orderingString.split(',').map(orderClause => {
      const tokens = this.tokenize(orderClause.trim());
      return this.parseOrderingClause(tokens);
    });
  }

  private static tokenize(inputString: string): string[] {
    const tokens: string[] = [];
    let currentToken = '';
    let charIndex = 0;

    while (charIndex < inputString.length) {
      const currentChar = inputString[charIndex];
      const nextChar = inputString[charIndex + 1];

      // Handle arrow operators (-> and ->>)
      if (currentChar === '-' && nextChar === '>') {
        if (currentToken.trim()) {
          tokens.push(currentToken.trim());
          currentToken = '';
        }

        // Check for double arrow (->>)
        if (inputString[charIndex + 2] === '>') {
          tokens.push('->>');
          charIndex += 3;
        } else {
          tokens.push('->');
          charIndex += 2;
        }
        continue;
      }

      // Handle dot separator
      if (currentChar === '.') {
        if (currentToken.trim()) {
          tokens.push(currentToken.trim());
          currentToken = '';
        }
        charIndex++;
        continue;
      }

      // Handle whitespace
      if (currentChar === ' ') {
        if (currentToken.trim()) {
          tokens.push(currentToken.trim());
          currentToken = '';
        }
        charIndex++;
        continue;
      }

      currentToken += currentChar;
      charIndex++;
    }

    if (currentToken.trim()) {
      tokens.push(currentToken.trim());
    }

    return tokens.filter(token => token.length > 0);
  }

  private static parseOrderingClause(tokens: string[]): ParsedOrdering {
    if (tokens.length === 0) {
      throw new Error('Empty ordering expression');
    }

    const orderingResult: ParsedOrdering = {
      path: '',
      direction: 'asc',
      nulls: null,
    };

    const pathTokens: string[] = [];

    for (const token of tokens) {
      if (this.SORT_DIRECTIONS.includes(token as any)) {
        orderingResult.direction = token as 'asc' | 'desc';
      } else if (this.NULL_HANDLING_OPTIONS.includes(token as any)) {
        orderingResult.nulls = token as 'nullsfirst' | 'nullslast';
      } else {
        pathTokens.push(token);
      }
    }

    if (pathTokens.length === 0) {
      throw new Error('No column path specified');
    }

    // Reconstruct path with proper spacing around arrows
    orderingResult.path = pathTokens.join('');

    return orderingResult;
  }
}

export { OrderParser, type ParsedOrdering };
