import { describe, expect, it } from 'bun:test'
import type { Database } from '@nuvix/db'
import type { SQL } from 'bun'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors'
import { DatabaseService } from './service'

describe('DatabaseService', () => {
  const store = new Map<string, { name: string; description: string | null; type: string }>([
    ['system', { name: 'system', description: 'System schema', type: 'managed' }],
    ['auth', { name: 'auth', description: 'Auth schema', type: 'managed' }],
    ['appdata', { name: 'appdata', description: 'App data', type: 'managed' }],
    ['docs', { name: 'docs', description: 'Documents', type: 'document' }],
  ])

  // Mock Bun SQL tagged template function
  const mockSql = ((first: unknown, ...values: unknown[]) => {
    if (typeof first === 'string') {
      return `"${first}"`
    }
    const strings = first as TemplateStringsArray
    const query = strings.join('?').trim()

    if (query.includes('from system.schemas') && query.includes('where type =')) {
      const type = values[0] as string
      const results = [...store.values()].filter((s) => s.type === type)
      return Promise.resolve(results)
    }

    if (query.includes('from system.schemas') && query.includes('where name =')) {
      const name = values[0] as string
      const item = store.get(name)
      return Promise.resolve(item ? [item] : [])
    }

    if (query.includes('from system.schemas')) {
      return Promise.resolve([...store.values()])
    }

    if (query.includes('select system.create_schema')) {
      const [name, type, description] = values as [string, string, string | null]
      store.set(name, { name, type, description: description ?? null })
      return Promise.resolve([])
    }

    if (query.includes('update system.schemas')) {
      const [description, name] = values as [string | null, string]
      const existing = store.get(name)
      if (existing) {
        existing.description = description
      }
      return Promise.resolve([])
    }

    if (query.includes('drop schema') || query.includes('delete from system.schemas')) {
      const rawName = String(values[0] ?? '')
      const cleanName = rawName.replace(/^"|"$/g, '')
      store.delete(cleanName)
      return Promise.resolve([])
    }

    return Promise.resolve([])
  }) as unknown as SQL

  const service = new DatabaseService(mockSql)

  it('lists non-reserved schemas with total meta', async () => {
    const result = await service.list()
    expect(result.meta.total).toBe(2)
    expect(result.data.map((s) => s.name)).toEqual(['appdata', 'docs'])
  })

  it('filters schemas by type', async () => {
    const result = await service.list('document')
    expect(result.data.length).toBe(1)
    expect(result.data[0]?.name).toBe('docs')
  })

  it('gets a schema by name', async () => {
    const schema = await service.get('appdata')
    expect(schema).toEqual({
      name: 'appdata',
      description: 'App data',
      type: 'managed',
    })
  })

  it('throws NotFoundError for unknown schema', async () => {
    expect(service.get('unknown')).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError for reserved schema', async () => {
    expect(service.get('auth')).rejects.toThrow(NotFoundError)
  })

  it('creates a managed schema', async () => {
    const created = await service.create({
      name: 'analytics',
      type: 'managed',
      description: 'Analytics data',
    })
    expect(created).toEqual({
      name: 'analytics',
      description: 'Analytics data',
      type: 'managed',
    })
  })

  it('creates a document schema with dbFactory and seeds metadata', async () => {
    let createdDb = false
    const mockDb = {
      create: () => {
        createdDb = true
        return Promise.resolve()
      },
    } as unknown as Database

    const docService = new DatabaseService(mockSql, () => mockDb)
    const created = await docService.create({
      name: 'newdocs',
      type: 'document',
      description: 'New doc store',
    })
    expect(created.name).toBe('newdocs')
    expect(createdDb).toBe(true)
  })

  it('rolls back when document schema creation fails', async () => {
    const failingDb = {
      create: () => Promise.reject(new Error('DDL failed')),
    } as unknown as Database

    const failingService = new DatabaseService(mockSql, () => failingDb)
    await expect(
      failingService.create({
        name: 'faildocs',
        type: 'document',
      }),
    ).rejects.toThrow('DDL failed')

    expect(store.has('faildocs')).toBe(false)
  })

  it('rejects invalid schema names', async () => {
    await expect(
      service.create({
        name: '123_invalid',
        type: 'managed',
      }),
    ).rejects.toThrow(BadRequestError)
  })

  it('rejects reserved schema names', async () => {
    await expect(
      service.create({
        name: 'auth',
        type: 'managed',
      }),
    ).rejects.toThrow(BadRequestError)
  })

  it('rejects duplicate schema names with ConflictError', async () => {
    await expect(
      service.create({
        name: 'appdata',
        type: 'managed',
      }),
    ).rejects.toThrow(ConflictError)
  })

  it('updates schema description', async () => {
    const updated = await service.update('appdata', { description: 'Updated desc' })
    expect(updated.description).toBe('Updated desc')
  })

  it('deletes a schema', async () => {
    await service.delete('appdata')
    expect(store.has('appdata')).toBe(false)
    await expect(service.get('appdata')).rejects.toThrow(NotFoundError)
  })
})
