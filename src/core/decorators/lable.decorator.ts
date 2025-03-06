import { SetMetadata } from '@nestjs/common';
import { scopes } from '../config/scopes';
import { services } from '../config/services';

export type LableKey = 'scope' | 'namespace';

export type LableValue = {
  scope?: keyof typeof scopes;
  namespace?: keyof typeof services;
};

export const Lable = <K extends LableKey>(key: K, value: LableValue[K]) =>
  SetMetadata(key, value);
