import {
    Database,
    DatetimeValidator,
    RangeValidator,
} from '@nuvix/database';
import {
    APP_DATABASE_ATTRIBUTE_DATETIME,
    APP_DATABASE_ATTRIBUTE_EMAIL,
    APP_DATABASE_ATTRIBUTE_ENUM,
    APP_DATABASE_ATTRIBUTE_FLOAT_RANGE,
    APP_DATABASE_ATTRIBUTE_INT_RANGE,
    APP_DATABASE_ATTRIBUTE_IP,
    APP_DATABASE_ATTRIBUTE_URL,
} from '@nuvix/utils/constants';
import { EmailValidator } from '@nuvix/core/validators/email.validator';
import { URLValidator } from '@nuvix/core/validators/url.validator';
import { IPValidator } from '@nuvix/core/validators/ip.validator';
import { WhiteList } from '@nuvix/core/validators/whitelist.validator';

export const formats = {
  [APP_DATABASE_ATTRIBUTE_EMAIL]: {
    create: () => new EmailValidator(),
    type: Database.VAR_STRING,
  },
  [APP_DATABASE_ATTRIBUTE_DATETIME]: {
    create: () => new DatetimeValidator(),
    type: Database.VAR_DATETIME,
  },
  [APP_DATABASE_ATTRIBUTE_ENUM]: {
    create: (attribute: any) => {
      const elements = attribute.formatOptions.elements;
      return new WhiteList(elements, true);
    },
    type: Database.VAR_STRING,
  },
  [APP_DATABASE_ATTRIBUTE_IP]: {
    create: () => new IPValidator(),
    type: Database.VAR_STRING,
  },
  [APP_DATABASE_ATTRIBUTE_URL]: {
    create: () => new URLValidator(),
    type: Database.VAR_STRING,
  },
  [APP_DATABASE_ATTRIBUTE_INT_RANGE]: {
    create: (attribute: any) => {
      const min = attribute.formatOptions.min ?? -Infinity;
      const max = attribute.formatOptions.max ?? Infinity;
      return new RangeValidator(min, max, `integer`);
    },
    type: Database.VAR_INTEGER,
  },
  [APP_DATABASE_ATTRIBUTE_FLOAT_RANGE]: {
    create: (attribute: any) => {
      const min = attribute.formatOptions.min ?? -Infinity;
      const max = attribute.formatOptions.max ?? Infinity;
      return new RangeValidator(min, max, `float`);
    },
    type: Database.VAR_FLOAT,
  },
};
