import {
  type Attribute,
  AttributeType,
  CursorValidator,
  Doc,
  FilterValidator,
  LimitValidator,
  OffsetValidator,
  OrderValidator,
} from '@nuvix/db'
import collections from '@nuvix/utils/collections'
import { ParseQueryPipe } from '../query.pipe'

const APP_DATABASE_QUERY_MAX_VALUES = 100

export class BaseQueryPipe extends ParseQueryPipe {
  public static ALLOWED_ATTRIBUTES: string[] = []

  private static get collections() {
    return {
      ...collections.internal,
      ...collections.project,
      ...collections.bucket,
      ...collections.database,
    }
  }

  constructor(collectionName: string, allowed: string[]) {
    const collection = BaseQueryPipe.collections[collectionName]!

    const attributes: Doc<Attribute>[] = []

    for (const attr of collection.attributes) {
      if (!allowed.includes(attr.key)) {
        continue
      }

      attributes.push(
        new Doc({
          $id: attr.$id,
          key: attr.key,
          type: attr.type,
          array: attr.array,
        }),
      )
    }

    attributes.push(
      new Doc({
        $id: '$id',
        key: '$id',
        type: AttributeType.String,
        array: false,
      }),
      new Doc({
        $id: '$createdAt',
        key: '$createdAt',
        type: AttributeType.Timestamptz,
        array: false,
      }),
      new Doc({
        $id: '$updatedAt',
        key: '$updatedAt',
        type: AttributeType.Timestamptz,
        array: false,
      }),
      new Doc({
        $id: '$sequence',
        key: '$sequence',
        type: AttributeType.Integer,
        array: false,
      }),
    )

    const validators = [
      new LimitValidator(),
      new OffsetValidator(),
      new CursorValidator(),
      new FilterValidator(attributes, APP_DATABASE_QUERY_MAX_VALUES),
      new OrderValidator(attributes),
    ]

    super({ validators })
  }
}
