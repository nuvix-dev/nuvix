import { Module } from '@nestjs/common';
import { ConsoleService } from './console.service';
import { ConsoleController } from './console.controller';

@Module({
  controllers: [ConsoleController],
  providers: [ConsoleService],
})
export class ConsoleModule {}
