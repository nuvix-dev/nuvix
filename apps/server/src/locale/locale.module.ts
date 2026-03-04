import { Module } from '@nestjs/common'
import { LocaleController } from './locale.controller'
import { LocaleService } from './locale.service'

@Module({
  controllers: [LocaleController],
  providers: [LocaleService],
})
export class LocaleModule {}
