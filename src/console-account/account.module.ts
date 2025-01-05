import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from 'src/console-user/user.service';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from 'src/Utils/constants';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { APP_GUARD } from '@nestjs/core';

// Importing all the schemas from the console-user && console-account
import { Identities, IdentitiesSchema, Session, SessionSchema } from './schemas/account.schema';
import { Target, TargetSchema, User, UserSchema } from 'src/console-user/schemas/user.schema';
import { Organization, OrganizationSchema } from 'src/console-user/schemas/organization.schema';
import { Membership, MembershipSchema } from 'src/console-user/schemas/membersip.schema';
import { Plan, PlanSchema } from 'src/console/schemas/plan.schema';
import Authenticator, { AuthenticatorSchema } from 'src/console-user/schemas/authenticator.schema';
import { BillingAddress, BillingAddressSchema } from 'src/console-user/schemas/billing.schema';
import Challenges, { ChallengesSchema } from 'src/console-user/schemas/challenge.schema';
import { PaymentMethod, PaymentMethodSchema } from 'src/console-user/schemas/payment.schema';
import Token, { TokenSchema } from 'src/console-user/schemas/token.schema';
import { Invoice, InvoiceSchema } from 'src/console-user/schemas/invoce.schema';
import { Log, LogSchema } from 'src/console-user/schemas/log.schema';

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
      { name: Membership.name, schema: MembershipSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: Authenticator.name, schema: AuthenticatorSchema },
      { name: BillingAddress.name, schema: BillingAddressSchema },
      { name: Challenges.name, schema: ChallengesSchema },
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
      { name: Token.name, schema: TokenSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Log.name, schema: LogSchema },
    ], 'server')
  ]
})
export class ConsoleAccountModule { }
