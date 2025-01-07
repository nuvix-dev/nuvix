import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  controllers: [DatabaseController],
  providers: [DatabaseService],
})
export class DatabaseModule { }
