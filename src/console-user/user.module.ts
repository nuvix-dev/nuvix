import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Target, TargetSchema, User, UserSchema } from './schemas/user.schema';
import { JwtAuthGuard } from 'src/console-account/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { Membership, MembershipSchema } from './schemas/membersip.schema';

@Module({
  controllers: [UserController],
  providers: [UserService, {
    provide: APP_GUARD,
    useClass: JwtAuthGuard
  }],
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Target.name, schema: TargetSchema },
      { name: Membership.name, schema: MembershipSchema }
    ], 'server')
  ],
  exports: [
    UserService
  ]
})
export class UserModule { }
