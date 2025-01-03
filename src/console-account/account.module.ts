import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Identities, IdentitiesSchema, Session, SessionSchema } from './schemas/account.schema';
import { UserService } from 'src/console-user/user.service';
import { Target, TargetSchema, User, UserSchema } from 'src/console-user/schemas/user.schema';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from 'src/Utils/constants';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { APP_GUARD } from '@nestjs/core';
import { Organization, OrganizationSchema } from 'src/console-user/schemas/organization.schema';
import { Membership, MembershipSchema } from 'src/console-user/schemas/membersip.schema';

@Module({
  controllers: [AccountController],
  providers: [JwtStrategy, AccountService, UserService, {
    provide: APP_GUARD,
    useClass: JwtAuthGuard
  }],
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    MongooseModule.forFeature([
      { name: Identities.name, schema: IdentitiesSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Target.name, schema: TargetSchema },
      { name: User.name, schema: UserSchema, },
      { name: Membership.name, schema: MembershipSchema }
    ], 'server')
  ]
})
export class ConsoleAccountModule { }
