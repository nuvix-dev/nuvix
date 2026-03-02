import { Module } from '@nestjs/common'
import { PgMetaController } from './pg-meta.controller'
import { PgMetaService } from './pg-meta.service'

@Module({
  providers: [PgMetaService],
  exports: [PgMetaService],
  controllers: [PgMetaController],
})
export class PgMetaModule {}
