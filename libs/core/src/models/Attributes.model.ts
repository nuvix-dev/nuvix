import { Exclude, Expose } from 'class-transformer'
import { AttributeModel } from './Attribute.model'
import { AttributeType, OnDelete, RelationSide, RelationType } from '@nuvix/db'
import { AttributeFormat } from '@nuvix/utils'

@Exclude()
export class AttributeBooleanModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.Boolean
  @Expose() override default: boolean | null = null

  constructor(partial: Partial<AttributeBooleanModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeDatetimeModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.Timestamptz
  @Expose() override format: AttributeFormat = AttributeFormat.DATETIME
  @Expose() override default: string | null = null

  constructor(partial: Partial<AttributeDatetimeModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeEmailModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String
  @Expose() override format: AttributeFormat = AttributeFormat.EMAIL
  @Expose() override default: string | null = null

  constructor(partial: Partial<AttributeEmailModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeEnumModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String
  @Expose() override elements: string[] = []
  @Expose() override format: AttributeFormat = AttributeFormat.ENUM
  @Expose() override default: string | null = null

  constructor(partial: Partial<AttributeEnumModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeFloatModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.Float
  @Expose() override min: number | null = null
  @Expose() override max: number | null = null
  @Expose() override default: number | null = null

  constructor(partial: Partial<AttributeFloatModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeIPModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String
  @Expose() override format: AttributeFormat = AttributeFormat.IP
  @Expose() override default: string | null = null

  constructor(partial: Partial<AttributeIPModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeIntegerModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.Integer
  @Expose() override min: number | null = null
  @Expose() override max: number | null = null
  @Expose() override default: number | null = null

  constructor(partial: Partial<AttributeIntegerModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeListModel extends AttributeModel {
  @Expose() total: number = 0
  @Expose() attributes: any[] = []

  constructor(partial: Partial<AttributeListModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeRelationshipModel extends AttributeModel {
  @Expose() override relatedCollection: string | null = null
  @Expose() override relationType: RelationType = RelationType.OneToOne
  @Expose() override twoWay: boolean = false
  @Expose() override twoWayKey?: string | undefined = undefined
  @Expose() override onDelete: OnDelete = OnDelete.Restrict
  @Expose() override side: RelationSide = RelationSide.Parent

  constructor(partial: Partial<AttributeRelationshipModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeStringModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String
  @Expose() override size: number = 0
  @Expose() override default: string | null = null

  constructor(partial: Partial<AttributeStringModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class AttributeURLModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String
  @Expose() override format: AttributeFormat = AttributeFormat.URL
  @Expose() override default: string | null = null

  constructor(partial: Partial<AttributeURLModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
