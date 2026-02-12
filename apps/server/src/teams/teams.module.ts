import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import { ApiHook, AuditHook, AuthHook, StatsHook } from '@nuvix/core/resolvers'
import { MembershipsController } from './memberships/memberships.controller'
import { MembershipsService } from './memberships/memberships.service'
import { TeamsController } from './teams.controller'
import { TeamsService } from './teams.service'

@Module({
  controllers: [TeamsController, MembershipsController],
  providers: [TeamsService, MembershipsService],
})
export class TeamsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthHook, ApiHook, StatsHook, AuditHook)
      .forRoutes(TeamsController, MembershipsController)
  }
}
