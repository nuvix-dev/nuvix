import { ParsedOrdering } from "./types";

class OrderParser {
    private static readonly DIRECTIONS = ['asc', 'desc'] as const;
    private static readonly NULLS_HANDLING = ['nullsfirst', 'nullslast'] as const;

    static parse(orderStr: string | null | undefined): ParsedOrdering[] {
        if (!orderStr?.trim()) return [];

        return orderStr.split(',').map(part => {
            const tokens = this.tokenize(part.trim());
            return this.parseOrdering(tokens);
        });
    }

    private static tokenize(str: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let i = 0;

        while (i < str.length) {
            const char = str[i];
            const next = str[i + 1];

            // Handle arrow operators
            if (char === '-' && next === '>') {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }

                // Check for double arrow
                if (str[i + 2] === '>') {
                    tokens.push('->>');
                    i += 3;
                } else {
                    tokens.push('->');
                    i += 2;
                }
                continue;
            }

            // Handle dot separator
            if (char === '.') {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }
                i++;
                continue;
            }

            // Handle whitespace
            if (char === ' ') {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }
                i++;
                continue;
            }

            current += char;
            i++;
        }

        if (current.trim()) {
            tokens.push(current.trim());
        }

        return tokens.filter(token => token.length > 0);
    }

    private static parseOrdering(tokens: string[]): ParsedOrdering {
        if (tokens.length === 0) {
            throw new Error('Empty ordering expression');
        }

        const result: ParsedOrdering = {
            path: '',
            direction: 'asc',
            nulls: null
        };

        const pathTokens: string[] = [];

        for (const token of tokens) {
            if (this.DIRECTIONS.includes(token as any)) {
                result.direction = token as 'asc' | 'desc';
            } else if (this.NULLS_HANDLING.includes(token as any)) {
                result.nulls = token as 'nullsfirst' | 'nullslast';
            } else {
                pathTokens.push(token);
            }
        }

        if (pathTokens.length === 0) {
            throw new Error('No column path specified');
        }

        // Reconstruct path with proper spacing around arrows
        result.path = pathTokens.join('');

        return result;
    }
}

export { OrderParser, type ParsedOrdering };
