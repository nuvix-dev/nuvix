import { Exclude, Expose } from 'class-transformer';
import { AttributeModel } from './Attribute.model';
import { AttributeType, OnDelete, RelationType } from '@nuvix-tech/db';
import { AttributeFormat } from '@nuvix/utils';

@Exclude()
export class AttributeBooleanModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.Boolean;
  @Expose() default: boolean | null = null;

  constructor(partial: Partial<AttributeBooleanModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeDatetimeModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.Timestamptz;
  @Expose() format: AttributeFormat = AttributeFormat.DATETIME;
  @Expose() default: string | null = null;

  constructor(partial: Partial<AttributeDatetimeModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeEmailModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String;
  @Expose() format: AttributeFormat = AttributeFormat.EMAIL;
  @Expose() default: string | null = null;

  constructor(partial: Partial<AttributeEmailModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeEnumModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String;
  @Expose() elements: string[] = [];
  @Expose() format: AttributeFormat = AttributeFormat.ENUM;
  @Expose() default: string | null = null;

  constructor(partial: Partial<AttributeEnumModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeFloatModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.Float;
  @Expose() min: number | null = null;
  @Expose() max: number | null = null;
  @Expose() default: number | null = null;

  constructor(partial: Partial<AttributeFloatModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeIPModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String;
  @Expose() format: AttributeFormat = AttributeFormat.IP;
  @Expose() default: string | null = null;

  constructor(partial: Partial<AttributeIPModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeIntegerModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.Integer;
  @Expose() min: number | null = null;
  @Expose() max: number | null = null;
  @Expose() default: number | null = null;

  constructor(partial: Partial<AttributeIntegerModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeListModel extends AttributeModel {
  @Expose() total: number = 0;
  @Expose() attributes: any[] = [];

  constructor(partial: Partial<AttributeListModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeRelationshipModel extends AttributeModel {
  @Expose() relatedCollection: string | null = null;
  @Expose() relationType: RelationType = RelationType.OneToOne;
  @Expose() twoWay: boolean = false;
  @Expose() twoWayKey!: string;
  @Expose() onDelete: OnDelete = OnDelete.Restrict;
  @Expose() side: string = '';

  constructor(partial: Partial<AttributeRelationshipModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeStringModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String;
  @Expose() size: number = 0;
  @Expose() default: string | null = null;

  constructor(partial: Partial<AttributeStringModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeURLModel extends AttributeModel {
  @Expose() override type: AttributeType = AttributeType.String;
  @Expose() format: AttributeFormat = AttributeFormat.URL;
  @Expose() default: string | null = null;

  constructor(partial: Partial<AttributeURLModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}
