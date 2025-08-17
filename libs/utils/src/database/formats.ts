import {
  AttributeType,
  RangeValidator,
  Format,
  Attribute,
  DatetimeValidator,
  NumericType,
} from '@nuvix-tech/db';
import {
  EmailValidator,
  IPValidator,
  URLValidator,
  WhiteList,
} from '@nuvix/core/validators';
import { AttributeFormat } from '@nuvix/utils';

export const formats: Record<string, Format> = {
  [AttributeFormat.EMAIL]: {
    type: AttributeType.String,
    callback: () => new EmailValidator(),
  },
  [AttributeFormat.DATETIME]: {
    callback: () => new DatetimeValidator(),
    type: AttributeType.Timestamptz,
  },
  [AttributeFormat.ENUM]: {
    callback: attribute => {
      const elements = (attribute as Attribute).formatOptions?.['elements'];
      return new WhiteList(elements, true);
    },
    type: AttributeType.String,
  },
  [AttributeFormat.IP]: {
    callback: () => new IPValidator(),
    type: AttributeType.String,
  },
  [AttributeFormat.URL]: {
    callback: () => new URLValidator(),
    type: AttributeType.String,
  },
  [AttributeFormat.INTEGER]: {
    callback: (attribute: any) => {
      const min = attribute.formatOptions.min ?? -Infinity;
      const max = attribute.formatOptions.max ?? Infinity;
      return new RangeValidator(min, max, NumericType.INTEGER);
    },
    type: AttributeType.Integer,
  },
  [AttributeFormat.FLOAT]: {
    callback: (attribute: any) => {
      const min = attribute.formatOptions.min ?? -Infinity;
      const max = attribute.formatOptions.max ?? Infinity;
      return new RangeValidator(min, max, NumericType.FLOAT);
    },
    type: AttributeType.Float,
  },
};
