import { BullModule } from '@nestjs/bullmq'
import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ApiHook, AuditHook, AuthHook, StatsHook } from '@nuvix/core/resolvers'
import { configuration, QueueFor } from '@nuvix/utils'
import { MfaController } from './mfa/mfa.controller'
import { MfaService } from './mfa/mfa.service'
import { SessionsController } from './sessions/sessions.controller'
import { SessionsService } from './sessions/sessions.service'
import { TargetsController } from './targets/targets.controller'
import { TargetsService } from './targets/targets.service'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  controllers: [
    UsersController,
    SessionsController,
    TargetsController,
    MfaController,
  ],
  providers: [UsersService, SessionsService, TargetsService, MfaService],
  imports: [
    BullModule.registerQueue(
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
      { name: QueueFor.DELETES },
    ),
    JwtModule.register({
      secret: configuration.security.jwtSecret,
      signOptions: { expiresIn: '15m' },
    }),
  ],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, StatsHook, AuditHook)
      .forRoutes(
        UsersController,
        SessionsController,
        TargetsController,
        MfaController,
      )
  }
}
