import { Module } from '@nestjs/common'
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
export class AccountModule {}
