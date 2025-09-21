import { Module } from '@nestjs/common';
import { InternalService } from './internal.service';
import { InternalController } from './internal.controller';

@Module({
  controllers: [InternalController],
  providers: [InternalService],
})
export class InternalModule {}
