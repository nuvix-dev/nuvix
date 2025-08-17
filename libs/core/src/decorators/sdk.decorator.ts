import { Reflector } from '@nestjs/core';
import { services } from '../config/services';
import {
  APP_AUTH_TYPE_ADMIN,
  APP_AUTH_TYPE_JWT,
  APP_AUTH_TYPE_KEY,
  APP_AUTH_TYPE_SESSION,
} from '@nuvix/utils';
import { HttpStatus } from '@nestjs/common';

export const Namespace = Reflector.createDecorator<keyof typeof services>();

export enum AuthType {
  SESSION = APP_AUTH_TYPE_SESSION,
  JWT = APP_AUTH_TYPE_JWT,
  KEY = APP_AUTH_TYPE_KEY,
  ADMIN = APP_AUTH_TYPE_ADMIN,
}

export const Auth = Reflector.createDecorator<AuthType | AuthType[]>();

interface SdkOptions {
  name: string;
  auth?: AuthType | AuthType[];
  code?: HttpStatus | number;
  description?: string;
  // TODO:
  version?: string;
  tags?: string[];
  isPublic?: boolean;
  isInternal?: boolean;
  isExperimental?: boolean;
  isDeprecated?: boolean;
  isHidden?: boolean;
}

export const Sdk = Reflector.createDecorator<SdkOptions>();
