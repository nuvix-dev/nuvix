import { Module } from '@nestjs/common'
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
})
export class UsersModule {}
