export type JsonFieldType = {
  name: string;
  operator?: '->' | '->>';
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
}

export interface EmbedNode {
  type: 'embed';
  resource: string;
  mainTable: string;
  joinType: 'left' | 'right' | 'inner' | 'full' | 'cross';
  alias?: string;
  constraint: Expression;
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
}

export interface Condition {
  tableName: string;
  field: string | (string | JsonFieldType)[];
  operator: string;
  value?: any; // TODO: --
  values?: any[];
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

export type FieldPath = string | (string | JsonFieldType)[];
