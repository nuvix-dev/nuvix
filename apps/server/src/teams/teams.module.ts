import { Module } from '@nestjs/common'
import { MembershipsController } from './memberships/memberships.controller'
import { MembershipsService } from './memberships/memberships.service'
import { TeamsController } from './teams.controller'
import { TeamsService } from './teams.service'

@Module({
  controllers: [TeamsController, MembershipsController],
  providers: [TeamsService, MembershipsService],
})
export class TeamsModule {}
