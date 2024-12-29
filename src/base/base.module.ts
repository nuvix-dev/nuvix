import { Module } from '@nestjs/common';
import { BaseService } from './base.service';
import { BaseResolver } from './base.resolver';
import { BaseController } from './base.controller';

@Module({
  providers: [BaseResolver, BaseService],
  imports: [

  ],
  controllers: [BaseController]
})
export class BaseModule { }
