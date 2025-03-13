import { Reflector } from '@nestjs/core';
import { services } from '../config/services';
import {
  APP_AUTH_TYPE_ADMIN,
  APP_AUTH_TYPE_JWT,
  APP_AUTH_TYPE_KEY,
  APP_AUTH_TYPE_SESSION,
} from 'src/Utils/constants';

export const Namespace = Reflector.createDecorator<keyof typeof services>();

const authTypes = [
  APP_AUTH_TYPE_SESSION,
  APP_AUTH_TYPE_JWT,
  APP_AUTH_TYPE_KEY,
  APP_AUTH_TYPE_ADMIN,
] as const;

export const AuthType = Reflector.createDecorator<(typeof authTypes)[number]>();
