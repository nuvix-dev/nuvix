import { Reflector } from '@nestjs/core';
import { scopes } from '../config/scopes';

export const Scope = Reflector.createDecorator<
  keyof typeof scopes | keyof (typeof scopes)[]
>();
