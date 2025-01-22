import { Module } from '@nestjs/common';
import { ConsoleService } from './console.service';
import { ConsoleController } from './console.controller';
import { consoleDatabase } from 'src/core/db.provider';

@Module({
  controllers: [ConsoleController],
  providers: [ConsoleService, consoleDatabase],
})
export class ConsoleModule {}
