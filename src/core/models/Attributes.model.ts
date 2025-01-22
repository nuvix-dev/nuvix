import { Exclude, Expose } from 'class-transformer';
import { AttributeModel } from './Attribute.model';

@Exclude()
export class AttributeBooleanModel extends AttributeModel {
  @Expose() key: string = ''; // Default to empty string
  @Expose() type: string = 'boolean'; // Default to 'boolean'
  @Expose() default: boolean | null = null; // Default to null

  constructor(partial: Partial<AttributeBooleanModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeDatetimeModel extends AttributeModel {
  @Expose() key: string = ''; // Default to empty string
  @Expose() type: string = 'datetime'; // Default to 'datetime'
  @Expose() format: string = ''; // Default to empty string
  @Expose() default: string | null = null; // Default to null

  constructor(partial: Partial<AttributeDatetimeModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeEmailModel extends AttributeModel {
  @Expose() key: string = ''; // Default to empty string
  @Expose() type: string = 'string'; // Default to 'string'
  @Expose() format: string = ''; // Default to empty string
  @Expose() default: string | null = null; // Default to null

  constructor(partial: Partial<AttributeEmailModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeEnumModel extends AttributeModel {
  @Expose() key: string = ''; // Default to empty string
  @Expose() type: string = 'string'; // Default to 'string'
  @Expose() elements: string[] = []; // Default to empty array
  @Expose() format: string = ''; // Default to empty string
  @Expose() default: string | null = null; // Default to null

  constructor(partial: Partial<AttributeEnumModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeFloatModel extends AttributeModel {
  @Expose() key: string = ''; // Default to empty string
  @Expose() type: string = 'double'; // Default to 'double'
  @Expose() min: number | null = null; // Default to null
  @Expose() max: number | null = null; // Default to null
  @Expose() default: number | null = null; // Default to null

  constructor(partial: Partial<AttributeFloatModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeIPModel extends AttributeModel {
  @Expose() key: string = ''; // Default to empty string
  @Expose() type: string = 'string'; // Default to 'string'
  @Expose() format: string = ''; // Default to empty string
  @Expose() default: string | null = null; // Default to null

  constructor(partial: Partial<AttributeIPModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeIntegerModel extends AttributeModel {
  @Expose() key: string = ''; // Default to empty string
  @Expose() type: string = 'integer'; // Default to 'integer'
  @Expose() min: number | null = null; // Default to null
  @Expose() max: number | null = null; // Default to null
  @Expose() default: number | null = null; // Default to null

  constructor(partial: Partial<AttributeIntegerModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeListModel extends AttributeModel {
  @Expose() total: number = 0; // Default to 0
  @Expose() attributes: any[] = []; // Default to empty array

  constructor(partial: Partial<AttributeListModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeRelationshipModel extends AttributeModel {
  @Expose() relatedCollection: string | null = null; // Default to null
  @Expose() relationType: string = ''; // Default to empty string
  @Expose() twoWay: boolean = false; // Default to false
  @Expose() twoWayKey: string = ''; // Default to empty string
  @Expose() onDelete: string = 'restrict'; // Default to 'restrict'
  @Expose() side: string = ''; // Default to empty string

  constructor(partial: Partial<AttributeRelationshipModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeStringModel extends AttributeModel {
  @Expose() key: string = ''; // Default to empty string
  @Expose() type: string = 'string'; // Default to 'string'
  @Expose() size: number = 0; // Default to 0
  @Expose() default: string | null = null; // Default to null

  constructor(partial: Partial<AttributeStringModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class AttributeURLModel extends AttributeModel {
  @Expose() key: string = ''; // Default to empty string
  @Expose() type: string = 'string'; // Default to 'string'
  @Expose() format: string = ''; // Default to empty string
  @Expose() default: string | null = null; // Default to null

  constructor(partial: Partial<AttributeURLModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}
