import { Reflector } from '@nestjs/core'
import { services } from '../config/services'
import {
  APP_AUTH_TYPE_ADMIN,
  APP_AUTH_TYPE_JWT,
  APP_AUTH_TYPE_KEY,
  APP_AUTH_TYPE_SESSION,
} from '@nuvix/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SchemaType } from '@nuvix/utils'

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
