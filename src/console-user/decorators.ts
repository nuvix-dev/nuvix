import { createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Request } from 'express';
import { User as UserSchema } from './schemas/user.schema';


export const User = createParamDecorator<UserSchema>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    if (request.user) {
      return plainToInstance(UserSchema, request.user);
    }
    return null;
  },
);