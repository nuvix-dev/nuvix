import { SetMetadata } from '@nestjs/common';
import { scopes } from '../config/scopes';

type LableKey = 'scope';

type LableValue = {
  scope: keyof typeof scopes;
};

export const Lable = <K extends LableKey>(key: K, value: LableValue[K]) =>
  SetMetadata(key, value);
