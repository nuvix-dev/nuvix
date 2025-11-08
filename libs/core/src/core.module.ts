import {
  Global,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'

import { configuration } from '@nuvix/utils'
import { Database, StructureValidator } from '@nuvix/db'
import pg from 'pg'
import { parse as parseArray } from 'postgres-array'
import { filters, formats } from '@nuvix/utils/database'
import { AppConfigService } from './config.service.js'
import { CoreService } from './core.service.js'
import { ConfigModule } from '@nestjs/config'
import { RatelimitService } from './rate-limit.service.js'
import { BullModule } from '@nestjs/bullmq'
import { EventEmitterModule } from '@nestjs/event-emitter'

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => configuration],
    }),
    BullModule.forRootAsync({
      useFactory(config: AppConfigService) {
        const redisConfig = config.getRedisConfig()
        return {
          connection: {
            ...redisConfig,
            tls: redisConfig.secure
              ? {
                  rejectUnauthorized: false,
                }
              : undefined,
            enableOfflineQueue: true,
            enableReadyCheck: true,
          },
          defaultJobOptions: {
            priority: 1,
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: true,
          },
          prefix: 'nuvix', // TODO: we have to include a instance key that should be unique per app instance
        }
      },
      inject: [AppConfigService],
    }),
    EventEmitterModule.forRoot({
      global: true,
    }),
  ],
  providers: [
    {
      provide: AppConfigService,
      useClass: AppConfigService,
    },
    CoreService,
    RatelimitService,
  ],
  exports: [AppConfigService, CoreService, RatelimitService],
})
export class CoreModule implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(CoreModule.name)
  constructor(private readonly coreService: CoreService) {}

  async onModuleInit() {
    await this.coreService.getCache().flush()
  }

  async onModuleDestroy() {
    this.logger.log('Initiating cache flush during module shutdown...')
    await this.coreService.getCache().flush()
    this.logger.log('Cache successfully flushed on module shutdown.')
  }
}

export function configurePgTypeParsers() {
  const types = pg.types

  types.setTypeParser(types.builtins.INT8, x => {
    const asNumber = Number(x)
    return Number.isSafeInteger(asNumber) ? asNumber : x
  })

  types.setTypeParser(types.builtins.NUMERIC, parseFloat)
  types.setTypeParser(types.builtins.FLOAT4, parseFloat)
  types.setTypeParser(types.builtins.FLOAT8, parseFloat)
  types.setTypeParser(types.builtins.BOOL, val => val === 't')

  types.setTypeParser(types.builtins.DATE, x => x)
  types.setTypeParser(types.builtins.TIMESTAMP, x => x)
  types.setTypeParser(types.builtins.TIMESTAMPTZ, x => x)
  types.setTypeParser(types.builtins.INTERVAL, x => x)

  types.setTypeParser(1115 as any, parseArray) // _timestamp[]
  types.setTypeParser(1182 as any, parseArray) // _date[]
  types.setTypeParser(1185 as any, parseArray) // _timestamptz[]
  types.setTypeParser(600 as any, x => x) // point
  types.setTypeParser(1017 as any, x => x) // _point
}

export function configureDbFiltersAndFormats() {
  Object.entries(filters).forEach(([key, filter]) => {
    Database.addFilter(key, filter)
  })

  Object.entries(formats).forEach(([key, format]) => {
    StructureValidator.addFormat(key, format)
  })
}
