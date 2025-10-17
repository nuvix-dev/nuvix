import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { JwtModule } from '@nestjs/jwt'
import { configuration, QueueFor } from '@nuvix/utils'
import { BullModule } from '@nestjs/bullmq'
import { AuthHook, ApiHook, StatsHook, AuditHook } from '@nuvix/core/resolvers'
import { SessionsController } from './sessions/sessions.controller'
import { TargetsController } from './targets/targets.controller'
import { MfaController } from './mfa/mfa.controller'
import { SessionsService } from './sessions/sessions.service'
import { MfaService } from './mfa/mfa.service'
import { TargetsService } from './targets/targets.service'

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
