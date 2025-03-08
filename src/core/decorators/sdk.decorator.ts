import { Reflector } from '@nestjs/core';
import { services } from '../config/services';

export const Namespace = Reflector.createDecorator<keyof typeof services>();
