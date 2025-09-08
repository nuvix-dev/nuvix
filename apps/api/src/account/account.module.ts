import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { BullModule } from '@nestjs/bullmq';
import { QueueFor } from '@nuvix/utils';
import { IdentityController } from './identities/identity.controller';
import { MfaController } from './mfa/mfa.controller';
import { RecoveryController } from './recovery/recovery.controller';
import { SessionsController } from './sessions/session.controller';
import { TargetsController } from './targets/targets.controller';
import { IdentityService } from './identities/identity.service';
import { MfaService } from './mfa/mfa.service';
import { RecoveryService } from './recovery/recovery.service';
import { SessionService } from './sessions/session.service';
import { TargetsService } from './targets/targets.service';
import { ApiHook, AuditHook, AuthHook, StatsHook } from '@nuvix/core/resolvers';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QueueFor.MAILS },
      { name: QueueFor.STATS },
      { name: QueueFor.AUDITS },
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
    consumer.apply(AuthHook, ApiHook, StatsHook, AuditHook).forRoutes('*');
  }
}
