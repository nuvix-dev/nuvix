import { AllowedOperators } from './base';

export interface ParsePosition {
  line: number;
  column: number;
  offset: number;
}

export interface ParseError extends Error {
  position: ParsePosition;
  statement: string;
  expected?: string;
  received?: string;
  context?: string;
}

export type JsonFieldType = {
  __type: 'json'; // TODO
  name: string;
  operator?: '->' | '->>';
};

export type ValueType = {
  __type: 'column' | 'raw';
  name: string;
};

export interface ParsedOrdering {
  path: string | (string | JsonFieldType)[];
  direction: 'asc' | 'desc';
  nulls: 'nullsfirst' | 'nullslast' | null;
}

export interface ColumnNode {
  type: 'column';
  tableName: string;
  path: string | (string | JsonFieldType)[];
  alias: string | null;
  cast: string | null;
  aggregate?: {
    fn: 'sum' | 'count' | 'min' | 'max' | 'avg';
    cast: string;
  };
}

export interface EmbedNode {
  type: 'embed';
  resource: string;
  mainTable: string;
  joinType: 'left' | 'right' | 'inner' | 'full' | 'cross';
  alias?: string;
  constraint: Expression & EmbedParserResult;
  select: SelectNode[];
  shape?: 'array' | 'object';
  flatten?: boolean;
}

export type SelectNode = ColumnNode | EmbedNode;

export interface ParserConfig {
  groups: {
    NOT: string;
    OPEN: '(' | '{';
    CLOSE: ')' | '}';
    OR: string;
    SEP: string;
  };
  values: {
    FUNCTION_STYLE: boolean;
    LIST_STYLE: '[]' | '()' | '{}';
  };
  cast: {
    OPEN: '{' | '(';
    CLOSE: '}' | ')';
  };
}

export interface Condition {
  tableName: string;
  field: string | (string | JsonFieldType)[];
  operator: AllowedOperators;
  values: (string | number | null | undefined | boolean | ValueType)[];
}

export interface NotExpression {
  not: Expression;
}

export interface OrExpression {
  or: Expression[];
}

export interface AndExpression {
  and: Expression[];
}

export type Expression =
  | Condition
  | NotExpression
  | OrExpression
  | AndExpression
  | null;

export interface ParserResult {
  limit?: number;
  offset?: number;
  group?: Condition['field'][];
  order?: ParsedOrdering[];
  shape?: 'array' | 'object';
}

export interface EmbedParserResult extends ParserResult {
  joinType?: 'left' | 'right' | 'inner' | 'full' | 'cross';
  order?: ParsedOrdering[];
}

export type FieldPath = string | (string | JsonFieldType)[];
