import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Organization, OrganizationSchema, User, UserSchema } from './schemas/user.schema';
import { JwtAuthGuard } from 'src/account/jwt-auth.guard';

@Module({
  controllers: [UserController],
  providers: [UserService, {
    provide: 'AUTH_GUARD',
    useClass: JwtAuthGuard
  }],
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ], 'server')
  ],
  exports: [
    UserService
  ]
})
export class UserModule { }
