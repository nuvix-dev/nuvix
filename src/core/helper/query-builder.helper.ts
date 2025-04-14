

export class QueryBuilder {
    private query: Record<string, unknown>;

    private _select: Array<{
        field: string;
        alias: string;
    }> = [];

    private _where: Array<{
        field: string;
        operator: string;
        value: unknown;
    }> = [];
    private _orderBy: Array<{
        field: string;
        order: 'asc' | 'desc';
        nulls: 'first' | 'last';
    }> = [];
    private _limit: number | null = null;

    constructor(query: Record<string, unknown>) {
        this.query = query;
    }

    select(...fields: string[]) {
        this._select = fields.map((field) => {
            const [name, alias] = field.split(':', 2);
            return {
                field: name,
                alias: alias || name,
            };
        });
        return this;
    }

    where(field: string, operator: string, value: unknown) {
        this._where.push({ field, operator, value });
        return this;
    }




}