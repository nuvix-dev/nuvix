import { Reflector } from '@nestjs/core';
import { Scopes } from '../config/roles';

export const Scope = Reflector.createDecorator<Scopes | Scopes[]>();
