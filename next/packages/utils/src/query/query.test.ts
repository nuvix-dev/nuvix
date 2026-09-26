import { describe, expect, it } from 'bun:test'
import { createDatabase } from '@nuvix/pg'
import { ASTToQueryBuilder } from './builder'
import { OrderParser } from './order'
import { Parser } from './parser'
import { SelectParser } from './select'
import { Tokenizer, TokenType } from './tokenizer'

describe('Nuvix Query Engine', () => {
  describe('Tokenizer', () => {
    it('tokenizes identifiers, dots, and operators', () => {
      const tokens = new Tokenizer('status.eq(active)').tokenize()
      expect(tokens.map((t) => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.DOT,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.RPAREN,
        TokenType.EOF,
      ])
      expect(tokens[0]?.value).toBe('status')
      expect(tokens[2]?.value).toBe('eq')
      expect(tokens[4]?.value).toBe('active')
    })

    it('tokenizes JSON extractors and casts', () => {
      const tokens = new Tokenizer('profile->address->>city::text').tokenize()
      expect(tokens.map((t) => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.JSON_EXTRACT,
        TokenType.IDENTIFIER,
        TokenType.JSON_EXTRACT_TEXT,
        TokenType.IDENTIFIER,
        TokenType.CAST,
        TokenType.IDENTIFIER,
        TokenType.EOF,
      ])
    })
  })

  describe('Parser', () => {
    it('parses simple condition', () => {
      const ast = Parser.create({ tableName: 'users' }).parse('age.gte(18)')
      expect(ast).toEqual({
        tableName: 'users',
        field: 'age',
        operator: 'gte',
        values: [18],
      })
    })

    it('parses comma-separated AND conditions', () => {
      const ast = Parser.create({ tableName: 'users' }).parse('age.gte(18),status.eq(active)')
      expect(ast).toEqual({
        and: [
          { tableName: 'users', field: 'age', operator: 'gte', values: [18] },
          { tableName: 'users', field: 'status', operator: 'eq', values: ['active'] },
        ],
      })
    })

    it('parses pipe-separated OR conditions', () => {
      const ast = Parser.create({ tableName: 'users' }).parse('role.eq(admin)|role.eq(owner)')
      expect(ast).toEqual({
        or: [
          { tableName: 'users', field: 'role', operator: 'eq', values: ['admin'] },
          { tableName: 'users', field: 'role', operator: 'eq', values: ['owner'] },
        ],
      })
    })

    it('parses function-style logical expressions', () => {
      const ast = Parser.create({ tableName: 'users' }).parse('or(role.eq(admin),role.eq(owner))')
      expect(ast).toEqual({
        or: [
          { tableName: 'users', field: 'role', operator: 'eq', values: ['admin'] },
          { tableName: 'users', field: 'role', operator: 'eq', values: ['owner'] },
        ],
      })
    })

    it('parses NOT expressions', () => {
      const ast = Parser.create({ tableName: 'users' }).parse('!status.eq(deleted)')
      expect(ast).toEqual({
        not: { tableName: 'users', field: 'status', operator: 'eq', values: ['deleted'] },
      })
    })

    it('parses special variables $limit and $offset', () => {
      const ast = Parser.create({ tableName: 'users' }).parse(
        'status.eq(active),$limit(25),$offset(50)',
      )
      expect(ast.limit).toBe(25)
      expect(ast.offset).toBe(50)
      expect((ast as any).operator).toBe('eq')
    })
  })

  describe('SelectParser', () => {
    it('parses column selections with aliases and casts', () => {
      const nodes = new SelectParser({ tableName: 'users' }).parse(
        'id,user_name:name,created_at::date',
      )
      expect(nodes.length).toBe(3)
      expect(nodes[0]).toEqual({
        type: 'column',
        tableName: 'users',
        path: 'id',
        alias: null,
        cast: null,
        aggregate: undefined,
      })
      expect(nodes[1]).toEqual({
        type: 'column',
        tableName: 'users',
        path: 'name',
        alias: 'user_name',
        cast: null,
        aggregate: undefined,
      })
      expect(nodes[2]).toEqual({
        type: 'column',
        tableName: 'users',
        path: 'created_at',
        alias: null,
        cast: 'date',
        aggregate: undefined,
      })
    })

    it('parses aggregate functions', () => {
      const nodes = new SelectParser({ tableName: 'orders' }).parse(
        'count(*),total:sum(amount)::int',
      )
      expect(nodes.length).toBe(2)
      expect(nodes[0]?.type).toBe('column')
      expect((nodes[0] as any).aggregate?.fn).toBe('count')
      expect((nodes[1] as any).aggregate?.fn).toBe('sum')
      expect((nodes[1] as any).aggregate?.cast).toBe('int')
      expect((nodes[1] as any).alias).toBe('total')
    })
  })

  describe('OrderParser', () => {
    it('parses multi-column ordering with direction and null handling', () => {
      const orderings = OrderParser.parse('created_at.desc.nullslast,name.asc', 'users')
      expect(orderings).toEqual([
        {
          path: 'created_at',
          direction: 'desc',
          nulls: 'nullslast',
        },
        {
          path: 'name',
          direction: 'asc',
          nulls: null,
        },
      ])
    })
  })

  describe('ASTToQueryBuilder with @nuvix/pg', () => {
    const fakeClient: any = {
      unsafe: async () => [],
    }

    it('applies complex filters to @nuvix/pg query builder', () => {
      const db = createDatabase(fakeClient)
      const qb = db.table('users').withSchema('public')

      const ast = Parser.create({ tableName: 'users' }).parse(
        'age.gte(18),status.in(active,pending),or(role.eq(admin),role.eq(owner))',
      )

      const builder = new ASTToQueryBuilder(qb, db)
      builder.applyFilters(ast)

      const compiled = builder.qb.toSQL()
      expect(compiled.text).toBe(
        'select * from "public"."users" where "users"."age" >= $1 and "users"."status" in ($2, $3) and ("users"."role" = $4 or "users"."role" = $5)',
      )
      expect(compiled.values).toEqual([18, 'active', 'pending', 'admin', 'owner'])
    })

    it('applies select projections, order, limit, and offset', () => {
      const db = createDatabase(fakeClient)
      const qb = db.table('users').withSchema('public')

      const selectNodes = new SelectParser({ tableName: 'users' }).parse(
        'id,user_name:name,created_at::date',
      )
      const orderings = OrderParser.parse('id.desc', 'users')

      const builder = new ASTToQueryBuilder(qb, db)
      builder.applySelect(selectNodes)
      builder.applyOrder(orderings, 'users')
      builder.applyLimitOffset({ limit: 10, offset: 20 })

      const compiled = builder.qb.toSQL()
      expect(compiled.text).toBe(
        'select "users"."id", "users"."name" as "user_name", cast(("users"."created_at") as date) from "public"."users" order by "users"."id" desc limit $1 offset $2',
      )
      expect(compiled.values).toEqual([10, 20])
    })

    it('applies NOT expressions and null/between checks', () => {
      const db = createDatabase(fakeClient)
      const qb = db.table('users').withSchema('public')

      const ast = Parser.create({ tableName: 'users' }).parse(
        '!status.eq(deleted),score.between(50,100),deleted_at.is(null)',
      )

      const builder = new ASTToQueryBuilder(qb, db)
      builder.applyFilters(ast)

      const compiled = builder.qb.toSQL()
      expect(compiled.text).toBe(
        'select * from "public"."users" where (not ("users"."status" = $1)) and "users"."score" between $2 and $3 and "users"."deleted_at" is null',
      )
      expect(compiled.values).toEqual(['deleted', 50, 100])
    })

    it('handles JSON extractors in filters and selections', () => {
      const db = createDatabase(fakeClient)
      const qb = db.table('users').withSchema('public')

      const ast = Parser.create({ tableName: 'users' }).parse(
        'metadata->address->>city.eq(Bangalore)',
      )
      const selectNodes = new SelectParser({ tableName: 'users' }).parse(
        'id,city:metadata->address->>city',
      )

      const builder = new ASTToQueryBuilder(qb, db)
      builder.applySelect(selectNodes)
      builder.applyFilters(ast)

      const compiled = builder.qb.toSQL()
      expect(compiled.text).toBe(
        'select "users"."id", "users"."metadata"->\'address\'->>\'city\' as "city" from "public"."users" where "users"."metadata"->\'address\'->>\'city\' = $1',
      )
      expect(compiled.values).toEqual(['Bangalore'])
    })
  })
})
