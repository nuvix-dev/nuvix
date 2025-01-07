import { createParamDecorator, ExecutionContext, Inject, Injectable, Scope } from '@nestjs/common';
import { Request } from 'express';
import { User as UserSchema } from './schemas/user.schema';
import { REQUEST } from '@nestjs/core';


export const User = createParamDecorator<UserSchema>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    if (request.user) {
      return request.user;
    }
    return null;
  },
);