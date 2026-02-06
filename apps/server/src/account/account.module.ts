import { BullModule } from '@nestjs/bullmq'
import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import { ApiHook, AuditHook, AuthHook, StatsHook } from '@nuvix/core/resolvers'
import { QueueFor } from '@nuvix/utils'
import { AccountController } from './account.controller'
import { AccountService } from './account.service'
import { IdentityController } from './identities/identity.controller'
import { IdentityService } from './identities/identity.service'
import { MfaController } from './mfa/mfa.controller'
import { MfaService } from './mfa/mfa.service'
import { RecoveryController } from './recovery/recovery.controller'
import { RecoveryService } from './recovery/recovery.service'
import { SessionsController } from './sessions/session.controller'
import { SessionService } from './sessions/session.service'
import { TargetsController } from './targets/targets.controller'
import { TargetsService } from './targets/targets.service'

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QueueFor.MAILS },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
      { name: QueueFor.DELETES },
    ),
  ],
  controllers: [
    AccountController,
    IdentityController,
    MfaController,
    RecoveryController,
    SessionsController,
    TargetsController,
  ],
  providers: [
    AccountService,
    IdentityService,
    MfaService,
    RecoveryService,
    SessionService,
    TargetsService,
  ],
})
export class AccountModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, StatsHook, AuditHook)
      .forRoutes(
        AccountController,
        IdentityController,
        MfaController,
        RecoveryController,
        SessionsController,
        TargetsController,
      )
  }
}
