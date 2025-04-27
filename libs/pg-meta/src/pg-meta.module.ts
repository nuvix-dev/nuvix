import { Module } from '@nestjs/common';
import { PgMetaService } from './pg-meta.service';

@Module({
  providers: [PgMetaService],
  exports: [PgMetaService],
})
export class PgMetaModule {}
