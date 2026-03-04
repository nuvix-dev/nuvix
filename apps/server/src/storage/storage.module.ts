import { Module } from '@nestjs/common'
import { FilesController } from './files/files.controller'
import { FilesService } from './files/files.service'
import { StorageController } from './storage.controller'
import { StorageService } from './storage.service'

@Module({
  controllers: [StorageController, FilesController],
  providers: [StorageService, FilesService],
})
export class StorageModule {}
