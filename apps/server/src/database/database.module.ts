import { Module } from '@nestjs/common'
import { DatabaseController } from './database.controller'
import { DatabaseService } from './database.service'

@Module({
  controllers: [DatabaseController],
  providers: [DatabaseService],
})
export class DatabaseModule {}
