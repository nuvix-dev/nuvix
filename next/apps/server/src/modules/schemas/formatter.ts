import type { Attribute, Collection, Doc, Index } from '@nuvix/db'

export interface CollectionView {
  $id: string
  $createdAt?: string
  $updatedAt?: string
  $permissions?: string[]
  name: string
  enabled: boolean
  documentSecurity: boolean
  attributes: AttributeView[]
  indexes: IndexView[]
}

export interface AttributeView {
  $id: string
  key: string
  type: string
  status?: string
  error?: string
  required?: boolean
  array?: boolean
  size?: number
  default?: unknown
  format?: string
  formatOptions?: Record<string, unknown>
  filters?: string[]
  options?: Record<string, unknown>
}

export interface IndexView {
  $id: string
  key: string
  type: string
  status?: string
  error?: string
  attributes: string[]
  orders?: string[]
}

export interface DocumentView {
  $id: string
  $collection?: string
  $createdAt?: string
  $updatedAt?: string
  $permissions?: string[]
  [key: string]: unknown
}

export function formatCollection(doc: Doc<Collection>): CollectionView {
  const rawAttributes = (doc.get('attributes') ?? []) as Array<Attribute | Doc<Attribute>>
  const rawIndexes = (doc.get('indexes') ?? []) as Array<Index | Doc<Index>>

  return {
    $id: doc.getId(),
    $createdAt: doc.get('$createdAt') ? String(doc.get('$createdAt')) : undefined,
    $updatedAt: doc.get('$updatedAt') ? String(doc.get('$updatedAt')) : undefined,
    $permissions: doc.getPermissions(),
    name: doc.get('name') ?? doc.getId(),
    enabled: doc.get('enabled') ?? true,
    documentSecurity: doc.get('documentSecurity') ?? true,
    attributes: rawAttributes.map((a) =>
      typeof (a as Doc<Attribute>).toObject === 'function'
        ? formatAttribute(a as Doc<Attribute>)
        : formatAttribute(
            new (doc.constructor as unknown as { new (val: unknown): Doc<Attribute> })(a),
          ),
    ),
    indexes: rawIndexes.map((i) =>
      typeof (i as Doc<Index>).toObject === 'function'
        ? formatIndex(i as Doc<Index>)
        : formatIndex(new (doc.constructor as unknown as { new (val: unknown): Doc<Index> })(i)),
    ),
  }
}

export function formatAttribute(doc: Doc<Attribute>): AttributeView {
  const key = doc.get('key') || doc.getId()
  return {
    $id: doc.getId() || key,
    key,
    type: doc.get('type') ?? 'string',
    status: doc.get('status') as string | undefined,
    error: doc.get('error') as string | undefined,
    required: doc.get('required'),
    array: doc.get('array'),
    size: doc.get('size'),
    default: doc.get('default'),
    format: doc.get('format'),
    formatOptions: doc.get('formatOptions'),
    filters: doc.get('filters'),
    options: doc.get('options') as Record<string, unknown> | undefined,
  }
}

export function formatIndex(doc: Doc<Index>): IndexView {
  const key = doc.get('key') || doc.getId()
  const rawOrders = doc.get('orders')
  const orders = rawOrders ? rawOrders.filter((o): o is string => typeof o === 'string') : undefined

  return {
    $id: doc.getId() || key,
    key,
    type: doc.get('type') ?? 'key',
    status: doc.get('status') as string | undefined,
    error: doc.get('error') as string | undefined,
    attributes: doc.get('attributes') ?? [],
    orders,
  }
}

export function formatDocument(doc: Doc): DocumentView {
  return {
    ...doc.toObject(),
    $id: doc.getId(),
    $collection: doc.getCollection(),
    $createdAt: doc.createdAt()?.toISOString(),
    $updatedAt: doc.updatedAt()?.toISOString(),
    $permissions: doc.getPermissions(),
  }
}
