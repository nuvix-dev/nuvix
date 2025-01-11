import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Target, TargetSchema, User, UserSchema } from './schemas/user.schema';
import { JwtAuthGuard } from 'src/console-account/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { Membership, MembershipSchema } from './schemas/membersip.schema';
import { Plan, PlanSchema } from 'src/console/schemas/plan.schema';
import Authenticator, { AuthenticatorSchema } from './schemas/authenticator.schema';
import { BillingAddress, BillingAddressSchema } from './schemas/billing.schema';
import Challenges, { ChallengesSchema } from './schemas/challenge.schema';
import { PaymentMethod, PaymentMethodSchema } from './schemas/payment.schema';
import Token, { TokenSchema } from './schemas/token.schema';
import { OrganizationsController } from './organizations.controller';

@Module({
  controllers: [UserController, OrganizationsController],
  providers: [UserService, {
    provide: APP_GUARD,
    useClass: JwtAuthGuard
  }],
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Target.name, schema: TargetSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: Authenticator.name, schema: AuthenticatorSchema },
      { name: BillingAddress.name, schema: BillingAddressSchema },
      { name: Challenges.name, schema: ChallengesSchema },
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
      { name: Token.name, schema: TokenSchema },
    ], 'server')
  ],
  exports: [
    UserService
  ]
})
export class UserModule { }
