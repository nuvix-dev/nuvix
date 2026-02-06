import { applyDecorators } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ApiTags } from '@nestjs/swagger'
import {
  APP_AUTH_TYPE_ADMIN,
  APP_AUTH_TYPE_JWT,
  APP_AUTH_TYPE_KEY,
  APP_AUTH_TYPE_SESSION,
  SchemaType,
} from '@nuvix/utils'
import { services } from '../config/services'

export const _Namespace = Reflector.createDecorator<keyof typeof services>()
export const Namespace = (ns: keyof typeof services) => {
  return applyDecorators(ApiTags(ns), _Namespace(ns))
}

export enum AuthType {
  SESSION = APP_AUTH_TYPE_SESSION,
  JWT = APP_AUTH_TYPE_JWT,
  KEY = APP_AUTH_TYPE_KEY,
  ADMIN = APP_AUTH_TYPE_ADMIN,
}

export const Auth = Reflector.createDecorator<AuthType | AuthType[]>()

export const CurrentSchemaType = Reflector.createDecorator<
  SchemaType | SchemaType[]
>()
