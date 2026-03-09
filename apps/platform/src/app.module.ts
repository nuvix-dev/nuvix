import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { ScheduleModule } from '@nestjs/schedule'
import { CoreModule } from '@nuvix/core'
import { Key } from '@nuvix/core/helpers'
import { ApiHook, AuthHook, CorsHook } from '@nuvix/core/resolvers'
import { PgMetaModule } from '@nuvix/pg-meta'
import { configuration } from '@nuvix/utils'
import { AccountModule } from './account/account.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ProjectModule } from './projects/project.module'

@Module({
  imports: [
    CoreModule,
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: configuration.security.jwtSecret,
      global: true,
    }),
    AccountModule,
    ProjectModule,
    PgMetaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(private readonly jwtService: JwtService) {}

  onModuleInit() {
    Key.setJwtService(this.jwtService)
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorsHook)
      .forRoutes('*')
      .apply(AuthHook, ApiHook)
      .forRoutes('*')
  }
}
